import { Pool } from 'pg';
import { logger } from '../services/logger';
import { config } from '../config';

export interface SessionData {
  platform: string;
  accountIdentifier: string;
  cookies?: any[];
  tokens?: Record<string, any>;
  expiresAt?: Date;
}

export class AuthManager {
  private pool: Pool;
  private sessions: Map<string, SessionData> = new Map();

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 5,
    });
  }

  async getSession(platform: string, accountIdentifier?: string): Promise<SessionData | null> {
    const cacheKey = `${platform}:${accountIdentifier || 'default'}`;

    // Check cache first
    if (this.sessions.has(cacheKey)) {
      const session = this.sessions.get(cacheKey)!;

      // Check if expired
      if (session.expiresAt && session.expiresAt < new Date()) {
        this.sessions.delete(cacheKey);
        logger.warn('Cached session expired', { platform, accountIdentifier });
      } else {
        return session;
      }
    }

    // Fetch from database
    try {
      let query = 'SELECT * FROM auth_credentials WHERE platform = $1 AND is_valid = true';
      const params: any[] = [platform];

      if (accountIdentifier) {
        query += ' AND account_identifier = $2';
        params.push(accountIdentifier);
      }

      query += ' ORDER BY last_validated_at DESC LIMIT 1';

      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        logger.warn('No valid session found', { platform, accountIdentifier });
        return null;
      }

      const row = result.rows[0];
      const session: SessionData = {
        platform: row.platform,
        accountIdentifier: row.account_identifier,
        cookies: row.cookie_bundle ? JSON.parse(row.cookie_bundle) : undefined,
        tokens: row.oauth_tokens ? JSON.parse(row.oauth_tokens) : undefined,
        expiresAt: row.cookie_expires_at ? new Date(row.cookie_expires_at) : undefined,
      };

      // Cache session
      this.sessions.set(cacheKey, session);

      logger.info('Session loaded', { platform, accountIdentifier });
      return session;
    } catch (error) {
      logger.error('Failed to load session', { platform, accountIdentifier, error });
      return null;
    }
  }

  async validateSession(platform: string, accountIdentifier: string): Promise<boolean> {
    try {
      await this.pool.query(
        'UPDATE auth_credentials SET last_validated_at = now() WHERE platform = $1 AND account_identifier = $2',
        [platform, accountIdentifier]
      );

      logger.debug('Session validated', { platform, accountIdentifier });
      return true;
    } catch (error) {
      logger.error('Failed to validate session', { platform, accountIdentifier, error });
      return false;
    }
  }

  async invalidateSession(platform: string, accountIdentifier: string): Promise<void> {
    const cacheKey = `${platform}:${accountIdentifier}`;
    this.sessions.delete(cacheKey);

    try {
      await this.pool.query(
        'UPDATE auth_credentials SET is_valid = false, validation_error = $1 WHERE platform = $2 AND account_identifier = $3',
        ['Session invalidated by worker', platform, accountIdentifier]
      );

      logger.warn('Session invalidated', { platform, accountIdentifier });
    } catch (error) {
      logger.error('Failed to invalidate session', { platform, accountIdentifier, error });
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Auth manager closed');
  }
}

export const authManager = new AuthManager();
