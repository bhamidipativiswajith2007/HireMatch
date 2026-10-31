"use client";

import { useState } from "react";
import { EnrichedJobMatch, MatchResponseBody } from "@/types/match";

const SAMPLE_RESUMES = {
  fullstack: `Alex Mercer
Senior Full-Stack Engineer | 6+ Years Experience
Email: alex.mercer@example.com | GitHub: github.com/alexmercer

SUMMARY:
Results-driven software engineer specialized in building high-performance web applications using TypeScript, Next.js (App Router), React, and Node.js. Experienced in designing relational databases with PostgreSQL, architecting RESTful and GraphQL APIs, and deploying modern frontend architectures with Tailwind CSS. Familiar with Docker, Redis caching, and CI/CD pipelines. Looking to apply full-stack expertise to scalable SaaS platforms.

CORE SKILLS:
- Languages: TypeScript, JavaScript, SQL, HTML5/CSS3
- Frameworks & Libraries: Next.js, React 19, Node.js, Express, Tailwind CSS
- Databases & Tools: PostgreSQL, Supabase, Prisma ORM, Redis, Git, Docker, Jest

EXPERIENCE:
Staff Software Engineer — TechSphere Solutions (2022 - Present)
- Architected a multi-tenant Next.js dashboard handling 50k+ daily active users, reducing LCP by 42%.
- Designed PostgreSQL schema with full-text search indexing, improving query response times by 65%.
- Mentored 5 junior and mid-level engineers in strict TypeScript patterns and automated test suites.`,

  ai_engineer: `Dr. Maya Lin
Machine Learning Engineer & RAG Specialist
Email: maya.lin@example.com | Kaggle Grandmaster

SUMMARY:
AI Engineer with 5+ years of experience developing production-grade machine learning pipelines, retrieval-augmented generation (RAG) systems, and LLM orchestration. Deep expertise in Python, PyTorch, vector databases (pgvector, Pinecone), LangChain, and embedding models. Passionate about semantic search and prompt engineering.

CORE SKILLS:
- Languages: Python, C++, SQL
- AI/ML: PyTorch, Hugging Face, LangChain, LlamaIndex, Gemini API, OpenAI API
- Vector DBs: pgvector, Supabase Vector, ChromaDB, Qdrant
- Infrastructure: Docker, FastAPI, AWS SageMaker, Git

EXPERIENCE:
Senior AI Systems Engineer — Cognition Labs (2021 - Present)
- Built enterprise hybrid search pipelines utilizing Reciprocal Rank Fusion over 2M+ research papers.
- Deployed fine-tuned embedding models and LLM agent workflows using FastAPI and pgvector.`,
};

export default function HireMatchPage() {
  const [resumeText, setResumeText] = useState("");
  const [results, setResults] = useState<EnrichedJobMatch[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryTimeMs, setQueryTimeMs] = useState<number | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const wordCount = resumeText.trim().length === 0 ? 0 : resumeText.trim().split(/\s+/).length;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, limit: 10 }),
      });

      const json: MatchResponseBody = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || `Request failed with status ${response.status}`);
      }

      setResults(json.data);
      setQueryTimeMs(json.queryTimeMs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to find matching jobs";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (score >= 60) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              HM
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">HireMatch</span>
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Hybrid AI
              </span>
            </div>
          </div>

        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Intro */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Semantic Job Matching & Fit Explanation
          </h1>
          <p className="mt-2 text-base text-slate-400 max-w-3xl">
            Paste candidate resume text below. Our engine combines <span className="text-slate-200 font-medium">PostgreSQL Full-Text Search</span> with <span className="text-slate-200 font-medium">pgvector Cosine Similarity</span> via Reciprocal Rank Fusion (RRF), followed by Gemini LLM gap analysis.
          </p>
        </div>

        {/* 2-Column Responsive Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Input Panel */}
          <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="resume" className="text-sm font-semibold text-slate-200 flex items-center">
                <span>Resume Content</span>
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({wordCount} words)
                </span>
              </label>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-slate-500">Presets:</span>
                <button
                  type="button"
                  onClick={() => setResumeText(SAMPLE_RESUMES.fullstack)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 transition"
                >
                  Full-Stack
                </button>
                <button
                  type="button"
                  onClick={() => setResumeText(SAMPLE_RESUMES.ai_engineer)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition"
                >
                  AI / ML
                </button>
              </div>
            </div>

            <form onSubmit={handleSearch}>
              <textarea
                id="resume"
                rows={14}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste plain text resume here (including skills, summary, and work experience)..."
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition resize-y font-mono"
                required
              />

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setResumeText("")}
                  className="text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  Clear Text
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !resumeText.trim()}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition active:scale-[0.98]"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      Matching & Explaining...
                    </>
                  ) : (
                    "Find Matches"
                  )}
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <strong className="font-semibold block mb-1">Error:</strong>
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Search Results */}
          <div className="lg:col-span-7 space-y-4">
            {/* Status / Query Summary Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                {results ? `Found ${results.length} matched positions` : "Awaiting candidate resume input..."}
              </span>
              {queryTimeMs !== null && (
                <span className="font-mono text-indigo-400">Total Latency: {queryTimeMs}ms</span>
              )}
            </div>

            {/* Empty State */}
            {!isLoading && !results && (
              <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 bg-slate-900/20">
                <div className="h-12 w-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-3">
                  🔍
                </div>
                <h3 className="text-sm font-semibold text-slate-300">No Search Initiated</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Paste resume text or click one of the quick presets on the left, then click &ldquo;Find Matches&rdquo;.
                </p>
              </div>
            )}

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="h-5 bg-slate-800 rounded w-1/3"></div>
                      <div className="h-8 bg-slate-800 rounded-full w-16"></div>
                    </div>
                    <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                    <div className="h-16 bg-slate-800/60 rounded"></div>
                  </div>
                ))}
              </div>
            )}

            {/* Results List */}
            {results && results.length === 0 && (
              <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400">
                No matching jobs found in the database. Try ingesting job listings via the Phase 2 script.
              </div>
            )}

            {results && results.map((job, index) => {
              const isExpanded = expandedJobId === job.id;
              const { explanation } = job;

              return (
                <article
                  key={job.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 transition shadow-lg"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                        <h2 className="text-lg font-bold text-white tracking-tight">{job.title}</h2>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {job.category}
                        </span>
                        <span className="text-xs text-slate-500 font-mono">
                          Sim: {(job.similarity * 100).toFixed(1)}% | RRF: {job.rrf_score.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {/* Match Score Badge */}
                    <div
                      className={`flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl border font-bold ${getScoreBadgeColor(
                        explanation.matchScore
                      )}`}
                    >
                      <span className="text-xl font-extrabold leading-none">{explanation.matchScore}%</span>
                      <span className="text-[10px] tracking-wider uppercase opacity-80 mt-0.5">Match</span>
                    </div>
                  </div>

                  {/* Fit Summary by Gemini */}
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                    <span className="font-semibold text-indigo-400 block mb-1">AI Assessment:</span>
                    {explanation.fitSummary}
                  </div>

                  {/* Skills Comparison */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Matching Skills */}
                    <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                      <span className="font-semibold text-emerald-400 block mb-2">
                        Matching Qualifications ({explanation.matchingSkills.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {explanation.matchingSkills.length > 0 ? (
                          explanation.matchingSkills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic">None explicitly identified</span>
                        )}
                      </div>
                    </div>

                    {/* Skill Gaps */}
                    <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20">
                      <span className="font-semibold text-amber-400 block mb-2">
                        Skill Gaps to Address ({explanation.missingSkills.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {explanation.missingSkills.length > 0 ? (
                          explanation.missingSkills.map((gap, gIdx) => (
                            <span
                              key={gIdx}
                              className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30"
                            >
                              {gap}
                            </span>
                          ))
                        ) : (
                          <span className="text-emerald-400/80 italic">No significant gaps detected</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recommendation */}
                  {explanation.recommendation && (
                    <div className="mt-3 text-xs text-slate-400 flex items-start">
                      <span className="text-indigo-400 font-semibold mr-1.5 shrink-0">Recommendation:</span>
                      <span>{explanation.recommendation}</span>
                    </div>
                  )}

                  {/* Expand Job Description Toggle */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      className="text-slate-400 hover:text-indigo-300 transition flex items-center"
                    >
                      <span>{isExpanded ? "Hide Full Job Description" : "View Full Job Description"}</span>
                      <span className="ml-1">{isExpanded ? "▲" : "▼"}</span>
                    </button>
                    <span className="text-slate-600 font-mono text-[11px]">ID: {job.id.slice(0, 8)}...</span>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {job.description}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
