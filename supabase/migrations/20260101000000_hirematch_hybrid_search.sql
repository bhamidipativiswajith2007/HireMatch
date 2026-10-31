-- ==============================================================================
-- HIREMATCH DATABASE SCHEMA & HYBRID SEARCH SETUP (Supabase / PostgreSQL)
-- ==============================================================================

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Create the 'jobs' table
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    skills TEXT[] NOT NULL DEFAULT '{}',
    category TEXT NOT NULL DEFAULT 'Engineering',
    embedding extensions.vector(768),
    search_tsv tsvector,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Trigger Function to automatically populate weighted search_tsv
-- PostgreSQL requires GENERATED expressions to be IMMUTABLE. Because
-- array_to_string is STABLE, a BEFORE trigger is the standard, production-grade pattern.
CREATE OR REPLACE FUNCTION public.jobs_search_tsv_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.skills, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_search_tsv ON public.jobs;
CREATE TRIGGER trg_jobs_search_tsv
BEFORE INSERT OR UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.jobs_search_tsv_trigger();

-- 4. Create the 'resumes' table
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_name TEXT,
    raw_text TEXT NOT NULL,
    skills TEXT[] DEFAULT '{}',
    embedding extensions.vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Create Indexes
-- 5a. HNSW Index on jobs.embedding using Cosine Distance
CREATE INDEX IF NOT EXISTS idx_jobs_embedding_hnsw 
ON public.jobs 
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 5b. GIN Index on jobs.search_tsv for high-speed full-text queries
CREATE INDEX IF NOT EXISTS idx_jobs_search_tsv 
ON public.jobs 
USING gin(search_tsv);

-- 5c. Metadata indexes
CREATE INDEX IF NOT EXISTS idx_jobs_category ON public.jobs (category);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs (created_at DESC);

-- ==============================================================================
-- 6. HYBRID SEARCH RPC FUNCTION WITH RECIPROCAL RANK FUSION (RRF)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.hybrid_search_jobs(
    query_text TEXT,
    query_embedding extensions.vector(768),
    match_count INT DEFAULT 10,
    rrf_k INT DEFAULT 60,
    semantic_weight FLOAT DEFAULT 1.0,
    text_weight FLOAT DEFAULT 1.0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    skills TEXT[],
    category TEXT,
    similarity FLOAT,
    text_score FLOAT,
    rrf_score FLOAT
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
WITH semantic_search AS (
    SELECT 
        j.id,
        (1 - (j.embedding <=> query_embedding))::FLOAT AS sim,
        ROW_NUMBER() OVER (ORDER BY j.embedding <=> query_embedding) AS rank
    FROM public.jobs j
    WHERE j.embedding IS NOT NULL
    ORDER BY j.embedding <=> query_embedding
    LIMIT LEAST(match_count * 3, 100)
),
text_search AS (
    SELECT 
        j.id,
        ts_rank_cd(j.search_tsv, plainto_tsquery('english', query_text))::FLOAT AS rank_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(j.search_tsv, plainto_tsquery('english', query_text)) DESC) AS rank
    FROM public.jobs j
    WHERE j.search_tsv @@ plainto_tsquery('english', query_text)
    ORDER BY rank_score DESC
    LIMIT LEAST(match_count * 3, 100)
)
SELECT 
    j.id,
    j.title,
    j.description,
    j.skills,
    j.category,
    COALESCE(s.sim, 0.0)::FLOAT AS similarity,
    COALESCE(t.rank_score, 0.0)::FLOAT AS text_score,
    (
        COALESCE(semantic_weight / (rrf_k + s.rank), 0.0) +
        COALESCE(text_weight / (rrf_k + t.rank), 0.0)
    )::FLOAT AS rrf_score
FROM (
    SELECT id FROM semantic_search
    UNION
    SELECT id FROM text_search
) candidates
JOIN public.jobs j ON j.id = candidates.id
LEFT JOIN semantic_search s ON s.id = candidates.id
LEFT JOIN text_search t ON t.id = candidates.id
ORDER BY rrf_score DESC
LIMIT match_count;
$$;
