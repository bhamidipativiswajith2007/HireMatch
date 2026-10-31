import { GoogleGenerativeAI, TaskType, EmbedContentRequest } from "@google/generative-ai";
import { HybridSearchResult } from "@/types/database";
import { JobMatchExplanation } from "@/types/match";

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
 * Uses Gemini LLM to compare a resume against a batch of retrieved jobs,
 * returning structured fit analysis and skill gaps.
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
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const jobsPayload = matchedJobs.map((job) => ({
    id: job.id,
    title: job.title,
    category: job.category,
    skills: job.skills,
    descriptionSnippet: job.description.slice(0, 800),
  }));

  const prompt = `
You are an expert technical recruiter and talent evaluator for HireMatch.
Evaluate the candidate's resume against the following candidate job openings.

Candidate Resume:
\"\"\"
${resumeText.slice(0, 4000)}
\"\"\"

Job Openings:
${JSON.stringify(jobsPayload, null, 2)}

Instructions:
1. For EVERY job listed above, evaluate how well the candidate matches the requirements.
2. Provide an honest match score from 0 to 100 based on technical and experience alignment.
3. Explicitly extract:
   - "matchingSkills": Technical skills or qualifications the candidate POSSESSES that the job requires.
   - "missingSkills": Key skills or qualifications the job requires that are MISSING or weak in the resume.
   - "fitSummary": A concise 2-3 sentence assessment explaining why this candidate is or isn't a strong fit.
   - "recommendation": Concrete advice on what the candidate should highlight or bridge to qualify.

Return a JSON array of objects conforming exactly to this TypeScript schema:
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
