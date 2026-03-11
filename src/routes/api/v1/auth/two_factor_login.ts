import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireBearerAuthAllowPending } from '../../../../middlewares/auth';
import {
  completeTwoFactorLoginService,
  completeTwoFactorLoginWithRecoveryCodeService,
} from '../../../../services/two_factor/two_factor_service';
import { ValidationError } from '../../../../utils/errors';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { zodValidation } from '../../../../utils/zod_validation';
import {
  TwoFactorLoginSchema,
  TwoFactorRecoveryLoginSchema,
} from '../../../../schemas/auth/two_factor_login/zod/two_factor_login_schema';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const twoFactorLoginRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/auth/two-factor/login:
 *   post:
 *     tags: [Auth]
 *     summary: Complete login with 2FA (step 2)
 *     description: |
 *       Use the TOTP code (6 digits) to complete access when the login returned `requires_two_factor: true`.
 *       - Requires a JWT with `two_factor_pending: true` in `Authorization: Bearer <token>`.
 *       - If the code is valid, returns a new `access_token` with full access.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               two_factor_token:
 *                 type: string
 *                 pattern: '^\\d{6}$'
 *                 description: 6-digit TOTP code
 *                 example: "123456"
 *             required:
 *               - two_factor_token
 *     responses:
 *       200:
 *         description: Full access granted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseLogin'
 *             example:
 *               success: true
 *               data:
 *                 user_id: 7
 *                 role_id: 4
 *                 access_token: "<JWT>"
 *               message: "Two-factor login successful"
 *       400:
 *         description: Invalid code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               invalidCode:
 *                 summary: Invalid 2FA code
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "two_factor_token must be a 6-digit code."
 *               notPending:
 *                 summary: Token not in two-factor pending state
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "Token is not in two-factor pending state."
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "User not authenticated."
 */
twoFactorLoginRouter.post('/two-factor/login', requireBearerAuthAllowPending, upload.none(), async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[Auth] 2FA Login attempt', { userId });
    const pending = (req as any).twoFactorPending === true;
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }
    if (!pending) {
      throw new ValidationError('Token is not in two-factor pending state.', 400);
    }

    const { two_factor_token } = zodValidation(TwoFactorLoginSchema, req.body);

    const result = await completeTwoFactorLoginService(userId, two_factor_token);
    logger.info('[Auth] 2FA Login successful', { userId });
    buildResponse(res, HTTP.OK, result, 'Two-factor login successful');
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    const message = err?.message ?? 'Error completing 2FA login';
    if (status >= 500) logger.error(message); else logger.warn(message);
    res.status(status).json({ success: false, data: null, message });
  }
});

/**
 * @openapi
 * /api/v1/auth/two-factor/recovery-login:
 *   post:
 *     tags: [Auth]
 *     summary: Complete login with 2FA recovery code
 *     description: |
 *       Use a 2FA recovery code to complete access when the login returned `requires_two_factor: true` and it's not possible to use the authenticator app.
 *       - Requires a JWT with `two_factor_pending: true` in `Authorization: Bearer <token>`.
 *       - Each recovery code is single-use.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recovery_code:
 *                 type: string
 *                 description: 2FA recovery code in format XXXX-XXXX-XXXX
 *                 example: "ABCD-EFGH-IJKL"
 *             required:
 *               - recovery_code
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               recovery_code:
 *                 type: string
 *                 description: 2FA recovery code in format XXXX-XXXX-XXXX
 *             required:
 *               - recovery_code
 *     responses:
 *       200:
 *         description: Full access granted via recovery code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseLogin'
 *             example:
 *               success: true
 *               data:
 *                 user_id: 7
 *                 role_id: 4
 *                 access_token: "<JWT>"
 *               message: "Two-factor recovery login successful"
 *       400:
 *         description: Invalid or unavailable recovery code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               invalidRecovery:
 *                 summary: Invalid recovery code
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "Invalid recovery code."
 *               unavailableRecovery:
 *                 summary: No recovery codes available
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "No recovery codes available."
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "User not authenticated."
 */
twoFactorLoginRouter.post(
  '/two-factor/recovery-login',
  requireBearerAuthAllowPending,
  upload.none(),
  async (req: Request, res: Response) => {
    try {
      const userId = Number((req as any).userId);
      logger.info('[Auth] 2FA Recovery Login attempt', { userId });
      const pending = (req as any).twoFactorPending === true;
      if (!Number.isFinite(userId) || userId <= 0) {
        throw new ValidationError('User not authenticated.', 401);
      }
      if (!pending) {
        throw new ValidationError('Token is not in two-factor pending state.', 400);
      }

      const { recovery_code } = zodValidation(TwoFactorRecoveryLoginSchema, req.body);

      const result = await completeTwoFactorLoginWithRecoveryCodeService(
        userId,
        recovery_code.trim()
      );
      logger.info('[Auth] 2FA Recovery Login successful', { userId });
      buildResponse(res, HTTP.OK, result, 'Two-factor recovery login successful');
    } catch (err: any) {
      const status = err?.statusCode ?? 500;
      const message = err?.message ?? 'Error completing 2FA login with recovery code';
      if (status >= 500) logger.error(message);
      else logger.warn(message);
      res.status(status).json({ success: false, data: null, message });
    }
  }
);
