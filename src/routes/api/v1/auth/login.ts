import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings, getJwtSettings, type JwtSettings } from '../../../../config/settings';
import { loginService } from '../../../../services/auth/login_service';
import { AuthError, ValidationError } from '../../../../utils/errors';
import { getDeviceInfo } from '../../../../utils/device_info';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const _JWT_SETTINGS: JwtSettings = getJwtSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const loginRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: |
 *       Authenticates a user using **email** or **username** plus **password**.
 *       - Password requires at least 8 characters.
 *       - Returns an **access_token (JWT)** to use in `Authorization: Bearer <token>`.
 *       - The JWT includes only minimal claims: `sub`, `role_id`, `jti`; `two_factor_pending` only when applicable. It does not contain sensitive data.
 *       - Sets a **refreshToken** cookie (HttpOnly, Secure, SameSite=strict) to refresh tokens.
 *       - If an active session already exists for the user, returns **409 Conflict** with details of the active session.
 *       - You can force a new session (logging out previous ones) by sending `force_new_session: true`.
 *       - If 2FA is enabled for the user and you do not send `two_factor_token`, the login is **two-step**:
 *         - Response includes `requires_two_factor: true` and the token has `two_factor_pending: true`.
 *         - That token does NOT have access to protected endpoints.
 *         - Then call `POST /api/v1/auth/two-factor/login` with the 2FA code to gain full access.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             email_login:
 *               summary: Login using email
 *               value:
 *                 email: john@example.com
 *                 password: MyPassw0rd!
 *             email_login_2fa:
 *               summary: Login using email with 2FA enabled
 *               value:
 *                 email: john@example.com
 *                 password: MyPassw0rd!
 *                 two_factor_token: "123456"
 *             username_login:
 *               summary: Login using username
 *               value:
 *                 username: john123
 *                 password: MyPassw0rd!
 *             force_session:
 *               summary: Force new session
 *               value:
 *                 email: john@example.com
 *                 password: MyPassw0rd!
 *                 force_new_session: true
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             email_login_form:
 *               summary: Login (form-data) using email
 *               value:
 *                 email: john@example.com
 *                 password: MyPassw0rd!
 *             email_login_form_2fa:
 *               summary: Login (form-data) using email with 2FA enabled
 *               value:
 *                 email: john@example.com
 *                 password: MyPassw0rd!
 *                 two_factor_token: "123456"
 *             username_login_form:
 *               summary: Login (form-data) using username
 *               value:
 *                 username: john123
 *                 password: MyPassw0rd!
 *     responses:
 *       '200':
 *         description: Login successful (may require 2FA)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseLogin'
 *             examples:
 *               no_2fa:
 *                 summary: 2FA not enabled
 *                 value:
 *                   success: true
 *                   data:
 *                     user_id: 1
 *                     role_id: 2
 *                     access_token: "<JWT>"
 *                   message: "Login successful"
 *               two_step:
 *                 summary: 2FA enabled, second step required
 *                 value:
 *                   success: true
 *                   data:
 *                     user_id: 1
 *                     role_id: 2
 *                     access_token: "<JWT with two_factor_pending>"
 *                     requires_two_factor: true
 *                   message: "Login successful"
 *               password_change_required:
 *                 summary: Password change required
 *                 value:
 *                   success: true
 *                   data:
 *                     user_id: 1
 *                     role_id: 2
 *                     access_token: "<JWT>"
 *                     requires_password_change: true
 *                   message: "Login successful"
 *       '400':
 *         description: Invalid 2FA token when provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "Invalid 2FA token."
 *       '409':
 *         description: An active session already exists for this user.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "An active session already exists for this user."
 *       '401':
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "Invalid credentials."
 */
loginRouter.post('/login', upload.none(), async (req: Request, res: Response) => {
  try {
    logger.info('[Auth] Login attempt', { email: req.body.email, username: req.body.username, hasTwoFactorToken: !!req.body.two_factor_token });
    const deviceInfo = getDeviceInfo(req);
    const result = await loginService(req.body, deviceInfo);
    logger.info('[Auth] Login successful', { userId: result.user_id, roleId: result.role_id, requiresTwoFactor: result.requires_two_factor });

    if (result.refresh_token) {
      res.cookie('refreshToken', result.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: _JWT_SETTINGS.jwt_refresh_expiration_minutes * 60 * 1000
      });
    }

    const { refresh_token, ...responsePayload } = result;
    buildResponse(res, HTTP.OK, responsePayload, 'Login successful');
  } catch (err: any) {
    const status = err?.statusCode ?? 401;
    const message = err?.message ?? 'Error during login';

    if (err instanceof AuthError || err instanceof ValidationError) {
      logger.warn(`Invalid login: ${message}`);
    } else {
      logger.error(`Login failed: ${message}`);
    }
    res.status(status).json({ success: false, data: null, message });
  }
});
