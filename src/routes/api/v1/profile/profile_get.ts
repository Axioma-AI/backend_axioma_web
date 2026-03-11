import { Router, Request, Response } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { getProfileService } from '../../../../services/profile/profile_service';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const getProfileRouter = Router();

/**
 * @openapi
 * /api/v1/profile:
 *   get:
 *     tags: [Profile]
 *     summary: Get authenticated user's profile
 *     description: |
 *       Returns the authenticated user's profile details.
 *       - Includes `avatar_url` pointing to `/api/v1/profile/avatar` for downloading the avatar stored in DB
 *       - Does not expose external storage providers
 *     security:
 *       - bearerAuth: []
 *     parameters: []
 *     responses:
 *       '200':
 *         description: Profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseGetProfile'
 *             examples:
 *               default:
 *                 summary: Profile response example
 *                 value:
 *                   success: true
 *                   data:
 *                     user:
 *                       id: 7
 *                       name: John
 *                       paternal_lastname: Doe
 *                       maternal_lastname: null
 *                       username: johndoe2
 *                       email: john2@example.com
 *                       phone: "5551234567"
 *                       country_code: "52"
 *                       avatar_url: "/api/v1/profile/avatar"
 *                       role:
 *                         id: 4
 *                         name: "member"
 *                   message: "Profile fetched successfully"
 *       '400':
 *         description: Invalid request
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
 *       '404':
 *         description: Not found
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
getProfileRouter.get('/', requireBearerAuth, async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    logger.debug('[Profile] Get Profile request', { userId });
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', HTTP.UNAUTHORIZED);
    }
    logger.info('[Profile] Get Profile attempt', { userId });
    const result = await getProfileService(userId);
    logger.info('[Profile] Get Profile successful', { userId });
    return buildResponse(res, HTTP.OK, result, 'Profile fetched successfully');
  } catch (err: any) {
    const message = err?.message ?? 'Error fetching profile';
    if (err instanceof ValidationError) {
      logger.warn(`Invalid profile request: ${message}`);
    } else {
      logger.error(`Get profile failed: ${message}`);
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/profile/avatar:
 *   get:
 *     tags: [Profile]
 *     summary: Download authenticated user's avatar
 *     description: |
 *       Returns the avatar image stored in the database for the authenticated user.
 *       - Content-Type is set according to the avatar_type.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Avatar image
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       '404':
 *         description: No avatar found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 */
getProfileRouter.get('/avatar', requireBearerAuth, async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', HTTP.UNAUTHORIZED);
    }
    const { prisma } = await import('../../../../config/db_config');
    const entity = await prisma.users.findUnique({
      where: { id: userId },
      select: { avatar_data: true, avatar_type: true }
    });
    if (!entity || !entity.avatar_data) {
      throw new ValidationError('Avatar not found.', 404);
    }
    const type = (entity.avatar_type || 'jpeg').toString().toLowerCase();
    const mime = type === 'png' ? 'image/png'
      : type === 'heic' ? 'image/heic'
      : type === 'heif' ? 'image/heif'
      : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.status(200).send(Buffer.from(entity.avatar_data));
  } catch (err: any) {
    const status = err?.statusCode ?? HTTP.INTERNAL_SERVER_ERROR;
    const message = err?.message ?? 'Error fetching avatar';
    next(new ValidationError(message, status));
  }
});
