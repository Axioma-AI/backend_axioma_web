import { Router, Request, Response } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { logoutService } from '../../../../services/auth/logout_service';
import { revokeSessionByJti } from '../../../../repositories/auth/session_repository';
import { decodeToken } from '../../../../utils/jwt';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const logoutRouter = Router();

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout
 *     description: |
 *       Revokes the active session associated with the **JWT** provided in the `Authorization: Bearer <token>` header.
 *       - If the session was already closed, returns **409 Conflict** with a message.
 *       - Requires Bearer authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseLogout'
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *               message: "Logout successful"
 *       '409':
 *         description: Session already revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "The session is already closed."
 */
logoutRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    // 1. Revoke Refresh Token (Cookie) & Clear Cookie
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      try {
        const payload = await decodeToken(refreshToken);
        if (payload?.jti) {
          await revokeSessionByJti(String(payload.jti));
        }
      } catch (e) {
        logger.warn('Error revoking refresh token session', e);
      }
    }

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none'
    });

    logger.info('[Auth] Logout attempt', { tokenProvided: !!req.headers.authorization });
    const result = await logoutService(req.headers.authorization);
    logger.info('[Auth] Logout successful');
    buildResponse(res, HTTP.OK, result, 'Logout successful');
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    const message = err?.message ?? 'Logout error';
    logger.error(`Logout failed: ${message}`);
    res.status(status).json({ success: false, data: null, message });
  }
});
