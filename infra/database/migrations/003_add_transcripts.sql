-- Migration: Add video transcript support to crawl_items
-- Date: 2025-11-18
-- Description: Adds columns for storing video transcriptions from Vosk/YouTube captions

-- Add transcript columns to crawl_items table
ALTER TABLE crawl_items
  ADD COLUMN IF NOT EXISTS transcript_text TEXT,
  ADD COLUMN IF NOT EXISTS transcript_language VARCHAR(10),
  ADD COLUMN IF NOT EXISTS transcript_method VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN crawl_items.transcript_text IS 'Full transcript of video content (if available)';
COMMENT ON COLUMN crawl_items.transcript_language IS 'Language code of transcript (e.g., en, es, fr)';
COMMENT ON COLUMN crawl_items.transcript_method IS 'Transcription method used (youtube-captions, vosk-stt)';

-- Create index for full-text search on transcripts
CREATE INDEX IF NOT EXISTS idx_crawl_items_transcript_search
  ON crawl_items USING gin(to_tsvector('english', transcript_text));

-- Add index for filtering by transcription method
CREATE INDEX IF NOT EXISTS idx_crawl_items_transcript_method
  ON crawl_items(transcript_method) WHERE transcript_method IS NOT NULL;

-- Add index for filtering by language
CREATE INDEX IF NOT EXISTS idx_crawl_items_transcript_language
  ON crawl_items(transcript_language) WHERE transcript_language IS NOT NULL;
