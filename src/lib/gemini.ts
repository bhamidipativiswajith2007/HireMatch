import { GoogleGenerativeAI, TaskType, EmbedContentRequest } from "@google/generative-ai";
import { HybridSearchResult, HybridResumeSearchResult } from "@/types/database";
import { JobMatchExplanation, CandidateMatchExplanation } from "@/types/match";

// Gemini embedding model
export const EMBEDDING_MODEL = "gemini-embedding-001";
// Gemini model for structured reasoning and explanation
export const LLM_MODEL = "gemini-3.8-flash";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate a 768-dimensional vector embedding for a single text chunk
 */
export async function generateEmbedding(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_QUERY
): Promise<number[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

  const request = {
    content: { role: "user", parts: [{ text }] },
    taskType,
    outputDimensionality: 768,
  };

  const result = await model.embedContent(request as unknown as EmbedContentRequest);

  if (!result.embedding?.values) {
    throw new Error("Failed to generate embedding: empty values returned from Gemini");
  }

  return result.embedding.values;
}

/**
 * Batch generate 768-dimensional embeddings for multiple texts
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[][]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const requests = texts.map((text) => ({
    content: { role: "user", parts: [{ text }] },
    taskType,
    outputDimensionality: 768,
  }));

  const response = await model.batchEmbedContents({
    requests: requests as unknown as EmbedContentRequest[],
  });

  return response.embeddings.map((item) => item.values);
}

/**
 * Candidate Mode: Compares a resume against retrieved jobs (Candidate perspective)
 */
export async function explainJobMatches(
  resumeText: string,
  matchedJobs: HybridSearchResult[]
): Promise<Record<string, JobMatchExplanation>> {
  if (matchedJobs.length === 0) {
    return {};
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: LLM_MODEL,
    generationConfig: {
      temperature: 0.0, // Strictly deterministic, zero hallucination
      responseMimeType: "application/json",
    },
  });

  const jobsPayload = matchedJobs.map((job) => ({
    id: job.id,
    title: job.title,
    category: job.category,
    skills: job.skills,
    description: job.description.slice(0, 2000),
  }));

  const prompt = `
You are an expert technical talent evaluator for HireMatch.
Evaluate the candidate's resume strictly against each retrieved job opening.

Candidate Resume:
\"\"\"
${resumeText.slice(0, 4000)}
\"\"\"

Job Openings:
${JSON.stringify(jobsPayload, null, 2)}

STRICT GROUNDING & ANTI-HALLUCINATION RULES:
1. "missingSkills" MUST ONLY include skills, tools, or requirements that are EXPLICITLY and VERBATIM stated in that specific job opening's description or required skills list.
2. DO NOT extrapolate, infer, or assume skills that a "typical" job might need. If the job description does NOT mention it, you are STRICTLY FORBIDDEN from listing it as a missing skill.
3. If the candidate covers all explicitly stated requirements in the job opening, "missingSkills" MUST be an empty array [].
4. "matchingSkills" MUST only include qualifications clearly demonstrated in the candidate's resume that match the job.
5. Provide a realistic matchScore from 0 to 100 based solely on alignment with the explicit requirements.

Return a JSON array of objects conforming exactly to this schema:
Array<{
  jobId: string;
  matchScore: number;
  fitSummary: string;
  matchingSkills: string[];
  missingSkills: string[];
  recommendation: string;
}>
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    const parsed: JobMatchExplanation[] = JSON.parse(responseText);
    const map: Record<string, JobMatchExplanation> = {};
    for (const item of parsed) {
      map[item.jobId] = item;
    }
    return map;
  } catch (err) {
    console.error("Failed to parse Gemini structured JSON response:", responseText, err);
    throw new Error("Invalid structured output from Gemini model");
  }
}

/**
 * Recruiter Mode: Evaluates retrieved candidate resumes against a Job Description (Recruiter perspective)
 */
export async function explainCandidateMatches(
  jobDescription: string,
  matchedCandidates: HybridResumeSearchResult[]
): Promise<Record<string, CandidateMatchExplanation>> {
  if (matchedCandidates.length === 0) {
    return {};
  }

  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: LLM_MODEL,
    generationConfig: {
      temperature: 0.0, // Strictly deterministic, zero hallucination
      responseMimeType: "application/json",
    },
  });

  // Provide full resume context (up to 4000 characters) so skills in lower sections are not cut off
  const candidatesPayload = matchedCandidates.map((c) => ({
    id: c.id,
    name: c.candidate_name,
    skills: c.skills,
    resumeText: c.raw_text.slice(0, 4000),
  }));

  const prompt = `
You are an executive technical recruiter and talent assessment lead for HireMatch.
Evaluate the candidate resumes strictly against the given Job Description.

Job Description:
\"\"\"
${jobDescription.slice(0, 4000)}
\"\"\"

Candidates to Evaluate:
${JSON.stringify(candidatesPayload, null, 2)}

STRICT GROUNDING & ANTI-HALLUCINATION RULES (MANDATORY COMPLIANCE):
1. "criticalMissingSkills" MUST ONLY include tools, technologies, or qualifications that are EXPLICITLY and VERBATIM demanded in the Job Description text above.
2. DO NOT extrapolate, infer, or invent industry-standard skills. For example, if the Job Description does NOT mention "Docker", "AWS", or "Kubernetes", you are STRICTLY FORBIDDEN from listing them as missing skills.
3. If the candidate's resume covers all explicitly mentioned requirements in the Job Description, "criticalMissingSkills" MUST be an empty array [].
4. "matchedQualifications" MUST only include skills explicitly confirmed in BOTH the Job Description AND the candidate's resume.
5. "matchScore" MUST be a fair 0 to 100 percentage based strictly on the candidate's alignment with the stated requirements.
6. "hiringVerdict" must be "Strong Interview" (80-100), "Consider" (60-79), or "Reject" (<60).
7. "interviewQuestions" must contain exactly 2 focused technical questions probing their specific stated experience or real gaps.

Return a JSON array of objects conforming exactly to this schema:
Array<{
  candidateId: string;
  candidateName: string;
  matchScore: number;
  hiringVerdict: "Strong Interview" | "Consider" | "Reject";
  fitSummary: string;
  matchedQualifications: string[];
  criticalMissingSkills: string[];
  interviewQuestions: string[];
}>
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    const parsed: CandidateMatchExplanation[] = JSON.parse(responseText);
    const map: Record<string, CandidateMatchExplanation> = {};
    for (const item of parsed) {
      map[item.candidateId] = item;
    }
    return map;
  } catch (err) {
    console.error("Failed to parse Gemini candidate explanations JSON:", responseText, err);
    throw new Error("Invalid structured output from Gemini model for candidate evaluation");
  }
}
