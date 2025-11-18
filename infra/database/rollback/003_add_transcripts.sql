-- Rollback: Remove video transcript support
-- Date: 2025-11-18

-- Drop indexes first
DROP INDEX IF EXISTS idx_crawl_items_transcript_search;
DROP INDEX IF EXISTS idx_crawl_items_transcript_method;
DROP INDEX IF EXISTS idx_crawl_items_transcript_language;

-- Remove transcript columns
ALTER TABLE crawl_items
  DROP COLUMN IF EXISTS transcript_text,
  DROP COLUMN IF EXISTS transcript_language,
  DROP COLUMN IF EXISTS transcript_method;
