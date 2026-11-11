# HireMatch 🎯
### AI-Powered Dual-Mode Talent Intelligence & Explainable Hybrid RAG Platform

HireMatch is an enterprise-grade **Hybrid RAG (Retrieval-Augmented Generation)** talent intelligence platform built on Next.js 15, PostgreSQL (`pgvector`), and Google Gemini. 

It provides an end-to-end, bi-directional matching engine with strict **Role-Based Access Control (RBAC)**:
1. **Candidate Mode:** Candidates input or paste their resume to discover and rank best-matching jobs from PostgreSQL using Hybrid Search (pgvector HNSW + GIN tsvector + RRF) and receive an AI-generated fit assessment with concrete skill gap breakdowns.
2. **Recruiter Mode:** Recruiters drag-and-drop batch PDF resumes for server-side parsing (`unpdf`) and 768-D vectorization, then paste a Job Description (JD) to retrieve top candidates with an anti-hallucination hiring verdict (`Strong Interview`, `Consider`, `Reject`) and tailored interview questions.

---

## ⚡ Key Highlights

- **Dual-Role RBAC Architecture:** Role-locked experience powered by Supabase Auth and PostgreSQL triggers (`auth.users` $\rightarrow$ `public.profiles`). Candidates only access candidate matching; recruiters only access JD screening and resume ingestion.
- **Bi-Directional Hybrid Search:**
  - **Candidate $\rightarrow$ Jobs:** Queries `jobs` using dense 768-D cosine similarity and sparse `tsvector` full-text search fused with **Reciprocal Rank Fusion (RRF)**.
  - **Recruiter $\rightarrow$ Resumes:** Queries `resumes` using `hybrid_search_resumes` RPC, ranking ingested resumes against the recruiter's Job Description.
- **Direct PDF Resume Drag-and-Drop Ingestion:** In-memory, multi-file PDF resume text extraction via pure-JavaScript `unpdf` (Mozilla PDF.js engine), safe regex skill identification, and batch 768-D vector generation (`gemini-embedding-001`).
- **Grounded Anti-Hallucination Reasoning:** Powered by `gemini-3.8-flash` at deterministic temperature `0.0`. Strict verbatim negative constraints prevent the model from fabricating missing skills or criteria not present in the source JD or resume.
- **Automated Database Triggers:** PostgreSQL `BEFORE INSERT OR UPDATE` triggers automatically generate weighted lexemes (`'A'` Candidate Name, `'B'` Skills array, `'C'` Raw text).
- **1-Click Demo Accounts:** Immediate evaluation access with built-in `Demo Candidate` and `Demo Recruiter` buttons.

---

## 🏗️ Architecture & Pipeline Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          HIREMATCH ARCHITECTURE                                        │
│                                                                                                        │
│  [AUTHENTICATION & RBAC GATEWAY]                                                                       │
│   Supabase Auth (auth.users) ──► Postgres Trigger (handle_new_user) ──► public.profiles (role)         │
│                                                                                                        │
│  ┌───────────────────────────────────────────────┬──────────────────────────────────────────────────┐  │
│  │ 👤 CANDIDATE MODE                             │ 👔 RECRUITER MODE                                │  │
│  │ (Role: 'candidate')                           │ (Role: 'recruiter')                              │  │
│  │                                               │                                                  │  │
│  │ 1. Resume Input                               │ 1. PDF Resume Batch Ingestion                    │  │
│  │    Candidate pastes resume text               │    Drag-and-drop PDF files                       │  │
│  │                     │                         │    ├── In-memory text extraction (unpdf)         │  │
│  │                     ▼                         │    ├── Gemini 768-D batch vectorization          │  │
│  │ 2. Vectorization & Query                      │    └── Stored in PostgreSQL `resumes` table      │  │
│  │    Query Vector (gemini-embedding-001, 768-D) │                     │                            │  │
│  │                     │                         │                     ▼                            │  │
│  │                     ▼                         │ 2. Job Description Screening                     │  │
│  │ 3. Hybrid Search over `jobs`                  │    Recruiter pastes Target JD                    │  │
│  │    ├── HNSW Cosine Sim (vector_cosine_ops)    │    ├── Dense search: `resumes.embedding`         │  │
│  │    ├── GIN tsvector (ts_rank_cd)              │    ├── Sparse search: `resumes.search_tsv`       │  │
│  │    └── Reciprocal Rank Fusion (RRF k=60)      │    └── Reciprocal Rank Fusion (RRF k=60)         │  │
│  │                     │                         │                     │                            │  │
│  │                     ▼                         │                     ▼                            │  │
│  │ 4. Explainable Fit Reasoning                  │ 3. Grounded Candidate Evaluation                 │  │
│  │    Gemini 3.8 Flash (JSON schema)             │    Gemini 3.8 Flash (Temp 0.0, Grounded)         │  │
│  │    ├── Match Percentage (0-100%)              │    ├── Fit Score & Hiring Verdict                │  │
│  │    ├── Matching Qualifications                │    ├── Matched vs Missing Skills (Verbatim)      │  │
│  │    └── Skill Gaps & Actionable Advice         │    └── 2 Targeted Technical Interview Questions   │  │
│  └───────────────────────────────────────────────┴──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) | Full-stack architecture, React 19 UI, server route handlers |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | End-to-end static type safety from database to UI |
| **Database & Auth** | [Supabase](https://supabase.com/) / [PostgreSQL](https://www.postgresql.org/) | Relational storage, Auth, RLS, triggers, stored procedures (RPC) |
| **Vector Search** | [pgvector](https://github.com/pgvector/pgvector) | 768-D vector storage with HNSW index for cosine distance |
| **AI / Embeddings** | [Google Gemini API](https://ai.google.dev/) | `gemini-embedding-001` (768-D) & `gemini-3.8-flash` (deterministic reasoning) |
| **PDF Extraction** | [unpdf](https://github.com/unjs/unpdf) | Pure JavaScript PDF parsing (no node-gyp or canvas native dependencies) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Responsive, modern dark-mode interface with Lucide icons |
| **Validation** | [Zod](https://zod.dev/) | Strict runtime request body validation |

---

## 📁 Repository Structure

```
.
├── sample-resumes/             # Sample candidate PDFs for instant drag-and-drop testing
├── scripts/
│   ├── generate-sample-pdfs.ts # Helper script to create test mock PDFs (optional dev utility)
│   ├── ingest-jobs.ts          # Standalone CLI ingestion pipeline for jobs CSV
│   ├── sample-jobs.csv         # Sample dataset with diverse technical job postings
│   └── test-pipeline.ts        # Automated integration test suite
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── matches/
│   │   │   │   ├── candidates/
│   │   │   │   │   └── route.ts  # Recruiter endpoint: JD -> hybrid resume search + Gemini verdict
│   │   │   │   └── route.ts      # Candidate endpoint: Resume -> hybrid job search + Gemini breakdown
│   │   │   └── resumes/
│   │   │       └── upload/
│   │   │           └── route.ts  # Recruiter endpoint: Multi-PDF upload + unpdf extraction + vectorization
│   │   ├── globals.css         # Tailwind directives & design tokens
│   │   ├── layout.tsx          # Root layout and metadata
│   │   └── page.tsx            # Full RBAC Auth Gateway + Candidate Mode + Recruiter Mode UI
│   ├── lib/
│   │   ├── gemini.ts           # Gemini SDK setup, 768-D embeddings, and grounded prompts
│   │   └── supabase.ts         # Lazy singleton Supabase clients (Anon + Service Role)
│   └── types/
│       ├── database.ts         # Supabase PostgreSQL schema, app_role ENUM, and RPC types
│       └── match.ts            # API request/response and LLM explanation interfaces
├── supabase/
│   └── migrations/
│       ├── 20260101000000_hirematch_hybrid_search.sql  # Jobs table, HNSW/GIN indexes, hybrid_search_jobs RPC
│       ├── 20260102000000_resumes_hybrid_search.sql    # Resumes table, search_tsv trigger, hybrid_search_resumes RPC
│       └── 20260103000000_rbac_profiles.sql            # app_role ENUM, profiles table, auth trigger
├── .env.example                # Template for environment variables
├── package.json                # Project dependencies and npm scripts
└── tsconfig.json               # Strict TypeScript configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Supabase Account**: [Create free account](https://supabase.com/)
- **Gemini API Key**: [Get key from Google AI Studio](https://aistudio.google.com/app/apikey)

---

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/your-username/hirematch.git
cd hirematch
npm install
```

---

### Step 2: Database Setup (Supabase)

Open your project in the [Supabase Dashboard](https://supabase.com/dashboard) and run the 3 SQL migration scripts in order inside the **SQL Editor** (`>_`):

1. **Phase 1: Jobs Table & Hybrid Search**
   - Execute [`supabase/migrations/20260101000000_hirematch_hybrid_search.sql`](./supabase/migrations/20260101000000_hirematch_hybrid_search.sql)
   - Enables `vector` extension, creates `jobs` and `resumes` base tables, GIN/HNSW indexes, and `hybrid_search_jobs` RPC.
2. **Phase 2: Resumes Hybrid Search & RRF**
   - Execute [`supabase/migrations/20260102000000_resumes_hybrid_search.sql`](./supabase/migrations/20260102000000_resumes_hybrid_search.sql)
   - Adds `search_tsv` trigger, HNSW/GIN indexes on `resumes`, and creates `hybrid_search_resumes` RPC.
3. **Phase 3: RBAC Profiles & Auth Trigger**
   - Execute [`supabase/migrations/20260103000000_rbac_profiles.sql`](./supabase/migrations/20260103000000_rbac_profiles.sql)
   - Creates `app_role` ENUM (`candidate`, `recruiter`), `public.profiles` with RLS, and an automated sync trigger on `auth.users`.

---

### Step 3: Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration (Supabase Dashboard -> Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Google Gemini API Key (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIzaSy...
```

---

### Step 4: Ingest Sample Jobs

Populate your database with sample tech jobs and generate their 768-D vector embeddings:

```bash
npm run ingest
```

---

### Step 5: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Role-Based Access Control (RBAC) & Testing

The application features a secure Auth Gateway:

1. **Candidate Login:**
   - Click **Demo Candidate** (or sign up selecting *Candidate*).
   - Only **Candidate Mode** is unlocked.
   - Paste a resume or select one of the built-in presets $\rightarrow$ click **Find Matches** to view hybrid-ranked jobs with skill gap breakdowns.
2. **Recruiter Login:**
   - Click **Demo Recruiter** (or sign up selecting *Recruiter*).
   - Only **Recruiter Mode** is unlocked with two tabs:
     - **Upload Resumes:** Drag-and-drop PDF resumes (e.g., from `sample-resumes/`) $\rightarrow$ server extracts text, vectorizes, and saves to database.
     - **Screen Candidates:** Paste a Job Description $\rightarrow$ click **Screen Candidates** to retrieve top candidate matches with anti-hallucination fit assessments, verdicts, and custom interview questions.
3. **Sign Out:** Click **Sign Out** in the top navigation to return to the Auth Gateway.

---

## 🧮 Mathematical Deep Dive: Reciprocal Rank Fusion (RRF)

Standard vector search returns a cosine similarity value:
$$\text{Sim}(u, v) = \frac{u \cdot v}{\|u\| \|v\|} \in [-1, 1]$$

PostgreSQL full-text search returns an unbounded cover density rank score:
$$\text{Score}_{\text{text}} \in [0, \infty)$$

Directly normalizing and summing these scores is fragile because query lengths and term frequencies skew calibration. 

**Reciprocal Rank Fusion (RRF)** bypasses score calibration by evaluating the **relative ordinal rank position** of each document across multiple search systems:

$$\text{RRF Score}(d) = \sum_{m \in M} \frac{w_m}{k + r_m(d)}$$

Where:
- $M$: Set of retrievers (Dense Vector Search, Sparse Keyword Search).
- $w_m$: Weight factor assigned to retriever $m$ (default: `1.0`).
- $r_m(d)$: 1-based rank position of document $d$ in retriever $m$.
- $k$: Smoothing constant (default: `60`), which dampens the impact of extreme high rankings from an isolated channel.

Candidates that score well in **both** semantic understanding and exact keyword relevance dominate the fused result set.

---

## 🔌 API Reference

### 1. `POST /api/matches` (Candidate Mode)
Evaluates candidate resume text against indexed job listings.

#### Request Body
```json
{
  "resumeText": "Experienced Full-Stack Engineer with 5+ years in TypeScript, Next.js, and PostgreSQL...",
  "limit": 10
}
```

#### Response Body
```json
{
  "success": true,
  "count": 3,
  "queryTimeMs": 1150,
  "data": [
    {
      "id": "cdd6c8e2-e228-4f83-8a40-0aa32bb1b24b",
      "title": "Senior Full-Stack Engineer",
      "category": "Engineering",
      "skills": ["Next.js", "TypeScript", "PostgreSQL", "React", "Node.js", "Tailwind CSS"],
      "similarity": 0.757,
      "text_score": 0.089,
      "rrf_score": 0.0328,
      "explanation": {
        "jobId": "cdd6c8e2-e228-4f83-8a40-0aa32bb1b24b",
        "matchScore": 92,
        "fitSummary": "Direct alignment with the core tech stack: Next.js, TypeScript, React, and PostgreSQL.",
        "matchingSkills": ["Next.js", "TypeScript", "PostgreSQL", "React"],
        "missingSkills": ["Node.js", "Tailwind CSS"],
        "recommendation": "Highlight hands-on backend Node.js microservice architecture in your summary."
      }
    }
  ]
}
```

---

### 2. `POST /api/matches/candidates` (Recruiter Mode)
Evaluates a Job Description against indexed candidate resumes.

#### Request Body
```json
{
  "jobDescription": "We are seeking a Senior AI Engineer experienced in Python, PyTorch, RAG architectures, and pgvector...",
  "limit": 10
}
```

#### Response Body
```json
{
  "success": true,
  "count": 1,
  "queryTimeMs": 1320,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "candidate_name": "Marcus Vance",
      "skills": ["Python", "PyTorch", "pgvector", "LangChain", "Gemini API", "FastAPI", "Docker"],
      "similarity": 0.812,
      "text_score": 0.145,
      "rrf_score": 0.0331,
      "explanation": {
        "candidateId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "matchScore": 94,
        "verdict": "Strong Interview",
        "fitSummary": "Excellent alignment on RAG architectures, pgvector, and Python backend services.",
        "matchedQualifications": ["5+ years experience building RAG systems", "Production pgvector indexing"],
        "criticalMissing": [],
        "interviewQuestions": [
          "Describe how you handle index tuning (m and ef_construction) in pgvector under high write loads.",
          "How do you calibrate reciprocal rank fusion weights when merging sparse and dense candidate ranks?"
        ]
      }
    }
  ]
}
```

---

### 3. `POST /api/resumes/upload` (Recruiter Mode)
Multipart file upload endpoint for PDF resume parsing and vectorization.

- **Request:** `multipart/form-data` with one or more files in the `files` field.
- **Process:** In-memory extraction via `unpdf`, heuristic candidate name and skill extraction, Gemini 768-D batch vectorization, and insertion into Supabase `resumes` table.
- **Response:**
```json
{
  "success": true,
  "message": "Successfully processed and ingested 3 resumes.",
  "resumes": [
    {
      "candidateName": "Sarah Jenkins",
      "skills": ["TypeScript", "Next.js", "React", "PostgreSQL", "Node.js"],
      "textLength": 1420
    }
  ]
}
```

---

## 🛡️ Patent
By Viswajith Bhamidipati.
