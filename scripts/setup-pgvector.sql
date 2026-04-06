-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add the embedding column to KnowledgeChunk
ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Create an HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);
