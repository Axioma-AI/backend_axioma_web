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

export const putProfileRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/profile:
 *   put:
 *     tags: [Profile]
 *     summary: Update authenticated user's profile (PUT)
 *     description: |
 *       Replaces the user's profile data with the provided values.
 *       - Allowed fields: `name`, `lastname`, `username`, `phone`, `country_code`
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
 *             name: John
 *             lastname: Doe
 *             username: johndoe2
 *             phone: "5551234567"
 *             country_code: "52"
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           examples:
 *             with_avatar:
 *               summary: Update profile including avatar
 *               value:
 *                 name: John
 *                 lastname: Doe
 *                 username: johndoe2
 *                 phone: "5551234567"
 *                 country_code: "52"
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
 *                 summary: Update response example
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
 *                         id: 4
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
putProfileRouter.put('/', requireAuth, upload.single('avatar'), async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[Profile] Put Profile attempt', { userId });
    const file = req.file
      ? { originalname: req.file.originalname, mimetype: req.file.mimetype, buffer: req.file.buffer, size: req.file.size }
      : undefined;
    const result = await updateProfileService(userId, req.body, file);
    logger.info('[Profile] Put Profile successful', { userId });
    return buildResponse(res, HTTP.OK, result, 'Profile updated successfully');
  } catch (err: any) {
    const message = err?.message ?? 'Error updating profile';
    if (err instanceof ValidationError) {
      logger.warn(`Invalid profile update: ${message}`);
    } else {
      logger.error(`Profile update failed: ${message}`);
    }
    next(err);
  }
});
