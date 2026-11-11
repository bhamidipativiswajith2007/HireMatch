import { HybridSearchResult, HybridResumeSearchResult } from "./database";

// ==========================================
// Candidate Mode Types (Resume -> Ranked Jobs)
// ==========================================

export interface JobMatchExplanation {
  jobId: string;
  matchScore: number; // 0 to 100
  fitSummary: string;
  matchingSkills: string[];
  missingSkills: string[];
  recommendation: string;
}

export interface EnrichedJobMatch extends HybridSearchResult {
  explanation: JobMatchExplanation;
}

export interface MatchRequestBody {
  resumeText: string;
  limit?: number;
}

export interface MatchResponseBody {
  success: boolean;
  count: number;
  data: EnrichedJobMatch[];
  queryTimeMs: number;
  error?: string;
}

// ==========================================
// Recruiter Mode Types (JD -> Ranked Resumes)
// ==========================================

export interface CandidateMatchExplanation {
  candidateId: string;
  candidateName: string;
  matchScore: number; // 0 to 100
  hiringVerdict: "Strong Interview" | "Consider" | "Reject";
  fitSummary: string;
  matchedQualifications: string[];
  criticalMissingSkills: string[];
  interviewQuestions: string[];
}

export interface EnrichedCandidateMatch extends HybridResumeSearchResult {
  explanation: CandidateMatchExplanation;
}

export interface CandidateMatchRequestBody {
  jobDescription: string;
  limit?: number;
}

export interface CandidateMatchResponseBody {
  success: boolean;
  count: number;
  data: EnrichedCandidateMatch[];
  queryTimeMs: number;
  error?: string;
}

export interface UploadedCandidateSummary {
  id: string;
  candidateName: string;
  skills: string[];
  snippet: string;
}

export interface ResumeUploadResponseBody {
  success: boolean;
  count: number;
  data: UploadedCandidateSummary[];
  error?: string;
}
