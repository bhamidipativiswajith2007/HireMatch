export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AppRole = "candidate" | "recruiter";

export type ProfileRow = {
  id: string;
  email: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  email: string;
  role?: AppRole;
  created_at?: string;
  updated_at?: string;
};

export type JobRow = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  category: string;
  embedding: string | number[] | null;
  search_tsv?: string | null;
  created_at: string;
  updated_at: string;
};

export type JobInsert = {
  id?: string;
  title: string;
  description: string;
  skills?: string[];
  category?: string;
  embedding?: string | number[] | null;
  created_at?: string;
  updated_at?: string;
};

export type ResumeRow = {
  id: string;
  candidate_name: string | null;
  raw_text: string;
  skills: string[];
  embedding: string | number[] | null;
  search_tsv?: string | null;
  created_at: string;
};

export type ResumeInsert = {
  id?: string;
  candidate_name?: string | null;
  raw_text: string;
  skills?: string[];
  embedding?: string | number[] | null;
  created_at?: string;
};

export type HybridSearchResult = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  category: string;
  similarity: number;
  text_score: number;
  rrf_score: number;
};

export type HybridResumeSearchResult = {
  id: string;
  candidate_name: string;
  raw_text: string;
  skills: string[];
  similarity: number;
  text_score: number;
  rrf_score: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      jobs: {
        Row: JobRow;
        Insert: JobInsert;
        Update: Partial<JobInsert>;
        Relationships: [];
      };
      resumes: {
        Row: ResumeRow;
        Insert: ResumeInsert;
        Update: Partial<ResumeInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      hybrid_search_jobs: {
        Args: {
          query_text: string;
          query_embedding: string | number[];
          match_count?: number;
          rrf_k?: number;
          semantic_weight?: number;
          text_weight?: number;
        };
        Returns: HybridSearchResult[];
      };
      hybrid_search_resumes: {
        Args: {
          query_text: string;
          query_embedding: string | number[];
          match_count?: number;
          rrf_k?: number;
          semantic_weight?: number;
          text_weight?: number;
        };
        Returns: HybridResumeSearchResult[];
      };
    };
    Enums: {
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
};
