import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI, TaskType, EmbedContentRequest } from "@google/generative-ai";
import { Database, JobInsert } from "../src/types/database";

// Load environment variables (.env.local or .env)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error("❌ Missing GEMINI_API_KEY in environment.");
  process.exit(1);
}

const cleanSupabaseUrl = SUPABASE_URL.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const supabase = createClient<Database>(cleanSupabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

interface RawJobCsvRow {
  title?: string;
  description?: string;
  skills?: string;
  category?: string;
}

interface ParsedJob {
  title: string;
  description: string;
  skills: string[];
  category: string;
  textToEmbed: string;
}

// Configuration for batching and rate limiting
const CONFIG = {
  BATCH_SIZE: 20, // number of jobs embedded & inserted per batch
  SLEEP_BETWEEN_BATCHES_MS: 1500, // pause between batches to prevent quota exhaustion
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 2000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes skills from comma-separated string or JSON array string
 */
function parseSkills(raw: string | undefined): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to comma split
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Reads CSV file into memory with validation
 */
async function loadJobsFromCsv(filePath: string): Promise<ParsedJob[]> {
  return new Promise((resolve, reject) => {
    const jobs: ParsedJob[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row: RawJobCsvRow) => {
        const title = (row.title || "").trim();
        const description = (row.description || "").trim();
        const category = (row.category || "General").trim();
        const skills = parseSkills(row.skills);

        if (!title || !description) {
          console.warn("⚠️ Skipping invalid CSV row missing title or description:", row);
          return;
        }

        const textToEmbed = `Job Title: ${title}\nCategory: ${category}\nSkills: ${skills.join(", ")}\nDescription:\n${description}`;

        jobs.push({
          title,
          description,
          skills,
          category,
          textToEmbed,
        });
      })
      .on("end", () => resolve(jobs))
      .on("error", (err) => reject(err));
  });
}

/**
 * Embeds a batch of texts with retry logic and exponential backoff
 */
async function embedBatchWithRetry(
  texts: string[],
  retryCount = 0
): Promise<number[][]> {
  try {
    const requests = texts.map((text) => ({
      content: { role: "user", parts: [{ text }] },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
      outputDimensionality: 768,
    }));

    const response = await embeddingModel.batchEmbedContents({
      requests: requests as unknown as EmbedContentRequest[],
    });
    return response.embeddings.map((e) => e.values);
  } catch (err: unknown) {
    if (retryCount < CONFIG.MAX_RETRIES) {
      const waitTime = CONFIG.INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
      console.warn(
        `⚠️ Gemini rate limit or network error. Retrying batch in ${waitTime}ms (Attempt ${retryCount + 1}/${CONFIG.MAX_RETRIES})...`
      );
      await sleep(waitTime);
      return embedBatchWithRetry(texts, retryCount + 1);
    }
    throw err;
  }
}

/**
 * Main ingestion controller
 */
async function runIngestion() {
  const csvArg = process.argv[2] || "scripts/sample-jobs.csv";
  const csvPath = path.resolve(process.cwd(), csvArg);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found at: ${csvPath}`);
    process.exit(1);
  }

  console.log(`\n🚀 Starting HireMatch Job Ingestion from: ${csvPath}`);
  const jobs = await loadJobsFromCsv(csvPath);
  console.log(`📋 Found ${jobs.length} valid jobs to process.\n`);

  if (jobs.length === 0) {
    console.log("No jobs found in CSV. Exiting.");
    return;
  }

  let totalInserted = 0;
  const totalBatches = Math.ceil(jobs.length / CONFIG.BATCH_SIZE);

  for (let i = 0; i < jobs.length; i += CONFIG.BATCH_SIZE) {
    const batchIndex = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const batch = jobs.slice(i, i + CONFIG.BATCH_SIZE);

    console.log(`⏳ Processing Batch ${batchIndex}/${totalBatches} (${batch.length} jobs)...`);

    // 1. Generate Embeddings for current batch (768-D)
    const textsToEmbed = batch.map((j) => j.textToEmbed);
    const embeddings = await embedBatchWithRetry(textsToEmbed);

    // 2. Prepare database insert payload
    const recordsToInsert: JobInsert[] = batch.map((job, idx) => ({
      title: job.title,
      description: job.description,
      skills: job.skills,
      category: job.category,
      embedding: embeddings[idx],
    }));

    // 3. Insert into Supabase
    const { error } = await supabase.from("jobs").insert(recordsToInsert);

    if (error) {
      console.error(`❌ Failed to insert batch ${batchIndex}:`, error.message);
      throw error;
    }

    totalInserted += batch.length;
    console.log(`✅ Batch ${batchIndex}/${totalBatches} inserted successfully.`);

    // Rate-limiting delay before next batch if more remain
    if (i + CONFIG.BATCH_SIZE < jobs.length) {
      await sleep(CONFIG.SLEEP_BETWEEN_BATCHES_MS);
    }
  }

  console.log(`\n🎉 Ingestion Complete! Successfully indexed ${totalInserted} jobs into Supabase.\n`);
}

runIngestion().catch((err) => {
  console.error("Fatal ingestion error:", err);
  process.exit(1);
});
