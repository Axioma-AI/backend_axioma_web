import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { updateProfileService } from '../../../../services/profile/profile_service';
import { requireAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const patchProfileRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/profile:
 *   patch:
 *     tags: [Profile]
 *     summary: Patch authenticated user's profile
 *     description: |
 *       Allows partial updates of the user's profile.
 *       - Updatable fields: `name`, `lastname`, `username`, `phone`, `country_code`
 *       - Empty strings are normalized and do not apply updates
 *       - To update the avatar, send `multipart/form-data` with the `avatar` file field
 *       - Avatar is stored in DB; response includes `avatar_url` as `/api/v1/profile/avatar`
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           example:
 *             phone: "5551234567"
 *             country_code: "52"
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           examples:
 *             partial_with_avatar:
 *               summary: Update only avatar and phone
 *               value:
 *                 phone: "5551234567"
 *                 avatar: (binary)
 *     responses:
 *       '200':
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseUpdateProfile'
 *             examples:
 *               default:
 *                 summary: Partial update response example
 *                 value:
 *                   success: true
 *                   data:
 *                     user:
 *                       id: 7
 *                       name: John
 *                       lastname: Doe
 *                       username: johndoe2
 *                       email: john2@example.com
 *                       phone: "5551234567"
 *                       country_code: "52"
 *                       avatar_url: "/api/v1/profile/avatar"
 *                       role:
 *                         name: "member"
 *                   message: "Profile updated successfully"
 *       '400':
 *         description: Invalid input
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
 *                   message: 'Invalid profile input.'
 *       '401':
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
 */
patchProfileRouter.patch('/', requireAuth, upload.single('avatar'), async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[Profile] Patch Profile attempt', { userId });
    const file = req.file
      ? { originalname: req.file.originalname, mimetype: req.file.mimetype, buffer: req.file.buffer, size: req.file.size }
      : undefined;
    const result = await updateProfileService(userId, req.body, file);
    logger.info('[Profile] Patch Profile successful', { userId });
    return buildResponse(res, HTTP.OK, result, 'Profile updated successfully');
  } catch (err: any) {
    const message = err?.message ?? 'Error updating profile';
    if (err instanceof ValidationError) {
      logger.warn(`Invalid profile patch: ${message}`);
    } else {
      logger.error(`Profile patch failed: ${message}`);
    }
    next(err);
  }
});
