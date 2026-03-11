import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { forgotPasswordService } from '../../../../services/auth/forgot_password_service';
import { AuthError, ValidationError } from '../../../../utils/errors';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const forgotPasswordRouter = Router();
const upload = multer();

/**
 * @openapi
 * components:
 *   schemas:
 *     ForgotPasswordSchema:
 *       type: object
 *       required:
 *         - last_password
 *         - new_password
 *       properties:
 *         email:
 *           type: string
 *           example: john@example.com
 *         username:
 *           type: string
 *           example: johndoe2
 *         last_password:
 *           type: string
 *           description: The last password the user remembers.
 *           example: OldPassw0rd!
 *         new_password:
 *           type: string
 *           description: The new password to set.
 *           example: NewPassw0rd!1
 *         phone:
 *           type: string
 *           example: "5551234567"
 *         first_name:
 *           type: string
 *           example: John
 *         last_name_paternal:
 *           type: string
 *           example: Doe
 *         last_name_maternal:
 *           type: string
 *           example: Smith
 *         country_code:
 *           type: string
 *           example: "52"
 */

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Forgot Password
 *     description: |
 *       Secure password recovery mechanism.
 *       It requires validating the user's identity by answering security questions based on their profile data
 *       AND verifying the last remembered password against the password history.
 *       
 *       **Validation Rules:**
 *       1. `last_password` must match one of the user's previous passwords (or current).
 *       2. At least **3** security fields must match the user's profile data (`first_name`, `last_name_paternal`, `last_name_maternal`, `phone`, `country_code`).
 *       3. `new_password` must NOT match any of the user's previous passwords.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordSchema'
 *           examples:
 *             by_email:
 *               summary: Recover using email and profile data
 *               value:
 *                 email: john@example.com
 *                 last_password: OldPassw0rd!
 *                 new_password: NewPassw0rd!1
 *                 first_name: John
 *                 last_name_paternal: Doe
 *                 last_name_maternal: Smith
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordSchema'
 *           examples:
 *             by_username:
 *               summary: Recover using username and phone
 *               value:
 *                 username: johndoe2
 *                 last_password: OldPassw0rd!
 *                 new_password: NewPassw0rd!1
 *                 phone: "5551234567"
 *                 country_code: "52"
 *     responses:
 *       200:
 *         description: Password successfully updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseForgotPassword'
 *             example:
 *               success: true
 *               data:
 *                 success: true
 *               message: "Password updated successfully"
 *       400:
 *         description: Invalid recovery data (wrong password, answers mismatch, or weak password).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "Invalid recovery data."
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *             example:
 *               success: false
 *               data: null
 *               message: "User not found."
 */
forgotPasswordRouter.post('/forgot-password', upload.none(), async (req: Request, res: Response) => {
  try {
    logger.info('[Auth] Forgot Password attempt', { email: req.body.email, username: req.body.username });
    const result = await forgotPasswordService(req.body);
    logger.info('[Auth] Forgot Password successful', { success: result.success });
    buildResponse(res, HTTP.OK, result, 'Password updated successfully');
  } catch (err: any) {
    const status = err?.statusCode ?? 400;
    const message = err?.message ?? 'Password recovery error';
    if (err instanceof AuthError || err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    res.status(status).json({ success: false, data: null, message });
  }
});
