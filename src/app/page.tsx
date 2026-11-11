"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { getPublicSupabase } from "@/lib/supabase";
import {
  EnrichedJobMatch,
  MatchResponseBody,
  EnrichedCandidateMatch,
  CandidateMatchResponseBody,
  ResumeUploadResponseBody,
} from "@/types/match";
import { AppRole } from "@/types/database";

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

const SAMPLE_JDS = {
  fullstack: `Senior Full-Stack Engineer (Next.js & PostgreSQL)
Location: Remote | Experience: 4+ Years

We are seeking a Senior Full-Stack Engineer to architect and build our next-generation SaaS product. 
Key Responsibilities:
- Build performant, accessible web applications using Next.js 15 (App Router), React, and TypeScript.
- Optimize relational database queries, triggers, and full-text search indexes in PostgreSQL.
- Architect clean, type-safe REST APIs and server route handlers.
- Collaborate with product designers using Tailwind CSS.

Requirements:
- Strong proficiency in TypeScript, React, Next.js, and Node.js.
- Deep hands-on experience with PostgreSQL, SQL indexing, and database optimizations.
- Familiarity with vector search, embeddings, or Docker is a strong plus.`,

  ai_engineer: `AI / Machine Learning Systems Engineer (RAG & LLMs)
Location: Remote | Experience: 3+ Years

Join our core AI team to develop production retrieval-augmented generation (RAG) systems and LLM agent pipelines.
Key Responsibilities:
- Design and deploy scalable semantic search pipelines using vector databases and pgvector.
- Integrate embedding models, prompt engineering, and structured LLM reasoning.
- Build Python microservices using FastAPI and Docker.

Requirements:
- Deep experience in Python, PyTorch, LangChain, or LlamaIndex.
- Hands-on knowledge of vector embeddings, cosine distance, and hybrid search.
- Experience with Gemini API or OpenAI API integration.`,
};

export default function HireMatchPage() {
  const supabase = getPublicSupabase();

  // Auth & RBAC State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authFormMode, setAuthFormMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRoleChoice, setAuthRoleChoice] = useState<AppRole>("candidate");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Candidate Mode State
  const [resumeText, setResumeText] = useState("");
  const [jobResults, setJobResults] = useState<EnrichedJobMatch[] | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLatency, setJobLatency] = useState<number | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  // Recruiter Mode State
  const [recruiterTab, setRecruiterTab] = useState<"search" | "upload">("search");
  const [jdText, setJdText] = useState("");
  const [candidateResults, setCandidateResults] = useState<EnrichedCandidateMatch[] | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [candidateLatency, setCandidateLatency] = useState<number | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Recruiter PDF Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Listen to Supabase Auth State
  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setCurrentUser(session.user);
          const role = (session.user.user_metadata?.role as AppRole) || "candidate";
          setCurrentRole(role);
        }
      } catch (err) {
        console.error("Auth session load error:", err);
      } finally {
        setAuthLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(session.user);
        const role = (session.user.user_metadata?.role as AppRole) || "candidate";
        setCurrentRole(role);
      } else {
        setCurrentUser(null);
        setCurrentRole(null);
      }
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Handle Sign In / Sign Up
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) return;

    setIsSubmittingAuth(true);
    setAuthError(null);
    setAuthSuccessMsg(null);

    try {
      if (authFormMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: {
            data: {
              role: authRoleChoice,
            },
          },
        });

        if (error) throw error;

        if (data.session) {
          setCurrentUser(data.session.user);
          setCurrentRole(authRoleChoice);
        } else {
          setAuthSuccessMsg("Account created! If confirmation is required, please check your email, or sign in.");
        }
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw error;

        if (data.user) {
          setCurrentUser(data.user);
          const role = (data.user.user_metadata?.role as AppRole) || "candidate";
          setCurrentRole(role);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(message);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Quick Demo Login Helper
  const handleDemoLogin = async (role: AppRole) => {
    setIsSubmittingAuth(true);
    setAuthError(null);
    setAuthSuccessMsg(null);

    const demoEmail = role === "recruiter" ? "demo-recruiter@hirematch.io" : "demo-candidate@hirematch.io";
    const demoPassword = "DemoPassword123!";

    try {
      // Try signing in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (signInError) {
        // If demo account doesn't exist yet, automatically create it
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: demoEmail,
          password: demoPassword,
          options: { data: { role } },
        });

        if (signUpError) throw signUpError;
        if (signUpData.user) {
          setCurrentUser(signUpData.user);
          setCurrentRole(role);
        }
      } else if (signInData.user) {
        setCurrentUser(signInData.user);
        setCurrentRole(role);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to launch demo account");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCurrentRole(null);
    setJobResults(null);
    setCandidateResults(null);
  };

  // Word counters
  const resumeWordCount = resumeText.trim().length === 0 ? 0 : resumeText.trim().split(/\s+/).length;
  const jdWordCount = jdText.trim().length === 0 ? 0 : jdText.trim().split(/\s+/).length;

  // Handler: Candidate search (Resume -> Jobs)
  const handleJobSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText.trim()) return;

    setJobLoading(true);
    setJobError(null);
    setJobResults(null);

    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, limit: 10 }),
      });

      const json: MatchResponseBody = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || `Status ${response.status}`);
      }

      setJobResults(json.data);
      setJobLatency(json.queryTimeMs);
    } catch (err: unknown) {
      setJobError(err instanceof Error ? err.message : "Failed to find matching jobs");
    } finally {
      setJobLoading(false);
    }
  };

  // Handler: Recruiter search (JD -> Candidates)
  const handleCandidateSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jdText.trim()) return;

    setCandidateLoading(true);
    setCandidateError(null);
    setCandidateResults(null);

    try {
      const response = await fetch("/api/matches/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jdText, limit: 10 }),
      });

      const json: CandidateMatchResponseBody = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || `Status ${response.status}`);
      }

      setCandidateResults(json.data);
      setCandidateLatency(json.queryTimeMs);
    } catch (err: unknown) {
      setCandidateError(err instanceof Error ? err.message : "Failed to rank candidates");
    } finally {
      setCandidateLoading(false);
    }
  };

  // Handler: PDF file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
      setSelectedFiles((prev) => [...prev, ...filesArray]);
      setUploadStatus(null);
      setUploadError(null);
    }
  };

  // Handler: PDF Upload submission
  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadStatus("Extracting text and generating embeddings...");
    setUploadError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData,
      });

      const json: ResumeUploadResponseBody = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || `Upload failed with status ${response.status}`);
      }

      setUploadStatus(`🎉 Successfully parsed, vectorized, and indexed ${json.count} candidate resume(s)!`);
      setSelectedFiles([]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload and index PDF resumes");
      setUploadStatus(null);
    } finally {
      setIsUploading(false);
    }
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    if (score >= 60) return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    return "bg-rose-500/10 text-rose-400 border-rose-500/30";
  };

  const getVerdictBadge = (verdict: "Strong Interview" | "Consider" | "Reject") => {
    if (verdict === "Strong Interview") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
    if (verdict === "Consider") return "bg-amber-500/15 text-amber-300 border-amber-500/40";
    return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  };

  // Loading state while checking auth
  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center space-x-3 text-sm">
          <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Authenticating HireMatch...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Header Bar */}
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

          {/* User Status / Sign Out Header */}
          {currentUser && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    currentRole === "recruiter"
                      ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                      : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  {currentRole === "recruiter" ? "🏢 Recruiter" : "👤 Candidate"}
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">{currentUser.email}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ============================================================== */}
      {/* 1. UNAUTHENTICATED STATE: RBAC AUTH GATEWAY                    */}
      {/* ============================================================== */}
      {!currentUser && (
        <div className="max-w-md mx-auto px-4 py-16">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Welcome to HireMatch</h1>
            <p className="mt-2 text-xs text-slate-400">
              Sign in with your designated role to access the candidate matching engine or recruiter sourcing suite.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
            {/* Mode Tabs */}
            <div className="flex border-b border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthFormMode("signin");
                  setAuthError(null);
                }}
                className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition ${
                  authFormMode === "signin"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthFormMode("signup");
                  setAuthError(null);
                }}
                className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition ${
                  authFormMode === "signup"
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              {/* Role Selector on Sign Up */}
              {authFormMode === "signup" && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">Select Your Role</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition ${
                        authRoleChoice === "candidate"
                          ? "bg-indigo-600/10 border-indigo-500 text-indigo-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="candidate"
                        checked={authRoleChoice === "candidate"}
                        onChange={() => setAuthRoleChoice("candidate")}
                        className="hidden"
                      />
                      <span className="text-base mb-1">👤</span>
                      <span className="text-xs font-semibold">Candidate</span>
                      <span className="text-[10px] text-slate-500 text-center mt-0.5">Find matching jobs</span>
                    </label>

                    <label
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition ${
                        authRoleChoice === "recruiter"
                          ? "bg-purple-600/10 border-purple-500 text-purple-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="recruiter"
                        checked={authRoleChoice === "recruiter"}
                        onChange={() => setAuthRoleChoice("recruiter")}
                        className="hidden"
                      />
                      <span className="text-base mb-1">🏢</span>
                      <span className="text-xs font-semibold">Recruiter</span>
                      <span className="text-[10px] text-slate-500 text-center mt-0.5">Upload PDFs & rank</span>
                    </label>
                  </div>
                </div>
              )}

              {authError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {authError}
                </div>
              )}

              {authSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                  {authSuccessMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full py-2.5 rounded-xl font-medium text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 transition active:scale-[0.98]"
              >
                {isSubmittingAuth
                  ? "Processing..."
                  : authFormMode === "signin"
                  ? "Sign In"
                  : `Create ${authRoleChoice === "recruiter" ? "Recruiter" : "Candidate"} Account`}
              </button>
            </form>

            {/* Quick Demo Access Buttons */}
            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <span className="text-[11px] text-slate-500 block mb-2.5">Or explore with instant demo accounts:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDemoLogin("candidate")}
                  disabled={isSubmittingAuth}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[11px] font-medium transition"
                >
                  ⚡ Demo Candidate
                </button>
                <button
                  type="button"
                  onClick={() => handleDemoLogin("recruiter")}
                  disabled={isSubmittingAuth}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 text-[11px] font-medium transition"
                >
                  ⚡ Demo Recruiter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. AUTHENTICATED: CANDIDATE MODE ONLY                          */}
      {/* ============================================================== */}
      {currentUser && currentRole === "candidate" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Match Your Resume to Careers
            </h1>
            <p className="mt-2 text-base text-slate-400 max-w-3xl">
              Paste your resume below. Our engine combines <span className="text-slate-200 font-medium">PostgreSQL GIN Full-Text Search</span> with <span className="text-slate-200 font-medium">pgvector Cosine Similarity</span> via Reciprocal Rank Fusion (RRF), followed by Gemini fit analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Resume Input */}
            <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
              <div className="flex items-center justify-between mb-3">
                <label htmlFor="resume" className="text-sm font-semibold text-slate-200 flex items-center">
                  <span>Resume Content</span>
                  <span className="ml-2 text-xs font-normal text-slate-500">({resumeWordCount} words)</span>
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

              <form onSubmit={handleJobSearch}>
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
                    disabled={jobLoading || !resumeText.trim()}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition active:scale-[0.98]"
                  >
                    {jobLoading ? "Matching & Explaining..." : "Find Matches"}
                  </button>
                </div>
              </form>

              {jobError && (
                <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  <strong className="font-semibold block mb-1">Error:</strong>
                  {jobError}
                </div>
              )}
            </div>

            {/* Right Column: Ranked Jobs */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>{jobResults ? `Found ${jobResults.length} matched positions` : "Awaiting candidate resume input..."}</span>
                {jobLatency !== null && <span className="font-mono text-indigo-400">Total Latency: {jobLatency}ms</span>}
              </div>

              {!jobLoading && !jobResults && (
                <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 bg-slate-900/20">
                  <div className="h-12 w-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-3 text-lg">
                    🔍
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">No Search Initiated</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Paste resume text or click one of the quick presets on the left, then click &ldquo;Find Matches&rdquo;.
                  </p>
                </div>
              )}

              {jobLoading && (
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

              {jobResults && jobResults.map((job, index) => {
                const isExpanded = expandedJobId === job.id;
                const { explanation } = job;

                return (
                  <article
                    key={job.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 transition shadow-lg"
                  >
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

                      <div
                        className={`flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl border font-bold ${getScoreBadgeColor(
                          explanation.matchScore
                        )}`}
                      >
                        <span className="text-xl font-extrabold leading-none">{explanation.matchScore}%</span>
                        <span className="text-[10px] tracking-wider uppercase opacity-80 mt-0.5">Match</span>
                      </div>
                    </div>

                    <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                      <span className="font-semibold text-indigo-400 block mb-1">AI Assessment:</span>
                      {explanation.fitSummary}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                        <span className="font-semibold text-emerald-400 block mb-2">
                          Matching Qualifications ({explanation.matchingSkills.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {explanation.matchingSkills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

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

                    {explanation.recommendation && (
                      <div className="mt-3 text-xs text-slate-400 flex items-start">
                        <span className="text-indigo-400 font-semibold mr-1.5 shrink-0">Recommendation:</span>
                        <span>{explanation.recommendation}</span>
                      </div>
                    )}

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
      )}

      {/* ============================================================== */}
      {/* 3. AUTHENTICATED: RECRUITER MODE ONLY                          */}
      {/* ============================================================== */}
      {currentUser && currentRole === "recruiter" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Recruiter Talent Sourcing & PDF Ingestion
            </h1>
            <p className="mt-2 text-base text-slate-400 max-w-3xl">
              Upload candidate resumes directly in <span className="text-slate-200 font-medium">PDF format</span>, or paste a Job Description to rank all indexed applicants using in-database Hybrid Search and Gemini candidate evaluations.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Dual Tabs (Search Candidates OR Upload PDF Resumes) */}
            <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-24">
              {/* Sub-tab Navigation */}
              <div className="flex border-b border-slate-800 mb-5">
                <button
                  type="button"
                  onClick={() => setRecruiterTab("search")}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    recruiterTab === "search"
                      ? "border-purple-500 text-purple-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  🔍 Match Candidates (JD)
                </button>
                <button
                  type="button"
                  onClick={() => setRecruiterTab("upload")}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                    recruiterTab === "upload"
                      ? "border-purple-500 text-purple-400"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  📤 Bulk Upload Resumes (PDF)
                </button>
              </div>

              {/* Sub-Tab 1: Screen Candidates with JD */}
              {recruiterTab === "search" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label htmlFor="jd" className="text-sm font-semibold text-slate-200">
                      Job Description <span className="text-xs text-slate-500 font-normal">({jdWordCount} words)</span>
                    </label>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-500">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setJdText(SAMPLE_JDS.fullstack)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 transition"
                      >
                        Full-Stack
                      </button>
                      <button
                        type="button"
                        onClick={() => setJdText(SAMPLE_JDS.ai_engineer)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 transition"
                      >
                        AI / ML
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleCandidateSearch}>
                    <textarea
                      id="jd"
                      rows={13}
                      value={jdText}
                      onChange={(e) => setJdText(e.target.value)}
                      placeholder="Paste the target Job Description (including responsibilities and required skills)..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition resize-y font-mono"
                      required
                    />

                    <div className="mt-4 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setJdText("")}
                        className="text-xs text-slate-500 hover:text-slate-300 transition"
                      >
                        Clear Text
                      </button>
                      <button
                        type="submit"
                        disabled={candidateLoading || !jdText.trim()}
                        className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/25 transition active:scale-[0.98]"
                      >
                        {candidateLoading ? "Ranking Candidates..." : "Rank Candidates"}
                      </button>
                    </div>
                  </form>

                  {candidateError && (
                    <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      <strong className="font-semibold block mb-1">Error:</strong>
                      {candidateError}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Drag & Drop PDF Resume Ingestion */}
              {recruiterTab === "upload" && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-1">Upload Candidate Resumes (.pdf)</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Select one or multiple PDF resumes. Text will be extracted, converted into 768-D vectors, and indexed into Supabase automatically.
                  </p>

                  <form onSubmit={handlePdfUpload}>
                    {/* PDF Dropzone */}
                    <label
                      htmlFor="pdf-upload"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-purple-500/50 rounded-xl p-6 cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition group"
                    >
                      <div className="h-10 w-10 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                        📄
                      </div>
                      <span className="text-xs font-semibold text-slate-300">
                        Click to browse or drop PDF resumes here
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1">Accepts multiple .pdf files</span>
                      <input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>

                    {/* Selected Files List */}
                    {selectedFiles.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1">
                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                          <span>Selected ({selectedFiles.length} files):</span>
                          <button
                            type="button"
                            onClick={() => setSelectedFiles([])}
                            className="text-rose-400 hover:underline"
                          >
                            Clear all
                          </button>
                        </div>
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                          >
                            <span className="truncate max-w-[200px] text-slate-300 font-mono text-[11px]">
                              {file.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-5">
                      <button
                        type="submit"
                        disabled={isUploading || selectedFiles.length === 0}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-medium text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-600/25 transition active:scale-[0.98]"
                      >
                        {isUploading ? "Extracting & Vectorizing..." : `Upload & Index ${selectedFiles.length} Resume(s)`}
                      </button>
                    </div>
                  </form>

                  {uploadStatus && (
                    <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
                      {uploadStatus}
                    </div>
                  )}

                  {uploadError && (
                    <div className="mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                      {uploadError}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Ranked Candidates */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  {candidateResults
                    ? `Found ${candidateResults.length} matching candidates`
                    : "Paste a Job Description to evaluate candidate pool..."}
                </span>
                {candidateLatency !== null && (
                  <span className="font-mono text-purple-400">Total Latency: {candidateLatency}ms</span>
                )}
              </div>

              {!candidateLoading && !candidateResults && (
                <div className="border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 bg-slate-900/20">
                  <div className="h-12 w-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-3 text-lg">
                    👥
                  </div>
                  <h3 className="text-sm font-semibold text-slate-300">No Candidates Evaluated Yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Paste a Job Description on the left, or upload new candidate PDFs via the &ldquo;Bulk Upload&rdquo; tab.
                  </p>
                </div>
              )}

              {candidateLoading && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="h-5 bg-slate-800 rounded w-1/3"></div>
                        <div className="h-8 bg-slate-800 rounded-full w-24"></div>
                      </div>
                      <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                      <div className="h-16 bg-slate-800/60 rounded"></div>
                    </div>
                  ))}
                </div>
              )}

              {candidateResults && candidateResults.length === 0 && (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                  No candidates found in the database. Use the &ldquo;Bulk Upload Resumes (PDF)&rdquo; tab on the left to index candidate PDFs first!
                </div>
              )}

              {candidateResults && candidateResults.map((cand, index) => {
                const isExpanded = expandedCandidateId === cand.id;
                const { explanation } = cand;

                return (
                  <article
                    key={cand.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-6 transition shadow-lg"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                          <h2 className="text-lg font-bold text-white tracking-tight">
                            {explanation.candidateName || cand.candidate_name}
                          </h2>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getVerdictBadge(
                              explanation.hiringVerdict
                            )}`}
                          >
                            {explanation.hiringVerdict}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-slate-500 font-mono">
                            Sim: {(cand.similarity * 100).toFixed(1)}% | RRF: {cand.rrf_score.toFixed(4)}
                          </span>
                        </div>
                      </div>

                      {/* Score Badge */}
                      <div
                        className={`flex flex-col items-center justify-center px-3.5 py-1.5 rounded-xl border font-bold ${getScoreBadgeColor(
                          explanation.matchScore
                        )}`}
                      >
                        <span className="text-xl font-extrabold leading-none">{explanation.matchScore}%</span>
                        <span className="text-[10px] tracking-wider uppercase opacity-80 mt-0.5">Match</span>
                      </div>
                    </div>

                    {/* AI Recruiter Fit Summary */}
                    <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 leading-relaxed">
                      <span className="font-semibold text-purple-400 block mb-1">Recruiter Assessment:</span>
                      {explanation.fitSummary}
                    </div>

                    {/* Skills Comparison */}
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/20">
                        <span className="font-semibold text-emerald-400 block mb-2">
                          Matched Qualifications ({explanation.matchedQualifications.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {explanation.matchedQualifications.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/20">
                        <span className="font-semibold text-amber-400 block mb-2">
                          Critical Missing Gaps ({explanation.criticalMissingSkills.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {explanation.criticalMissingSkills.length > 0 ? (
                            explanation.criticalMissingSkills.map((gap, gIdx) => (
                              <span
                                key={gIdx}
                                className="px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/30"
                              >
                                {gap}
                              </span>
                            ))
                          ) : (
                            <span className="text-emerald-400/80 italic">No critical gaps detected</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Interview Questions Probe */}
                    {explanation.interviewQuestions && explanation.interviewQuestions.length > 0 && (
                      <div className="mt-3.5 p-3 rounded-lg bg-purple-950/20 border border-purple-500/20 text-xs">
                        <span className="font-semibold text-purple-300 block mb-1.5">
                          Suggested Technical Interview Questions:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                          {explanation.interviewQuestions.map((q, qIdx) => (
                            <li key={qIdx}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Expandable Raw Resume Text */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedCandidateId(isExpanded ? null : cand.id)}
                        className="text-slate-400 hover:text-purple-300 transition flex items-center"
                      >
                        <span>{isExpanded ? "Hide Full Resume Text" : "View Full Resume Text"}</span>
                        <span className="ml-1">{isExpanded ? "▲" : "▼"}</span>
                      </button>
                      <span className="text-slate-600 font-mono text-[11px]">ID: {cand.id.slice(0, 8)}...</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                        {cand.raw_text}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
