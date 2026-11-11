-- ==============================================================================
-- HIREMATCH MIGRATION: RESUMES TABLE HYBRID SEARCH & RRF RPC
-- ==============================================================================

-- 1. Ensure search_tsv column exists on public.resumes
ALTER TABLE public.resumes 
ADD COLUMN IF NOT EXISTS search_tsv tsvector;

-- 2. Trigger Function: Automatically populate weighted search_tsv for resumes
-- 'A' weight for Candidate Name
-- 'B' weight for explicit Skills list
-- 'C' weight for full resume raw_text
CREATE OR REPLACE FUNCTION public.resumes_search_tsv_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.candidate_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.skills, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.raw_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resumes_search_tsv ON public.resumes;
CREATE TRIGGER trg_resumes_search_tsv
BEFORE INSERT OR UPDATE ON public.resumes
FOR EACH ROW EXECUTE FUNCTION public.resumes_search_tsv_trigger();

-- 3. Create Indexes on public.resumes
-- 3a. HNSW Index on resumes.embedding using Cosine Distance
CREATE INDEX IF NOT EXISTS idx_resumes_embedding_hnsw 
ON public.resumes 
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3b. GIN Index on resumes.search_tsv for full-text search
CREATE INDEX IF NOT EXISTS idx_resumes_search_tsv 
ON public.resumes 
USING gin(search_tsv);

CREATE INDEX IF NOT EXISTS idx_resumes_created_at ON public.resumes (created_at DESC);

-- ==============================================================================
-- 4. HYBRID SEARCH RPC: CANDIDATE RESUMES RANKED BY RRF
-- ==============================================================================
-- Evaluates incoming Job Description text and embedding against indexed candidate resumes.
-- Combines pgvector cosine similarity with PostgreSQL full-text search (RRF).

CREATE OR REPLACE FUNCTION public.hybrid_search_resumes(
    query_text TEXT,
    query_embedding extensions.vector(768),
    match_count INT DEFAULT 10,
    rrf_k INT DEFAULT 60,
    semantic_weight FLOAT DEFAULT 1.0,
    text_weight FLOAT DEFAULT 1.0
)
RETURNS TABLE (
    id UUID,
    candidate_name TEXT,
    raw_text TEXT,
    skills TEXT[],
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
        r.id,
        (1 - (r.embedding <=> query_embedding))::FLOAT AS sim,
        ROW_NUMBER() OVER (ORDER BY r.embedding <=> query_embedding) AS rank
    FROM public.resumes r
    WHERE r.embedding IS NOT NULL
    ORDER BY r.embedding <=> query_embedding
    LIMIT LEAST(match_count * 3, 100)
),
text_search AS (
    SELECT 
        r.id,
        ts_rank_cd(r.search_tsv, plainto_tsquery('english', query_text))::FLOAT AS rank_score,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(r.search_tsv, plainto_tsquery('english', query_text)) DESC) AS rank
    FROM public.resumes r
    WHERE r.search_tsv @@ plainto_tsquery('english', query_text)
    ORDER BY rank_score DESC
    LIMIT LEAST(match_count * 3, 100)
)
SELECT 
    r.id,
    COALESCE(r.candidate_name, 'Candidate')::TEXT AS candidate_name,
    r.raw_text,
    r.skills,
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
JOIN public.resumes r ON r.id = candidates.id
LEFT JOIN semantic_search s ON s.id = candidates.id
LEFT JOIN text_search t ON t.id = candidates.id
ORDER BY rrf_score DESC
LIMIT match_count;
$$;
