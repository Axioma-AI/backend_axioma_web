import { Router, Request, Response, NextFunction } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { updateProfileService } from '../../../../services/profile/profile_service';
import { AdminUserIdentifierQuerySchema } from '../../../../schemas/admin/interests/zod/user_identifier_query_schema';
import type { AdminUserIdentifierQueryDTO } from '../../../../schemas/admin/interests/dto/user_identifier_query_dto';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminUsersPatchRouter = Router();

/**
 * @openapi
 * /api/v1/admin/users:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualizar datos de un usuario (ADMIN)
 *     description: |
 *       Permite actualizar parcialmente los datos de un usuario creado por el admin autenticado.
 *       - Identificador: proveer exactamente uno entre `id`, `email`, `username` (query).
 *       - Campos actualizables: `name`, `lastname`, `username`, `phone`, `country_code`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: email
 *         required: false
 *         schema: { type: string, format: email }
 *       - in: query
 *         name: username
 *         required: false
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUpdateUserRequest'
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseAdminUpdateUser'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *       403:
 *         description: Acceso restringido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 *       404:
 *         description: Usuario no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseErrorResponse'
 */
adminUsersPatchRouter.patch('/users', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const parsed = AdminUserIdentifierQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues?.[0]?.message ?? 'Invalid query', HTTP.BAD_REQUEST);
    }
    const query = parsed.data as AdminUserIdentifierQueryDTO;

    let user: any = null;
    if (typeof query.id === 'number') {
      user = await prisma.users.findUnique({ where: { id: query.id } });
    } else if (typeof query.email === 'string') {
      user = await prisma.users.findUnique({ where: { email: query.email } });
    } else if (typeof query.username === 'string') {
      user = await prisma.users.findUnique({ where: { username: query.username } });
    }
    if (!user) {
      throw new ValidationError('User not found.', HTTP.NOT_FOUND);
    }
    if (user.id !== adminId) {
      if (!user.created_by_id || Number(user.created_by_id) !== adminId) {
        throw new ValidationError('No puedes actualizar usuarios que no has creado.', 403);
      }
    }

    const result = await updateProfileService(Number(user.id), req.body, undefined);
    buildResponse(res, HTTP.OK, result, 'Usuario actualizado');
  } catch (err: any) {
    next(err);
  }
});

export default adminUsersPatchRouter;
