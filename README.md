# HireMatch 🎯
### AI-Powered Semantic Resume Matcher & Explainable Fit Engine

HireMatch is an advanced **Hybrid RAG (Retrieval-Augmented Generation)** talent matching engine. It combines dense vector similarity with sparse full-text search directly inside PostgreSQL using `pgvector`, merges results via **Reciprocal Rank Fusion (RRF)**, and leverages Google Gemini to generate explainable candidate fit analyses with concrete skill gap breakdowns.

---

## ⚡ Key Highlights

- **Dual-Path Hybrid Search:** Combines dense semantic search (768-D vectors with pgvector HNSW) and sparse keyword search (PostgreSQL `tsvector` with GIN indexing).
- **Reciprocal Rank Fusion (RRF):** Fuses disparate vector cosine distance and text ranking scores using an in-database PostgreSQL stored procedure ($k=60$).
- **Explainable AI (XAI):** Structured JSON output generation via Google Gemini (`gemini-3.8-flash`) providing match scores ($0\text{--}100\%$), matching qualifications, and missing skill gaps.
- **Automated TSVector Trigger:** Automatically updates weighted lexemes (`Title` = 'A', `Skills` = 'B', `Description` = 'C') on job inserts and updates.
- **Batch Ingestion CLI:** Streaming CSV ingestion script with rate-limiting, exponential backoff, and batch vector generation (`gemini-embedding-001`).
- **End-to-End Type Safety:** Strict TypeScript interfaces shared across database schema, Next.js server route handlers, and React client components.

---

## 🏗️ Architecture & Pipeline Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          HIREMATCH ARCHITECTURE                                        │
│                                                                                                        │
│   1. INGESTION (scripts/ingest-jobs.ts)                                                                │
│      [Job CSV] ──► [Gemini Embedding API (768-D)] ──► [Supabase PostgreSQL (jobs table)]              │
│                                                       ├── HNSW Index (embedding <=> query)             │
│                                                       └── GIN Index  (search_tsv @@ tsquery)           │
│                                                                                                        │
│   2. RETRIEVAL & HYBRID SEARCH (app/api/matches/route.ts)                                              │
│      [Candidate Resume] ──► [Gemini 768-D Query Vector]                                                │
│                                     │                                                                  │
│                                     ▼                                                                  │
│                       [Supabase RPC: hybrid_search_jobs]                                               │
│                                     │                                                                  │
│                  ┌──────────────────┴──────────────────┐                                               │
│                  ▼                                     ▼                                               │
│       Dense Semantic Search                  Sparse Keyword Search                                     │
│       pgvector HNSW (Cosine Sim)             PostgreSQL GIN tsvector                                   │
│       Top K candidates by distance           Top K candidates by ts_rank_cd                            │
│                  │                                     │                                               │
│                  └──────────────────┬──────────────────┘                                               │
│                                     ▼                                                                  │
│                    [Reciprocal Rank Fusion (RRF)]                                                      │
│                    RRF Score = 1/(60 + r_sem) + 1/(60 + r_txt)                                         │
│                                                                                                        │
│   3. REASONING & PRESENTATION (app/page.tsx)                                                           │
│      [Resume Text + Top 10 Jobs] ──► [Gemini 3.8 Flash (JSON Schema)]                                  │
│                                                  │                                                     │
│                                                  ▼                                                     │
│                                [Interactive Next.js Dashboard]                                         │
│                                ├── Match Percentage Badge (0-100%)                                     │
│                                ├── AI Fit Assessment                                                   │
│                                ├── Matching Qualifications Pills                                       │
│                                └── Skill Gaps to Address Pills                                         │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) | Full-stack architecture, React 19 UI, server route handlers |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | End-to-end static type safety from database to UI |
| **Database** | [Supabase](https://supabase.com/) / [PostgreSQL](https://www.postgresql.org/) | Relational storage, triggers, stored procedures (RPC) |
| **Vector Search** | [pgvector](https://github.com/pgvector/pgvector) | 768-D vector storage with HNSW index for cosine similarity |
| **AI / Embeddings** | [Google Gemini API](https://ai.google.dev/) | `gemini-embedding-001` (768-D) & `gemini-3.8-flash` (reasoning) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Modern, responsive dark-mode dashboard |
| **Validation** | [Zod](https://zod.dev/) | Strict runtime request body validation |

---

## 📁 Repository Structure

```
.
├── scripts/
│   ├── ingest-jobs.ts          # Standalone CLI ingestion pipeline with rate-limiting & backoff
│   ├── sample-jobs.csv         # Sample dataset with diverse job roles & technical requirements
│   └── test-pipeline.ts        # End-to-end automated integration test suite
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── matches/
│   │   │       └── route.ts    # Secure Next.js server route handler (embed + search + LLM explain)
│   │   ├── globals.css         # Tailwind directives & design system variables
│   │   ├── layout.tsx          # Root layout and metadata configuration
│   │   └── page.tsx            # Interactive React client dashboard
│   ├── lib/
│   │   ├── gemini.ts           # Gemini SDK setup, embedding helpers, and structured LLM reasoning
│   │   └── supabase.ts         # Lazy singleton Supabase clients (Public Anon + Service Role)
│   └── types/
│       ├── database.ts         # Supabase PostgreSQL schema interfaces & RPC types
│       └── match.ts            # API request/response and LLM explanation types
├── supabase/
│   └── migrations/
│       └── 20260101000000_hirematch_hybrid_search.sql  # Complete SQL DDL, triggers, and RPC
├── .env.example                # Template for environment variables
├── package.json                # Project dependencies and npm scripts
├── tailwind.config.ts          # Tailwind styling configuration
└── tsconfig.json               # Strict TypeScript compiler options
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **Supabase Account**: [Create free account](https://supabase.com/)
- **Gemini API Key**: [Get free key from Google AI Studio](https://aistudio.google.com/app/apikey)

---

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/your-username/hirematch.git
cd hirematch
npm install
```

---

### Step 2: Database Setup (Supabase)

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** (`>_`).
3. Copy the entire contents of [`supabase/migrations/20260101000000_hirematch_hybrid_search.sql`](./supabase/migrations/20260101000000_hirematch_hybrid_search.sql).
4. Paste it into the editor and click **Run**.

This will:
- Enable the `vector` extension.
- Create `jobs` and `resumes` tables.
- Attach the `jobs_search_tsv_trigger` trigger to automatically compute weighted tsvectors.
- Build the **HNSW index** for cosine distance (`vector_cosine_ops`) and **GIN index** for full-text search.
- Create the `hybrid_search_jobs` stored procedure (RPC).

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

*To ingest a custom CSV dataset:*
```bash
npm run ingest path/to/your-jobs.csv
```

---

### Step 5: Run Automated Integration Test

Verify that the entire pipeline (Gemini Embedding $\rightarrow$ Supabase Hybrid Search $\rightarrow$ Gemini 3.8 Flash Explanation) is functioning:

```bash
npm run test:pipeline
```

---

### Step 6: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
1. Click one of the quick presets (**Full-Stack** or **AI / ML**) or paste any resume text.
2. Click **Find Matches**.
3. View the hybrid-ranked jobs, match scores, and AI skill gap breakdowns.

---

## 🧮 Mathematical Deep Dive: Reciprocal Rank Fusion (RRF)

Standard vector search returns a cosine similarity value:
$$\text{Sim}(u, v) = \frac{u \cdot v}{\|u\| \|v\|} \in [-1, 1]$$

PostgreSQL full-text search returns an unbounded cover density rank score:
$$\text{Score}_{\text{text}} \in [0, \infty)$$

Directly normalizing and summing these scores is fragile because query lengths and term frequencies wildly skew calibration. 

**Reciprocal Rank Fusion (RRF)** bypasses score calibration by evaluating the **relative ordinal rank position** of each document across multiple search systems:

$$\text{RRF Score}(d) = \sum_{m \in M} \frac{w_m}{k + r_m(d)}$$

Where:
- $M$: Set of retrievers (Dense Vector Search, Sparse Keyword Search).
- $w_m$: Weight factor assigned to retriever $m$ (default: `1.0`).
- $r_m(d)$: 1-based rank position of candidate document $d$ in retriever $m$.
- $k$: Smoothing constant (default: `60`), which dampens the impact of extreme high rankings from an isolated channel.

Candidates that score well in **both** semantic understanding and exact keyword relevance naturally dominate the fused result set.

---

## 🔌 API Reference

### `POST /api/matches`

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
        "fitSummary": "The candidate has direct alignment with the core tech stack: Next.js, TypeScript, React, and PostgreSQL.",
        "matchingSkills": ["Next.js", "TypeScript", "PostgreSQL", "React"],
        "missingSkills": ["Node.js", "Tailwind CSS"],
        "recommendation": "Highlight hands-on backend Node.js microservice architecture in your summary."
      }
    }
  ]
}
```

---

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.
