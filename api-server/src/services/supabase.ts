import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from './logger';

class SupabaseService {
  public client: SupabaseClient;
  public serviceClient: SupabaseClient;

  constructor() {
    // Client with anon key (for public operations)
    this.client = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        persistSession: false,
      },
    });

    // Client with service role key (for privileged operations)
    this.serviceClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    logger.info('Supabase clients initialized');
  }

  /**
   * Broadcast event to a channel
   */
  async broadcast<T = unknown>(
    channel: string,
    event: string,
    payload: T
  ): Promise<void> {
    try {
      const channelInstance = this.serviceClient.channel(channel);
      await channelInstance.send({
        type: 'broadcast',
        event,
        payload: {
          ...payload,
          timestamp: new Date().toISOString(),
        },
      });
      logger.debug('Broadcast sent', { channel, event });
    } catch (error) {
      logger.error('Failed to broadcast', { channel, event, error });
      throw error;
    }
  }

  /**
   * Get a channel instance
   */
  getChannel(name: string) {
    return this.serviceClient.channel(name);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.serviceClient.from('crawl_jobs').select('id').limit(1);
      if (error) throw error;
      return true;
    } catch (error) {
      logger.error('Supabase health check failed', error);
      return false;
    }
  }
}

export const supabase = new SupabaseService();
