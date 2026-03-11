import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { setupTwoFactorService } from '../../../../services/two_factor/two_factor_service';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings } from '../../../../config/settings';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const twoFactorSetupRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/two-factor/setup:
 *   post:
 *     tags:
 *       - Two Factor Authentication
 *     summary: Setup 2FA for a user
 *     description: Generates a secret and QR code to configure two-factor authentication. The issuer uses the service name and the label uses the authenticated user's email. No fields are required in the request body.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example: {}
 *     responses:
 *       200:
 *         description: Two-factor setup generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseTwoFactorSetup'
 *             examples:
 *               default:
 *                 summary: 2FA setup example
 *                 value:
 *                   success: true
 *                   data:
 *                     secret: 'JBSWY3DPEHPK3PXP'
 *                     qr_code_url: 'otpauth://totp/Backend%20Optimus:john@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Backend%20Optimus'
 *                     manual_entry_key: 'JBSWY3DPEHPK3PXP'
 *                     issuer: 'Backend Optimus'
 *                     label: 'Backend Optimus:john@example.com'
 *                     expires_at: '2024-01-15T10:30:00.000Z'
 *                   message: 'Two-factor setup generated'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               validation_error:
 *                 summary: Validation error
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: 'Invalid request'
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
 *         description: User not found
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
 *                   message: 'User not found.'
 *       409:
 *         description: 2FA already enabled for this user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               conflict:
 *                 summary: Conflict
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: '2FA is already enabled for this user.'
 *       500:
 *         description: Internal server error
 */
twoFactorSetupRouter.post('/setup', requireBearerAuth, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[2FA] Setup attempt', { userId });
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }

    const result = await setupTwoFactorService(userId);
    logger.info('[2FA] Setup successful', { userId });
    buildResponse(res, HTTP.OK, result, 'Two-factor setup generated');
  } catch (err: any) {
    const message = err?.message ?? 'Error configuring 2FA';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});
