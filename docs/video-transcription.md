# Video Transcription Guide

This guide explains how to use the video transcription feature to automatically extract speech-to-text from videos on YouTube, TikTok, Instagram, and other platforms.

## Overview

The Universal Crawler supports two transcription methods:

1. **Fast Mode (YouTube only)**: Extracts auto-generated captions directly from YouTube - instant and free
2. **Universal Mode (All platforms)**: Uses Vosk speech-to-text to transcribe downloaded audio - works everywhere

## Quick Start

### 1. Enable Transcription

Add to your `.env` file:

```bash
ENABLE_TRANSCRIPTION=true
TRANSCRIPTION_MODE=auto  # Options: fast, universal, auto
```

### 2. For Universal Mode: Download Vosk Model

```bash
# Download a lightweight English model (40MB)
mkdir -p models
cd models
wget https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
unzip vosk-model-small-en-us-0.15.zip
cd ..

# Update .env
echo "VOSK_MODEL_PATH=./models/vosk-model-small-en-us-0.15" >> .env
```

### 3. Install Dependencies

The required packages are already in `package.json`:

```bash
npm install
```

Note: `ytdlp-nodejs` will automatically download the `yt-dlp` binary on first install.

### 4. Start Crawling with Transcription

```bash
# Submit a job via API
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "source_platform": "youtube",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "config": {}
  }'
```

The crawler will automatically transcribe the video and store the transcript in the database.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_TRANSCRIPTION` | `false` | Enable/disable transcription |
| `TRANSCRIPTION_MODE` | `auto` | Transcription mode (see below) |
| `VOSK_MODEL_PATH` | `./models/vosk-model-small-en-us-0.15` | Path to Vosk model |

### Transcription Modes

#### `fast` - YouTube Captions Only
- **Use case**: YouTube videos only, need instant results
- **Pros**: Instant, no download, free, accurate
- **Cons**: Only works for YouTube, requires captions to be available
- **Cost**: $0
- **Speed**: < 1 second

#### `universal` - Vosk Speech-to-Text
- **Use case**: All platforms (TikTok, Instagram, Facebook, etc.)
- **Pros**: Works everywhere, offline, no API costs
- **Cons**: Requires video download, slower, ~85-90% accuracy
- **Cost**: $0 (compute only)
- **Speed**: ~1-2x realtime (5min video = 5-10min processing)

#### `auto` - Smart Fallback (Recommended)
- **Use case**: Mixed content from multiple platforms
- **How it works**: Tries YouTube captions first, falls back to Vosk
- **Pros**: Best of both worlds
- **Cons**: None
- **Cost**: $0
- **Speed**: Variable (1s for YouTube, 1-2x realtime for others)

## Vosk Models

Download models from [https://alphacephei.com/vosk/models](https://alphacephei.com/vosk/models)

### Recommended Models

| Model | Size | Language | Accuracy | Use Case |
|-------|------|----------|----------|----------|
| `vosk-model-small-en-us-0.15` | 40MB | English | Good | **Production (recommended)** |
| `vosk-model-en-us-0.22` | 1.8GB | English | Excellent | High accuracy needed |
| `vosk-model-small-cn-0.22` | 42MB | Chinese | Good | Chinese content |
| `vosk-model-small-es-0.42` | 33MB | Spanish | Good | Spanish content |

### Multi-language Support

To support multiple languages, download multiple models and update the transcriber service to detect language and load the appropriate model.

## Data Extraction

### What Gets Extracted

For each transcribed video:

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "title": "Video Title",
  "textContent": "Description\n\nTranscript:\nHello world, this is...",
  "transcript": {
    "fullText": "Hello world, this is the full transcript...",
    "language": "en",
    "method": "youtube-captions"
  }
}
```

### Database Schema

Transcripts are stored in the `crawl_items` table:

| Column | Type | Description |
|--------|------|-------------|
| `transcript_text` | TEXT | Full transcript |
| `transcript_language` | VARCHAR(10) | Language code (en, es, etc.) |
| `transcript_method` | VARCHAR(50) | Method used (youtube-captions, vosk-stt) |

### Full-Text Search

Transcripts are automatically indexed for full-text search:

```sql
-- Search transcripts
SELECT url, title, transcript_text
FROM crawl_items
WHERE to_tsvector('english', transcript_text) @@ to_tsquery('english', 'keyword');
```

## Performance & Costs

### Resource Usage

**Fast Mode (YouTube Captions)**
- CPU: Negligible
- Memory: < 10MB
- Network: 1-2 API calls
- Storage: ~10KB per video

**Universal Mode (Vosk)**
- CPU: ~100% of 1 core during transcription
- Memory: ~500MB (model + processing)
- Network: Video download (varies by length/quality)
- Disk: ~5-50MB temp storage per video
- Storage: ~10KB per video (transcript only)

### Processing Time

| Platform | Duration | Mode | Processing Time |
|----------|----------|------|----------------|
| YouTube | 5 min | Fast | < 1 second |
| YouTube | 5 min | Universal | 5-10 minutes |
| TikTok | 1 min | Universal | 1-2 minutes |
| Instagram Reel | 30 sec | Universal | 30-60 seconds |

### Cost Analysis

Assuming 1000 videos/month:

| Mode | Infrastructure Cost | Notes |
|------|-------------------|-------|
| Fast (YouTube) | $0 | Free API |
| Universal (Vosk) | ~$50-100/month | Compute costs only (AWS t3.medium) |

**Cost Comparison with Paid Services:**
- OpenAI Whisper API: $6/hour of audio = ~$3000/month for 500 hours
- AssemblyAI: $0.25/hour = ~$125/month for 500 hours
- Vosk (self-hosted): $50-100/month (unlimited)

## Architecture

```
┌──────────────┐
│ Video URL    │
└──────┬───────┘
       │
       v
┌──────────────────────────────────────┐
│ VideoTranscriber.transcribe(url)     │
└──────┬───────────────────────────────┘
       │
       ├─→ Is YouTube? ──→ [YouTube Captions API] ──→ Done (1s)
       │                           │
       │                           │ Captions not available
       │                           v
       └─→ [VideoDownloader] ──→ Download audio (mp3)
                   │
                   v
           [Vosk Speech-to-Text] ──→ Transcribe
                   │
                   v
              Store transcript ──→ Cleanup temp files
```

## Troubleshooting

### Issue: "No captions available"
**Solution**: Set `TRANSCRIPTION_MODE=auto` or `universal` to fallback to Vosk

### Issue: "Vosk model not found"
**Solution**: Download the model and verify `VOSK_MODEL_PATH` is correct

```bash
ls -la ./models/vosk-model-small-en-us-0.15
```

### Issue: "Video download failed"
**Solution**: Check that `yt-dlp` binary is installed:

```bash
npx ytdlp-nodejs --version
```

### Issue: "Out of memory"
**Solution**: Use a smaller Vosk model or increase Node.js heap size:

```bash
NODE_OPTIONS="--max-old-space-size=2048" npm start
```

### Issue: "Transcription takes too long"
**Solution**:
1. Use `fast` mode for YouTube-only
2. Process videos asynchronously in background jobs
3. Set max file size limit in config

## Best Practices

### 1. Use Auto Mode for Production
```bash
TRANSCRIPTION_MODE=auto
```
This gives you the best of both worlds.

### 2. Set File Size Limits
Avoid downloading huge videos:

```javascript
await videoDownloader.download(url, {
  audioOnly: true,
  maxFileSize: 100, // 100MB max
  timeout: 120000,  // 2 minute timeout
});
```

### 3. Process Asynchronously
Don't block the main crawler - transcribe in background:

```javascript
// In connector:
if (videoTranscriber.isEnabled()) {
  // Queue transcription job instead of waiting
  await jobQueue.add('transcribe', { url: rawData.url });
}
```

### 4. Cache Transcripts
If you're re-crawling the same videos, check if transcript already exists:

```sql
SELECT transcript_text FROM crawl_items
WHERE url = $1 AND transcript_text IS NOT NULL;
```

## Future Enhancements

### Planned Features

- [ ] **Timestamp support**: Word-level timestamps for video players
- [ ] **Multi-language auto-detection**: Automatically detect and use appropriate model
- [ ] **Parallel processing**: Transcribe multiple videos simultaneously
- [ ] **Progress tracking**: Real-time transcription progress updates
- [ ] **Quality scores**: Confidence metrics for each segment
- [ ] **Speaker diarization**: "Who said what" for multi-speaker videos
- [ ] **Translation**: Auto-translate transcripts to other languages

### Alternative Transcription Methods

For specific platforms:

- **YouTube**: Already using YouTube Data API v3 (future)
- **TikTok**: TikTok API transcription endpoint (when available)
- **Cloud services**: Google Speech-to-Text, AWS Transcribe (for enterprise)

## API Reference

### VideoDownloader

```typescript
// Download video audio
const result = await videoDownloader.download(url, {
  outputDir: '/tmp/videos',
  audioOnly: true,
  quality: 'best',
  maxFileSize: 100, // MB
  timeout: 120000,  // ms
});

// Get metadata without downloading
const metadata = await videoDownloader.getMetadata(url);

// Cleanup
await videoDownloader.cleanup(result.filePath);
```

### VideoTranscriber

```typescript
// Transcribe video
const transcript = await videoTranscriber.transcribe(url);

if (transcript) {
  console.log(transcript.fullText);
  console.log(transcript.method); // 'youtube-captions' or 'vosk-stt'
  console.log(transcript.processingTime); // ms
}

// Check configuration
const config = videoTranscriber.getConfig();
console.log(config.enabled, config.mode);
```

## Examples

### Example 1: YouTube Video with Captions

```bash
# Input
URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Output
{
  "transcript": {
    "fullText": "We're no strangers to love, you know the rules and so do I...",
    "language": "en",
    "method": "youtube-captions"
  },
  "processingTime": 847  // milliseconds
}
```

### Example 2: TikTok Video (Vosk)

```bash
# Input
URL: https://www.tiktok.com/@user/video/123456789

# Output
{
  "transcript": {
    "fullText": "Check out this cool trick I learned...",
    "language": "en",
    "method": "vosk-stt"
  },
  "processingTime": 45823  // milliseconds (~46 seconds)
}
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/universal-crawler/issues
- Documentation: https://docs.example.com
- Vosk Support: https://alphacephei.com/vosk/
- yt-dlp Support: https://github.com/yt-dlp/yt-dlp

## License

Video transcription feature uses:
- **Vosk** (Apache 2.0 License)
- **yt-dlp** (Public Domain)
- **youtube-transcript** (MIT License)
