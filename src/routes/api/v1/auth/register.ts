import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { registerService, registerRootService } from '../../../../services/auth/register_service';
import { ValidationError } from '../../../../utils/errors';
import { decodeToken } from '../../../../utils/jwt';
import { getUserById } from '../../../../repositories/auth/common_repository';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const registerRouter = Router();
const upload = multer();

 registerRouter.post('/register', upload.none(), async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
    if (!token) {
      throw new ValidationError('Missing Authorization Bearer.', 401);
    }
    const decoded = await decodeToken(token);
    if (!decoded || !decoded.sub) {
      throw new ValidationError('Invalid token.', 401);
    }
    const requesterId = Number(decoded.sub);
    const requester = await getUserById(requesterId);
    if (!requester || requester.role_name !== 'admin') {
      throw new ValidationError('Restricted access: requires admin role.', 403);
    }

    const { user } = await registerService(req.body, requesterId);
    logger.info('[Auth] Register successful', { userId: user.id, username: user.username });
    buildResponse(res, HTTP.CREATED, { user }, 'User created');
  } catch (err: any) {
    const status = err?.statusCode ?? 400;
    const message = err?.message ?? 'Error during registration';
    if (err instanceof ValidationError) {
      logger.warn(`Invalid registration: ${message}`);
    } else {
      logger.error(`Registration failed: ${message}`);
    }
    res.status(status).json({ success: false, data: null, message });
  }
});

/**
 * @openapi
 * /api/v1/auth/register/root:
 *   post:
 *     tags: [Auth]
 *     summary: Initial ADMIN registration
 *     description: |
 *       Creates a new user with role `admin` by default.
 *       Use this endpoint to create the initial administrator account.
 *       - `username`: 3-20 characters; letters, numbers, `.` `_` `-`.
 *       - `email`: valid email format.
 *       - `phone`: 6-15 digits, no spaces or symbols.
 *       - `country_code`: phone country code (e.g. "52").
 *       - `password`: at least 8; must include uppercase, lowercase, number, and symbol; no sequential digits.
 *       Two-factor authentication (2FA) remains optional and can be configured later via 2FA endpoints.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRootRequest'
 *           example:
 *             first_name: Jane
 *             last_name_paternal: Admin
 *             last_name_maternal: Smith
 *             username: janeadmin
 *             email: admin@example.com
 *             phone: "65656565"
 *             country_code: "591"
 *             password: MyPassw0rd!
 *             confirm_password: MyPassw0rd!
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRootRequest'
 *           example:
 *             first_name: Jane
 *             last_name_paternal: Admin
 *             last_name_maternal: Smith
 *             username: janeadmin
 *             email: admin@example.com
 *             phone: "65656565"
 *             country_code: "591"
 *             password: MyPassw0rd!
 *             confirm_password: MyPassw0rd!
 *     responses:
 *       '201':
 *         description: ADMIN user created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseRegister'
 *             example:
 *               success: true
 *               data:
 *                 user:
 *                   id: 1
 *                   name: Jane
 *                   lastname: Admin
 *                   username: janeadmin
 *                   email: admin@example.com
 *                   phone: "65656565"
 *                   role:
 *                     id: 1
 *                     name: admin
 *               message: "ADMIN user created"
 *       '400':
 *         description: Invalid or duplicate data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 */
registerRouter.post('/register/root', upload.none(), async (req: Request, res: Response) => {
  try {
    logger.info('[Auth] Admin Register attempt', { email: req.body.email, username: req.body.username });
    const { user } = await registerRootService(req.body);
    logger.info('[Auth] Admin Register successful', { userId: user.id, username: user.username });
    buildResponse(res, HTTP.CREATED, { user }, 'ADMIN user created');
  } catch (err: any) {
    const status = err?.statusCode ?? 400;
    const message = err?.message ?? 'Error during ADMIN registration';
    if (err instanceof ValidationError) {
      logger.warn(`Invalid ADMIN registration: ${message}`);
    } else {
      logger.error(`ADMIN registration failed: ${message}`);
    }
    res.status(status).json({ success: false, data: null, message });
  }
});
