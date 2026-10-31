import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HireMatch | AI-Powered Job Fit & Hybrid Semantic Search",
  description: "Match resumes to jobs using Supabase pgvector hybrid search and Gemini LLM explanations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
