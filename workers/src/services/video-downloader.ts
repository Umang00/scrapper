// @ts-ignore - Package will be installed in production
import YTDlpWrap from 'ytdlp-nodejs';
import { logger } from './logger';
import fs from 'fs/promises';
import path from 'path';

/**
 * Video Downloader Service
 *
 * Downloads videos from various platforms using yt-dlp.
 * Supports YouTube, TikTok, Instagram, Facebook, Twitter, and more.
 *
 * Features:
 * - Multi-platform support (1000+ sites via yt-dlp)
 * - Audio-only extraction for transcription
 * - Quality selection
 * - Progress tracking
 * - Automatic cleanup
 */

export interface DownloadOptions {
  /** Output directory for downloaded files */
  outputDir?: string;
  /** Download audio only (for transcription) */
  audioOnly?: boolean;
  /** Preferred quality (default: best available) */
  quality?: 'best' | 'worst' | '720p' | '1080p';
  /** Maximum file size in MB */
  maxFileSize?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface DownloadResult {
  /** Path to downloaded file */
  filePath: string;
  /** Original video title */
  title: string;
  /** Duration in seconds */
  duration?: number;
  /** File size in bytes */
  fileSize: number;
  /** File format (mp4, webm, m4a, etc.) */
  format: string;
}

export class VideoDownloader {
  private ytdlp: YTDlpWrap;
  private defaultOutputDir: string;

  constructor(outputDir: string = '/tmp/videos') {
    this.ytdlp = new YTDlpWrap();
    this.defaultOutputDir = outputDir;
  }

  /**
   * Download a video from any supported platform
   */
  async download(url: string, options: DownloadOptions = {}): Promise<DownloadResult> {
    const outputDir = options.outputDir || this.defaultOutputDir;
    const audioOnly = options.audioOnly ?? true; // Default to audio for transcription

    try {
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      // Build yt-dlp command options
      const ytdlpOptions: string[] = [];

      if (audioOnly) {
        // Extract audio only (much faster and smaller)
        ytdlpOptions.push(
          '--extract-audio',
          '--audio-format', 'mp3',
          '--audio-quality', '0' // Best quality
        );
      } else {
        // Download video with specific quality
        const quality = options.quality || 'best';
        ytdlpOptions.push(
          '--format', this.getFormatString(quality),
          '--merge-output-format', 'mp4'
        );
      }

      // Add common options
      ytdlpOptions.push(
        '--output', path.join(outputDir, '%(id)s.%(ext)s'),
        '--no-playlist', // Only download single video
        '--quiet',
        '--no-warnings'
      );

      // Add file size limit if specified
      if (options.maxFileSize) {
        ytdlpOptions.push('--max-filesize', `${options.maxFileSize}M`);
      }

      // Add timeout if specified
      if (options.timeout) {
        ytdlpOptions.push('--socket-timeout', String(options.timeout / 1000));
      }

      logger.info('[VideoDownloader] Starting download', {
        url,
        audioOnly,
        quality: options.quality,
      });

      // Execute download
      await this.ytdlp.execPromise([url, ...ytdlpOptions]);
      logger.info('[VideoDownloader] Download completed', { url });

      // Get metadata about the downloaded file
      const metadata = await this.getMetadata(url);
      const videoId = this.extractVideoId(url, metadata);
      const ext = audioOnly ? 'mp3' : 'mp4';
      const filePath = path.join(outputDir, `${videoId}.${ext}`);

      // Verify file exists
      const stats = await fs.stat(filePath);

      return {
        filePath,
        title: String(metadata.title || 'Unknown'),
        duration: typeof metadata.duration === 'number' ? metadata.duration : undefined,
        fileSize: stats.size,
        format: ext,
      };
    } catch (error) {
      logger.error('[VideoDownloader] Download failed', { url, error });
      throw new Error(`Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get video metadata without downloading
   */
  async getMetadata(url: string): Promise<Record<string, unknown>> {
    try {
      const result = await this.ytdlp.execPromise([
        url,
        '--dump-json',
        '--no-playlist',
        '--quiet',
      ]);

      return JSON.parse(result) as Record<string, unknown>;
    } catch (error) {
      logger.error('[VideoDownloader] Failed to get metadata', { url, error });
      return {};
    }
  }

  /**
   * Check if URL is supported by yt-dlp
   */
  async isSupported(url: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(url);
      return Object.keys(metadata).length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Delete downloaded file
   */
  async cleanup(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info('[VideoDownloader] Cleaned up file', { filePath });
    } catch (error) {
      logger.warn('[VideoDownloader] Failed to cleanup file', { filePath, error });
    }
  }

  /**
   * Get format string for quality selection
   */
  private getFormatString(quality: string): string {
    switch (quality) {
      case '720p':
        return 'bestvideo[height<=720]+bestaudio/best[height<=720]';
      case '1080p':
        return 'bestvideo[height<=1080]+bestaudio/best[height<=1080]';
      case 'worst':
        return 'worst';
      case 'best':
      default:
        return 'best';
    }
  }

  /**
   * Extract video ID from URL or metadata
   */
  private extractVideoId(url: string, metadata: Record<string, unknown>): string {
    // Try to get ID from metadata first
    if (metadata.id) {
      return String(metadata.id);
    }

    // Fallback: generate from URL
    const urlHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return urlHash.substring(0, 16);
  }
}

export const videoDownloader = new VideoDownloader();
