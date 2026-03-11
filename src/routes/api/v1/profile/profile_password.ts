import { Router, Request, Response, NextFunction } from 'express';
import { updatePasswordService } from '../../../../services/profile/profile_service';
import { requireAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { setupLogger } from '../../../../utils/logger';
import { AppSettings, getAppSettings } from '../../../../config/settings';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);
export const passwordRouter = Router();

  /**
   * @openapi
   * /api/v1/profile/password:
   *   patch:
   *     tags:
   *       - Profile
  *     summary: Update profile password
  *     description: |
  *       Updates the user's password after verifying the current one.
  *       - Requires `current_password` and `new_password` in the request body
  *       - Records the previous password in history before applying the change
  *     security:
  *       - bearerAuth: []
  *       - apiKeyAuth: []
  *     parameters: []
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             $ref: '#/components/schemas/ProfilePasswordUpdateRequest'
   *     responses:
  *       200:
  *         description: Password updated
   *         content:
   *           application/json:
  *             schema:
  *               $ref: '#/components/schemas/BaseResponseProfilePassword'
   *             examples:
   *               default:
  *                 summary: Password change response example
   *                 value:
   *                   success: true
   *                   data:
   *                     success: true
   *                   message: "Password updated successfully"
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
  *                   message: 'Password validation failed.'
  *       401:
  *         description: Incorrect current password
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
  *                   message: 'Incorrect current password.'
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
   */
  passwordRouter.patch('/password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = Number((req as any).userId);
      logger.info('[Profile] Change Password attempt', { userId });
      const result = await updatePasswordService(userId, req.body);
      logger.info('[Profile] Change Password successful', { userId });
      return buildResponse(res, HTTP.OK, result, 'Password updated successfully');
    } catch (err: any) {
      const message = err?.message ?? 'Error changing password';
      logger.error(`[Profile] Change Password failed: ${message}`);
      next(err);
    }
  });
