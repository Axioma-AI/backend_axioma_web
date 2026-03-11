import { Router, Request, Response, NextFunction } from 'express';
import { getTwoFactorStatusService } from '../../../../services/two_factor/two_factor_service';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings } from '../../../../config/settings';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const twoFactorStatusRouter = Router();

/**
 * @openapi
 * /api/v1/two-factor/status:
 *   get:
 *     tags:
 *       - Two Factor Authentication
 *     summary: Get 2FA status
 *     description: |
 *       Retrieves the current 2FA configuration status for the authenticated user.
 *       - Indicates whether 2FA is enabled
 *       - Shows when it was first confirmed
 *       - Includes configured issuer and label information
 *     security:
 *       - bearerAuth: []
 *     parameters: []
 *     responses:
 *       200:
 *         description: Two-factor status fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseTwoFactorStatus'
 *             examples:
 *               enabled:
 *                 summary: 2FA enabled
 *                 value:
 *                   success: true
 *                   data:
 *                     is_enabled: true
 *                     confirmed_at: '2024-01-15T10:30:00.000Z'
 *                     issuer: 'Backend Optimus'
 *                     label: 'john@example.com'
 *                   message: 'Two-factor status fetched'
 *               disabled:
 *                 summary: 2FA disabled
 *                 value:
 *                   success: true
 *                   data:
 *                     is_enabled: false
 *                     confirmed_at: null
 *                     issuer: null
 *                     label: null
 *                   message: 'Two-factor status fetched'
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
 *       500:
 *         description: Internal server error
 */
twoFactorStatusRouter.get('/status', requireBearerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[2FA] Get Status attempt', { userId });
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }

    const result = await getTwoFactorStatusService(userId);
    logger.info('[2FA] Get Status successful', { userId, enabled: result.is_enabled });
    buildResponse(res, HTTP.OK, result, 'Two-factor status fetched');
  } catch (err: any) {
    const message = err?.message ?? 'Error fetching 2FA status';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});
