import { Router, Request, Response } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings, getJwtSettings, type JwtSettings } from '../../../../config/settings';
import { refreshAccessTokenService } from '../../../../services/auth/refresh_token_service';
import { ValidationError, AuthError } from '../../../../utils/errors';
import { getDeviceInfo } from '../../../../utils/device_info';
import { decodeToken } from '../../../../utils/jwt';
import { getActiveSessionByJti, getSessionByJti, revokeAllActiveSessionsByUserId } from '../../../../repositories/auth/session_repository';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const _JWT_SETTINGS: JwtSettings = getJwtSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const refreshTokenRouter = Router();

/**
 * @openapi
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     description: |
 *       Generates a new `access_token` using a **refreshToken** sent in secure cookies.
 *       - Requires `refreshToken` cookie (HttpOnly, Secure, SameSite=strict).
 *       - Can only refresh the token for the authenticated user.
 *       - Rotates the `refreshToken`: issues a new one and revokes the previous.
 *       - Detects reuse of a revoked `refreshToken` and revokes all active sessions for the user.
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseLogin'
 *             example:
 *               success: true
 *               data:
 *                 user_id: 1
 *                 role_id: 2
 *                 access_token: "<JWT>"
 *               message: "Token refreshed successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             examples:
 *               missingCookie:
 *                 summary: Missing refreshToken cookie
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "No refresh token provided in cookies."
 *               invalidToken:
 *                 summary: Invalid refresh token
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "Invalid refresh token."
 *               reuseDetected:
 *                 summary: Refresh token reuse detected
 *                 value:
 *                   success: false
 *                   data: null
 *                   message: "Refresh token reuse detected. Sessions revoked."
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "User not found."
 */
refreshTokenRouter.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AuthError('No refresh token provided in cookies.', 401);
    }

    const payload = await decodeToken(refreshToken);
    if (!payload || !payload.sub || !payload.jti) {
      throw new AuthError('Invalid refresh token.', 401);
    }

    // Verificar si la sesión del refresh token es válida; detectar reuse si fue revocada previamente
    const activeSession = await getActiveSessionByJti(String(payload.jti));
    const userId = Number(payload.sub);
    if (!activeSession) {
      const anySession = await getSessionByJti(String(payload.jti));
      if (anySession && anySession.revoked_at) {
        try { await revokeAllActiveSessionsByUserId(userId); } catch {}
        throw new AuthError('Refresh token reuse detected. Sessions revoked.', 401);
      }
      throw new AuthError('Refresh token session revoked or expired.', 401);
    }

    logger.info('[Auth] Refresh Token attempt via cookie', { userId });
    
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }

    const deviceInfo = getDeviceInfo(req);
    const result = await refreshAccessTokenService(userId, deviceInfo, String(payload.jti));
    // Set rotated refresh token in cookie
    if (result.refresh_token) {
      res.cookie('refreshToken', result.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: _JWT_SETTINGS.jwt_refresh_expiration_minutes * 60 * 1000
      });
    }
    const { refresh_token, ...responsePayload } = result;
    
    logger.info('[Auth] Refresh Token successful', { userId });
    buildResponse(res, HTTP.OK, responsePayload, 'Token refreshed successfully');
  } catch (err: any) {
    const status = err?.statusCode ?? 500;
    const message = err?.message ?? 'Error refreshing access token';
    if (status >= 500) logger.error(message); else logger.warn(message);
    res.status(status).json({ success: false, data: null, message });
  }
});
