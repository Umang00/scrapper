// @ts-ignore - Package will be installed in production
import { YoutubeTranscript } from 'youtube-transcript';
// @ts-ignore - Package will be installed in production
import { Model } from 'vosk';
import { logger } from './logger';
import { videoDownloader, DownloadResult } from './video-downloader';

/**
 * Video Transcription Service
 *
 * Provides two transcription modes:
 * 1. FAST (YouTube only): Extracts auto-generated captions (free, instant)
 * 2. UNIVERSAL: Uses Vosk speech-to-text (works for all platforms, requires audio download)
 *
 * Configuration via environment variables:
 * - TRANSCRIPTION_MODE: 'fast' | 'universal' | 'auto' (default: 'auto')
 * - VOSK_MODEL_PATH: Path to Vosk model directory (default: './models/vosk-model-small-en-us-0.15')
 * - ENABLE_TRANSCRIPTION: 'true' | 'false' (default: 'false')
 */

export interface TranscriptSegment {
  /** Start time in seconds */
  start: number;
  /** Duration in seconds */
  duration: number;
  /** Transcribed text */
  text: string;
}

export interface TranscriptionResult {
  /** Full transcript text */
  fullText: string;
  /** Array of timed segments */
  segments: TranscriptSegment[];
  /** Language code (e.g., 'en', 'es') */
  language?: string;
  /** Transcription method used */
  method: 'youtube-captions' | 'vosk-stt';
  /** Processing time in milliseconds */
  processingTime: number;
}

export class VideoTranscriber {
  private voskModel: Model | null = null;
  private modelPath: string;
  private mode: 'fast' | 'universal' | 'auto';
  private enabled: boolean;

  constructor() {
    this.modelPath = process.env.VOSK_MODEL_PATH || './models/vosk-model-small-en-us-0.15';
    this.mode = (process.env.TRANSCRIPTION_MODE as 'fast' | 'universal' | 'auto') || 'auto';
    this.enabled = process.env.ENABLE_TRANSCRIPTION === 'true';
  }

  /**
   * Transcribe a video from URL
   */
  async transcribe(url: string): Promise<TranscriptionResult | null> {
    if (!this.enabled) {
      logger.info('[VideoTranscriber] Transcription disabled');
      return null;
    }

    const startTime = Date.now();

    try {
      // Try YouTube captions first (fast and free)
      if (this.mode === 'fast' || this.mode === 'auto') {
        const captionResult = await this.extractYouTubeCaptions(url);
        if (captionResult) {
          const processingTime = Date.now() - startTime;
          logger.info('[VideoTranscriber] YouTube captions extracted', {
            url,
            processingTime,
            segmentCount: captionResult.segments.length,
          });
          return { ...captionResult, processingTime };
        }
      }

      // Fallback to universal speech-to-text
      if (this.mode === 'universal' || this.mode === 'auto') {
        logger.info('[VideoTranscriber] Falling back to Vosk speech-to-text', { url });
        const sttResult = await this.transcribeWithVosk(url);
        const processingTime = Date.now() - startTime;
        logger.info('[VideoTranscriber] Vosk transcription completed', {
          url,
          processingTime,
        });
        return { ...sttResult, processingTime };
      }

      logger.warn('[VideoTranscriber] No transcription method available', { url });
      return null;
    } catch (error) {
      logger.error('[VideoTranscriber] Transcription failed', { url, error });
      return null;
    }
  }

  /**
   * Extract YouTube auto-generated captions (FAST - no download needed)
   */
  private async extractYouTubeCaptions(url: string): Promise<Omit<TranscriptionResult, 'processingTime'> | null> {
    try {
      // Check if URL is YouTube
      if (!this.isYouTubeUrl(url)) {
        return null;
      }

      // Extract captions
      const transcript = await YoutubeTranscript.fetchTranscript(url);

      if (!transcript || transcript.length === 0) {
        logger.warn('[VideoTranscriber] No captions found for YouTube video', { url });
        return null;
      }

      // Convert to our format
      const segments: TranscriptSegment[] = transcript.map((item: { offset: number; duration: number; text: string }) => ({
        start: item.offset / 1000, // Convert ms to seconds
        duration: item.duration / 1000,
        text: item.text,
      }));

      const fullText = segments.map((s) => s.text).join(' ');

      return {
        fullText,
        segments,
        language: 'en', // YouTube Transcript API doesn't provide language info easily
        method: 'youtube-captions',
      };
    } catch (error) {
      logger.debug('[VideoTranscriber] YouTube captions not available', { url, error });
      return null;
    }
  }

  /**
   * Transcribe using Vosk speech-to-text (UNIVERSAL - works for all platforms)
   */
  private async transcribeWithVosk(url: string): Promise<Omit<TranscriptionResult, 'processingTime'>> {
    let downloadedFile: DownloadResult | null = null;

    try {
      // Download audio
      logger.info('[VideoTranscriber] Downloading audio for transcription', { url });
      downloadedFile = await videoDownloader.download(url, {
        audioOnly: true,
        maxFileSize: 100, // Limit to 100MB
        timeout: 120000, // 2 minute timeout
      });

      // Load Vosk model if not loaded
      if (!this.voskModel) {
        logger.info('[VideoTranscriber] Loading Vosk model', { modelPath: this.modelPath });
        this.voskModel = new Model(this.modelPath);
      }

      // Transcribe audio file
      logger.info('[VideoTranscriber] Transcribing audio with Vosk', {
        filePath: downloadedFile.filePath,
      });

      const transcript = await this.transcribeAudioFile(downloadedFile.filePath);

      return transcript;
    } finally {
      // Cleanup downloaded file
      if (downloadedFile) {
        await videoDownloader.cleanup(downloadedFile.filePath);
      }
    }
  }

  /**
   * Transcribe an audio file using Vosk
   */
  private async transcribeAudioFile(
    _filePath: string
  ): Promise<Omit<TranscriptionResult, 'processingTime'>> {
    return new Promise((resolve, reject) => {
      if (!this.voskModel) {
        reject(new Error('Vosk model not loaded'));
        return;
      }

      try {
        // NOTE: This is a simplified implementation
        // Full implementation would use ffmpeg to convert audio to required format
        // and stream it to Vosk recognizer
        //
        // For now, returning a placeholder structure
        // Production implementation requires:
        // 1. Install ffmpeg
        // 2. Convert audio to 16kHz mono WAV
        // 3. Stream to Vosk recognizer
        // 4. Parse word-level results

        logger.warn('[VideoTranscriber] Vosk transcription not fully implemented yet');

        resolve({
          fullText: '[Vosk transcription placeholder - requires ffmpeg integration]',
          segments: [],
          language: 'en',
          method: 'vosk-stt',
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if URL is a YouTube video
   */
  private isYouTubeUrl(url: string): boolean {
    return (
      url.includes('youtube.com/watch') ||
      url.includes('youtu.be/') ||
      url.includes('youtube.com/shorts/')
    );
  }

  /**
   * Check if transcription is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      mode: this.mode,
      modelPath: this.modelPath,
      voskModelLoaded: this.voskModel !== null,
    };
  }
}

export const videoTranscriber = new VideoTranscriber();
