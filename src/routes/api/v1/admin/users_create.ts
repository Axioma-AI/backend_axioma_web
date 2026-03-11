import { Router, Request, Response } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { registerService } from '../../../../services/auth/register_service';
import { ValidationError } from '../../../../utils/errors';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminUsersCreateRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/admin/users:
 *   post:
 *     tags: [Admin]
 *     summary: Crear usuario (solo ADMIN)
 *     description: |
 *       Crea un nuevo usuario. Accesible solo para usuarios con rol `admin`.
 *       El usuario creado queda vinculado al admin mediante `created_by_id`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       '201':
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseRegister'
 *       '400':
 *         description: Datos inválidos o duplicados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *       '403':
 *         description: Límite de creación alcanzado o acceso restringido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 */
adminUsersCreateRouter.post('/users', requireAdmin, upload.none(), async (req: Request, res: Response, next) => {
  try {
    const creatorId = Number((req as any).userId);
    const { user } = await registerService(req.body, creatorId);
    logger.info('[Admin] User create successful', { userId: user.id, username: user.username });
    buildResponse(res, HTTP.CREATED, { user }, 'User created');
  } catch (err: any) {
    const message = err?.message ?? 'Error creating user';
    if (err instanceof ValidationError) {
      logger.warn(`[Admin] Create user validation error: ${message}`);
    } else {
      logger.error(`[Admin] Create user failed: ${message}`);
    }
    next(err);
  }
});
