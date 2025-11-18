import { Request, Response, NextFunction } from 'express';
import { db } from '../services/database';
import { logger } from '../services/logger';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { config } from '../config';

export class AuthController {
  /**
   * POST /auth/sessions - Upload cookie bundle or create session
   */
  static async createSession(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        platform,
        account_identifier,
        credential_type = 'session_cookie',
        cookie_bundle,
        oauth_tokens,
        notes,
      } = req.body;

      if (!platform || !account_identifier) {
        throw new AppError(400, 'Missing required fields: platform, account_identifier');
      }

      // Encrypt credential data
      const credentialData = JSON.stringify({
        cookie_bundle,
        oauth_tokens,
      });

      const encryptedData = AuthController.encrypt(credentialData);

      const credentialId = uuidv4();

      const [credential] = await db.query(
        `INSERT INTO auth_credentials (
          id, platform, account_identifier, credential_type, encrypted_data,
          cookie_bundle, oauth_tokens, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (platform, account_identifier)
        DO UPDATE SET
          encrypted_data = $5,
          cookie_bundle = $6,
          oauth_tokens = $7,
          updated_at = now()
        RETURNING *`,
        [
          credentialId,
          platform,
          account_identifier,
          credential_type,
          encryptedData,
          cookie_bundle ? JSON.stringify(cookie_bundle) : null,
          oauth_tokens ? JSON.stringify(oauth_tokens) : null,
          notes,
        ]
      );

      logger.info('Auth credential created', { platform, account_identifier });

      res.status(201).json({
        status: 'success',
        data: {
          id: credential.id,
          platform: credential.platform,
          account_identifier: credential.account_identifier,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/sessions - List auth sessions
   */
  static async listSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const { platform } = req.query;

      let query = 'SELECT id, platform, account_identifier, credential_type, is_valid, last_validated_at, created_at FROM auth_credentials WHERE 1=1';
      const params: any[] = [];

      if (platform) {
        params.push(platform);
        query += ` AND platform = $${params.length}`;
      }

      query += ' ORDER BY created_at DESC';

      const sessions = await db.query(query, params);

      res.json({
        status: 'success',
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Encrypt data
   */
  private static encrypt(text: string): Buffer {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(config.encryption.key || 'default-key-change-me-32-bytes!!', 'utf-8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return Buffer.from(
      JSON.stringify({
        iv: iv.toString('hex'),
        encrypted,
        authTag: authTag.toString('hex'),
      })
    );
  }

  /**
   * Decrypt data (reserved for future use)
   * Uncomment when credential decryption is needed
   */
  // private static decrypt(encryptedBuffer: Buffer): string {
  //   const algorithm = 'aes-256-gcm';
  //   const key = Buffer.from(config.encryption.key || 'default-key-change-me-32-bytes!!', 'utf-8');
  //
  //   const { iv, encrypted, authTag } = JSON.parse(encryptedBuffer.toString());
  //
  //   const decipher = crypto.createDecipheriv(
  //     algorithm,
  //     key,
  //     Buffer.from(iv, 'hex')
  //   );
  //   decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  //
  //   let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  //   decrypted += decipher.final('utf8');
  //
  //   return decrypted;
  // }
}
