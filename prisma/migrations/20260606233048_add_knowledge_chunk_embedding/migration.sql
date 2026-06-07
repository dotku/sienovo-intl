-- Add the pgvector embedding column the RAG pipeline writes/queries.
-- It was referenced by lib/rag (index.ts UPDATE ... SET embedding, retrieve.ts
-- kc.embedding <=> ...) but no migration ever created it, so every index run
-- failed and retrieval returned nothing. Dimension 1024 = Cohere Embed
-- Multilingual v3 (our Bedrock embedding model).
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- HNSW index for fast approximate cosine-distance (<=>) k-NN search.
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
  ON "KnowledgeChunk" USING hnsw (embedding vector_cosine_ops);
