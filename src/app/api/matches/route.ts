import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TaskType } from "@google/generative-ai";
import { getServiceSupabase } from "@/lib/supabase";
import { generateEmbedding, explainJobMatches } from "@/lib/gemini";
import { EnrichedJobMatch, MatchResponseBody } from "@/types/match";
import { HybridSearchResult } from "@/types/database";

// Strict request validation schema
const MatchRequestSchema = z.object({
  resumeText: z
    .string()
    .min(30, "Resume text must be at least 30 characters long to extract meaningful matches.")
    .max(25000, "Resume text exceeds maximum length of 25,000 characters."),
  limit: z.number().int().min(1).max(25).default(10),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = performance.now();

  try {
    // 1. Parse and validate JSON payload
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json<MatchResponseBody>(
        {
          success: false,
          count: 0,
          data: [],
          queryTimeMs: 0,
          error: "Invalid JSON in request body.",
        },
        { status: 400 }
      );
    }

    const parseResult = MatchRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json<MatchResponseBody>(
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

    const { resumeText, limit } = parseResult.data;

    // 2. Generate 768-dimensional embedding for candidate resume query
    const queryEmbedding = await generateEmbedding(resumeText, TaskType.RETRIEVAL_QUERY);

    // 3. Prepare full-text search query string
    // Sanitize text: remove special characters that could distort Postgres tsquery syntax
    const sanitizedSearchText = resumeText
      .replace(/[^\w\s]/g, " ")
      .slice(0, 1000); // tsquery focuses on the candidate's core summary and skills

    // 4. Query Supabase RPC 'hybrid_search_jobs'
    const supabase = getServiceSupabase();
    const { data: matchedJobs, error: dbError } = await supabase.rpc("hybrid_search_jobs", {
      query_text: sanitizedSearchText,
      query_embedding: queryEmbedding,
      match_count: limit,
      rrf_k: 60,
      semantic_weight: 1.0,
      text_weight: 1.0,
    });

    if (dbError) {
      console.error("Supabase RPC error executing hybrid_search_jobs:", dbError);
      return NextResponse.json<MatchResponseBody>(
        {
          success: false,
          count: 0,
          data: [],
          queryTimeMs: Math.round(performance.now() - startTime),
          error: `Database hybrid search failed: ${dbError.message}`,
        },
        { status: 500 }
      );
    }

    const jobs = (matchedJobs as HybridSearchResult[]) || [];

    if (jobs.length === 0) {
      return NextResponse.json<MatchResponseBody>(
        {
          success: true,
          count: 0,
          data: [],
          queryTimeMs: Math.round(performance.now() - startTime),
        },
        { status: 200 }
      );
    }

    // 5. Generate LLM explanations & skill gaps via Gemini
    const explanationsMap = await explainJobMatches(resumeText, jobs);

    // 6. Enrich jobs with their LLM analysis
    const enrichedResults: EnrichedJobMatch[] = jobs.map((job) => {
      const explanation = explanationsMap[job.id] || {
        jobId: job.id,
        matchScore: Math.round(job.similarity * 100),
        fitSummary: "Matched based on hybrid vector and keyword similarity.",
        matchingSkills: job.skills.slice(0, 3),
        missingSkills: [],
        recommendation: "Review the full job description for role alignment.",
      };

      return {
        ...job,
        explanation,
      };
    });

    // Sort primarily by Gemini's contextual matchScore or RRF score
    enrichedResults.sort((a, b) => b.explanation.matchScore - a.explanation.matchScore);

    const duration = Math.round(performance.now() - startTime);

    return NextResponse.json<MatchResponseBody>(
      {
        success: true,
        count: enrichedResults.length,
        data: enrichedResults,
        queryTimeMs: duration,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Unhandled error in /api/matches:", error);
    const message = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json<MatchResponseBody>(
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
