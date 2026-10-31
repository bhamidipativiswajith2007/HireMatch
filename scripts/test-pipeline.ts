import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getServiceSupabase } from "../src/lib/supabase";
import { generateEmbedding, explainJobMatches } from "../src/lib/gemini";
import { HybridSearchResult } from "../src/types/database";

async function testPipeline() {
  console.log("1. Generating query embedding via Gemini...");
  const resume = "Senior Software Engineer with 5 years building scalable web apps in Next.js, TypeScript, React, and PostgreSQL.";
  const emb = await generateEmbedding(resume);
  console.log(`   Generated vector with length: ${emb.length}`);

  console.log("2. Running Supabase hybrid_search_jobs RPC...");
  const sb = getServiceSupabase();
  const { data, error } = await sb.rpc("hybrid_search_jobs", {
    query_text: "Next.js TypeScript PostgreSQL",
    query_embedding: emb,
    match_count: 3,
  });

  if (error) {
    console.error("RPC Error:", error);
    return;
  }

  const jobs = data as HybridSearchResult[];
  console.log(`   Found ${jobs.length} matched jobs:`);
  jobs.forEach((j) => {
    console.log(`   - ${j.title} (Sim: ${(j.similarity * 100).toFixed(1)}%, RRF: ${j.rrf_score.toFixed(4)})`);
  });

  console.log("3. Generating fit analysis via Gemini LLM...");
  const explanations = await explainJobMatches(resume, jobs);
  console.log("   Explanations received for:", Object.keys(explanations).length, "jobs.");
  const firstId = jobs[0].id;
  if (explanations[firstId]) {
    console.log("   Sample Top Fit Analysis:");
    console.log("   - Score:", explanations[firstId].matchScore);
    console.log("   - Summary:", explanations[firstId].fitSummary);
    console.log("   - Matching Skills:", explanations[firstId].matchingSkills.join(", "));
    console.log("   - Missing Skills:", explanations[firstId].missingSkills.join(", "));
  }

  console.log("\n ALL SYSTEMS OPERATIONAL AND INTEGRATED!");
}

testPipeline().catch(console.error);
