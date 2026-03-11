import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { createPersonalTokenService, listUserActiveTokensService, revokePersonalTokenService } from '../../../../services/auth/personal_token_service';
import { ValidationError } from '../../../../utils/errors';
import { zodValidation } from '../../../../utils/zod_validation';
import { PersonalTokenCreateSchema } from '../../../../schemas/auth/personal_token/zod/personal_token_schema';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const personalTokenRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/auth/personal-token/create:
 *   post:
 *     tags: [Auth]
 *     summary: Create personal access token
 *     description: |
 *       Generates a personal access token for the authenticated user.
 *       - Returns the token in plain text only once; it will not be shown again.
 *       - Requires Bearer authentication.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/PersonalTokenCreateRequest'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PersonalTokenCreateRequest'
 *           examples:
 *             default:
 *               summary: Token without name using default expiration
 *               value: {}
 *             with_name_and_expiry:
 *               summary: Named token with 30-day expiration
 *               value:
 *                 name: CI pipeline token
 *                 expires_preset: "1_month"
 *     responses:
 *       200:
 *         description: Personal token created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponsePersonalTokenCreate'
 *       401:
 *         description: Unauthorized
 */
personalTokenRouter.post('/personal-token/create', requireBearerAuth, upload.none(), async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    logger.info('[Auth] Create Personal Token attempt', { userId, name: req.body?.name });
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }
    const { name, expires_preset } = zodValidation(PersonalTokenCreateSchema, req.body);
    const result = await createPersonalTokenService(userId, name ?? undefined, (expires_preset as any) ?? undefined);
    logger.info('[Auth] Create Personal Token successful', { userId });
    buildResponse(res, HTTP.OK, result, 'Personal token created');
  } catch (err: any) {
    const message = err?.message ?? 'Error creating personal token';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/auth/personal-token/list:
 *   get:
 *     tags: [Auth]
 *     summary: List your active personal tokens
 *     description: |
 *       Returns the active personal tokens of the authenticated user.
 *       - Available only with Bearer authentication.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active tokens
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponsePersonalTokenList'
 *       401:
 *         description: Unauthorized
 */
personalTokenRouter.get('/personal-token/list', requireBearerAuth, async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }
    const tokens = await listUserActiveTokensService(userId);
    buildResponse(res, HTTP.OK, tokens, 'Personal tokens fetched');
  } catch (err: any) {
    const message = err?.message ?? 'Error listing personal tokens';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});

/**
 * @openapi
 * /api/v1/auth/personal-token/{id}:
 *   delete:
 *     tags: [Auth]
 *     summary: Revoke personal token by ID
 *     description: |
 *       Revokes (invalidates) a personal token of the authenticated user.
 *       - Only the owner can revoke their token.
 *       - Once revoked, the token cannot be used.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Token revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponsePersonalTokenRevoke'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Token not found or does not belong to the user
 */
personalTokenRouter.delete('/personal-token/:id', requireBearerAuth, async (req: Request, res: Response, next) => {
  try {
    const userId = Number((req as any).userId);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new ValidationError('User not authenticated.', 401);
    }
    const id = Number(req.params.id);
    const result = await revokePersonalTokenService(userId, id);
    buildResponse(res, HTTP.OK, result, 'Personal token revoked');
  } catch (err: any) {
    const message = err?.message ?? 'Error revoking personal token';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});
