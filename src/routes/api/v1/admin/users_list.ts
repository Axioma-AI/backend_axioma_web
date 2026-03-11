import { Router, Request, Response, NextFunction } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { listUsersService } from '../../../../services/admin/users_service';
import { ValidationError } from '../../../../utils/errors';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { AdminUsersListQuerySchema } from '../../../../schemas/admin/users_list/zod/users_list_query_schema';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminUsersRouter = Router();

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Listar usuarios (solo ADMIN)
 *     description: |
 *       Devuelve el listado paginado de usuarios. Requiere rol **admin**.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página a obtener (>=1).
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Tamaño de página (<=100).
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Búsqueda por email, username o nombre/apellidos.
 *       - in: query
 *         name: role_name
 *         schema:
 *           type: string
 *           enum: [admin, member]
 *         description: Filtrar por rol (admin/member).
 *     responses:
 *       200:
 *         description: "Lista de usuarios"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseAdminUsersList'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 */
adminUsersRouter.get('/users', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = AdminUsersListQuerySchema.safeParse({
      page: req.query.page,
      size: req.query.size,
      q: req.query.q,
      role_name: req.query.role_name,
    });
    if (!parsed.success) {
      throw new ValidationError('Parámetros inválidos para listar usuarios', HTTP.BAD_REQUEST);
    }

    const created_by_id = Number((req as any).userId);
    const result = await listUsersService({ ...parsed.data, created_by_id });
    buildResponse(res, HTTP.OK, result, 'Users fetched');
  } catch (err: any) {
    const message = err?.message ?? 'Error listing users';
    if (err instanceof ValidationError) {
      logger.warn(message);
    } else {
      logger.error(message);
    }
    next(err);
  }
});
