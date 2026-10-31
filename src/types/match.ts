import { HybridSearchResult } from "./database";

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
