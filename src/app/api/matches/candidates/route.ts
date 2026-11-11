import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TaskType } from "@google/generative-ai";
import { getServiceSupabase } from "@/lib/supabase";
import { generateEmbedding, explainCandidateMatches } from "@/lib/gemini";
import { EnrichedCandidateMatch, CandidateMatchResponseBody } from "@/types/match";
import { HybridResumeSearchResult } from "@/types/database";

const CandidateMatchRequestSchema = z.object({
  jobDescription: z
    .string()
    .min(30, "Job description must be at least 30 characters long.")
    .max(25000, "Job description exceeds maximum length of 25,000 characters."),
  limit: z.number().int().min(1).max(25).default(10),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json<CandidateMatchResponseBody>(
        { success: false, count: 0, data: [], queryTimeMs: 0, error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const parseResult = CandidateMatchRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json<CandidateMatchResponseBody>(
        {
          success: false,
          count: 0,
          data: [],
          queryTimeMs: 0,
          error: parseResult.error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { jobDescription, limit } = parseResult.data;

    // 1. Generate 768-D query embedding for the Job Description
    const queryEmbedding = await generateEmbedding(jobDescription, TaskType.RETRIEVAL_QUERY);

    // 2. Sanitize query string for PostgreSQL plainto_tsquery
    const sanitizedSearchText = jobDescription.replace(/[^\w\s]/g, " ").slice(0, 1000);

    // 3. Query Supabase RPC 'hybrid_search_resumes'
    const supabase = getServiceSupabase();
    const { data: matchedCandidates, error: dbError } = await supabase.rpc("hybrid_search_resumes", {
      query_text: sanitizedSearchText,
      query_embedding: queryEmbedding,
      match_count: limit,
      rrf_k: 60,
      semantic_weight: 1.0,
      text_weight: 1.0,
    });

    if (dbError) {
      console.error("Supabase RPC error executing hybrid_search_resumes:", dbError);
      return NextResponse.json<CandidateMatchResponseBody>(
        {
          success: false,
          count: 0,
          data: [],
          queryTimeMs: Math.round(performance.now() - startTime),
          error: `Database hybrid candidate search failed: ${dbError.message}`,
        },
        { status: 500 }
      );
    }

    const candidates = (matchedCandidates as HybridResumeSearchResult[]) || [];

    if (candidates.length === 0) {
      return NextResponse.json<CandidateMatchResponseBody>(
        {
          success: true,
          count: 0,
          data: [],
          queryTimeMs: Math.round(performance.now() - startTime),
        },
        { status: 200 }
      );
    }

    // 4. Evaluate candidates against the JD via Gemini 3.8 Flash
    const explanationsMap = await explainCandidateMatches(jobDescription, candidates);

    // 5. Enrich candidates with recruiter fit analysis
    const enrichedResults: EnrichedCandidateMatch[] = candidates.map((cand) => {
      const explanation = explanationsMap[cand.id] || {
        candidateId: cand.id,
        candidateName: cand.candidate_name,
        matchScore: Math.round(cand.similarity * 100),
        hiringVerdict: cand.similarity >= 0.8 ? "Strong Interview" : cand.similarity >= 0.6 ? "Consider" : "Reject",
        fitSummary: "Matched via hybrid vector and keyword rank fusion across candidate qualifications.",
        matchedQualifications: cand.skills.slice(0, 3),
        criticalMissingSkills: [],
        interviewQuestions: ["Can you explain your experience with the primary technologies listed on your resume?"],
      };

      return {
        ...cand,
        explanation,
      };
    });

    // Sort descending by matchScore
    enrichedResults.sort((a, b) => b.explanation.matchScore - a.explanation.matchScore);

    const duration = Math.round(performance.now() - startTime);

    return NextResponse.json<CandidateMatchResponseBody>(
      {
        success: true,
        count: enrichedResults.length,
        data: enrichedResults,
        queryTimeMs: duration,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Unhandled error in /api/matches/candidates:", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json<CandidateMatchResponseBody>(
      {
        success: false,
        count: 0,
        data: [],
        queryTimeMs: Math.round(performance.now() - startTime),
        error: message,
      },
      { status: 500 }
    );
  }
}
