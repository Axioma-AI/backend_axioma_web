import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { disableTwoFactorService, removeTwoFactorService } from '../../../../services/two_factor/two_factor_service';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings } from '../../../../config/settings';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { zodValidation } from '../../../../utils/zod_validation';
import { TwoFactorVerifySchema } from '../../../../schemas/two_factor/zod/two_factor_verify_schema';

const _APP_SETTINGS = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const twoFactorDisableRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/two-factor/disable:
 *   post:
 *     tags:
 *       - Two Factor Authentication
 *     summary: Disable 2FA
 *     description: |
 *       Disables 2FA for a user while keeping the configuration.
 *       - Requires verification using the current TOTP code
 *       - Keeps the configuration to re-enable easily later
 *       - The user can re-enable 2FA without reconfiguring
 *     security:
 *       - bearerAuth: []
 *     parameters: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *                 description: Current 6-digit verification code
 *             required:
 *               - token
 *           example:
 *             token: "123456"
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *             required:
 *               - token
 *           example:
 *             token: "123456"
 *     responses:
 *       200:
 *         description: Disable response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseTwoFactorVerify'
 *             examples:
 *               success:
 *                 summary: 2FA disabled successfully
 *                 value:
 *                   success: true
 *                   data:
 *                     success: true
 *                     message: '2FA disabled successfully.'
 *                   message: 'Two-factor disabled'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Invalid token
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: 'Invalid verification code.'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               unauthorized:
 *                 summary: Unauthorized
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: 'User not authenticated.'
 *       404:
 *         description: User not found or 2FA not enabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               not_enabled:
 *                 summary: 2FA not enabled
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: '2FA is not enabled for this user.'
 *       500:
 *         description: Internal server error
 */
twoFactorDisableRouter.post('/disable', requireBearerAuth, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[2FA] Disable attempt', { userId });
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }

    const { token } = zodValidation(TwoFactorVerifySchema, req.body);
    const result = await disableTwoFactorService(userId, token);
    logger.info('[2FA] Disable successful', { userId });
    buildResponse(res, HTTP.OK, result, 'Two-factor disabled');
  } catch (err: any) {
    const message = err?.message ?? 'Error disabling 2FA';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/two-factor/remove:
 *   delete:
 *     tags:
 *       - Two Factor Authentication
 *     summary: Remove 2FA configuration
 *     description: |
 *       Permanently deletes the user's 2FA configuration.
 *       - Requires TOTP verification if 2FA is enabled
 *       - Removes all 2FA configuration permanently
 *       - The user must reconfigure from scratch to use 2FA again
 *     security:
 *       - bearerAuth: []
 *     parameters: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *                 description: 6-digit verification code (required if 2FA is enabled)
 *             required:
 *               - token
 *           example:
 *             token: "123456"
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *             required:
 *               - token
 *           example:
 *             token: "123456"
 *     responses:
 *       200:
 *         description: Removal response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseTwoFactorVerify'
 *             examples:
 *               success:
 *                 summary: Configuration removed successfully
 *                 value:
 *                   success: true
 *                   data:
 *                     success: true
 *                     message: '2FA configuration removed successfully.'
 *                   message: 'Two-factor configuration removed'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Invalid token
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: 'Invalid verification code.'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               unauthorized:
 *                 summary: Unauthorized
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: 'User not authenticated.'
 *       404:
 *         description: User not found or 2FA configuration does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               not_found:
 *                 summary: Not found
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: 'No 2FA configuration found for this user.'
 *       500:
 *         description: Internal server error
 */
twoFactorDisableRouter.delete('/remove', requireBearerAuth, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }

    const { token } = zodValidation(TwoFactorVerifySchema, req.body);
    const result = await removeTwoFactorService(userId, token);
    buildResponse(res, HTTP.OK, result, 'Two-factor configuration removed');
  } catch (err: any) {
    const message = err?.message ?? 'Error removing 2FA';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});
