import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";
import { getServiceSupabase } from "@/lib/supabase";
import { batchGenerateEmbeddings } from "@/lib/gemini";
import { ResumeUploadResponseBody, UploadedCandidateSummary } from "@/types/match";
import { ResumeInsert } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Extracts a candidate's display name from filename or first line of resume
 */
function inferCandidateName(filename: string, rawText: string): string {
  // Try clean filename: "Alex_Mercer_Resume.pdf" -> "Alex Mercer"
  const baseName = filename.replace(/\.[^/.]+$/, "");
  const cleanedName = baseName
    .replace(/[_-]/g, " ")
    .replace(/\b(resume|cv|profile|bio)\b/gi, "")
    .trim();

  if (cleanedName.length >= 3 && cleanedName.split(" ").length <= 4) {
    return cleanedName
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // Fallback to first non-empty line of resume text
  const firstLine = rawText.split("\n").map((l) => l.trim()).find((l) => l.length > 2 && l.length < 50);
  return firstLine || "Candidate";
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Basic heuristic to extract common technology keywords from raw resume text
 */
function inferSkillsFromText(text: string): string[] {
  const commonTech = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python",
    "PostgreSQL", "SQL", "Docker", "Kubernetes", "AWS", "GCP", "Azure",
    "GraphQL", "REST", "Redis", "Tailwind CSS", "MongoDB", "Git", "PyTorch",
    "LangChain", "FastAPI", "Java", "C++", "C#", "Go", "Rust", "CI/CD", "Linux"
  ];

  const matched = new Set<string>();
  const lower = text.toLowerCase();

  for (const tech of commonTech) {
    const escaped = escapeRegExp(tech.toLowerCase());
    // Match word boundaries or non-alphanumeric boundaries (handles C++, C#, Node.js safely)
    const regex = new RegExp(`(?:^|[^a-z0-9_#+])${escaped}(?:[^a-z0-9_#+]|$)`, "i");
    if (regex.test(lower)) {
      matched.add(tech);
    }
  }

  return Array.from(matched);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json<ResumeUploadResponseBody>(
        { success: false, count: 0, data: [], error: "No files uploaded. Please upload at least one PDF resume." },
        { status: 400 }
      );
    }

    const parsedCandidates: { name: string; rawText: string; skills: string[]; filename: string }[] = [];

    // 1. Extract text from each uploaded PDF using unpdf
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const { text } = await extractText(buffer, { mergePages: true });

        const rawText = (typeof text === "string" ? text : Array.isArray(text) ? (text as string[]).join("\n") : "").trim();

        if (rawText.length < 30) {
          console.warn(`Skipping file with insufficient text: ${file.name}`);
          continue;
        }

        const candidateName = inferCandidateName(file.name, rawText);
        const skills = inferSkillsFromText(rawText);

        parsedCandidates.push({
          name: candidateName,
          rawText,
          skills,
          filename: file.name,
        });
      } catch (pdfErr) {
        console.error(`Failed to parse PDF ${file.name}:`, pdfErr);
      }
    }

    if (parsedCandidates.length === 0) {
      return NextResponse.json<ResumeUploadResponseBody>(
        { success: false, count: 0, data: [], error: "Could not extract text from the uploaded PDF files. Ensure they contain readable text." },
        { status: 400 }
      );
    }

    // 2. Generate 768-D embeddings via Gemini (batch of texts)
    const textsToEmbed = parsedCandidates.map(
      (c) => `Candidate Name: ${c.name}\nSkills: ${c.skills.join(", ")}\nResume Content:\n${c.rawText.slice(0, 3000)}`
    );

    const embeddings = await batchGenerateEmbeddings(textsToEmbed);

    // 3. Prepare records for Supabase resumes table
    const recordsToInsert: ResumeInsert[] = parsedCandidates.map((c, idx) => ({
      candidate_name: c.name,
      raw_text: c.rawText,
      skills: c.skills,
      embedding: embeddings[idx],
    }));

    // 4. Batch insert into Supabase
    const supabase = getServiceSupabase();
    const { data: insertedRows, error: dbError } = await supabase
      .from("resumes")
      .insert(recordsToInsert)
      .select("id, candidate_name, skills, raw_text");

    if (dbError) {
      console.error("Database error inserting resumes:", dbError);
      return NextResponse.json<ResumeUploadResponseBody>(
        { success: false, count: 0, data: [], error: `Database insert failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    const summaryData: UploadedCandidateSummary[] = (insertedRows || []).map((row) => ({
      id: row.id,
      candidateName: row.candidate_name || "Candidate",
      skills: row.skills || [],
      snippet: row.raw_text.slice(0, 150) + "...",
    }));

    return NextResponse.json<ResumeUploadResponseBody>(
      {
        success: true,
        count: summaryData.length,
        data: summaryData,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("Unhandled error in /api/resumes/upload:", err);
    const message = err instanceof Error ? err.message : "Internal server error during PDF upload";
    return NextResponse.json<ResumeUploadResponseBody>(
      { success: false, count: 0, data: [], error: message },
      { status: 500 }
    );
  }
}
