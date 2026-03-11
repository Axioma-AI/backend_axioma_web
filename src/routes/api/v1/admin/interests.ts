import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { AdminUserIdentifierQuerySchema } from '../../../../schemas/admin/interests/zod/user_identifier_query_schema';
import { AdminInterestCreateBodySchema } from '../../../../schemas/admin/interests/zod/interest_create_body_schema';
import { AdminInterestDeleteParamsSchema } from '../../../../schemas/admin/interests/zod/interest_delete_params_schema';
import { AdminUserIdentifierQueryDTO } from '../../../../schemas/admin/interests/dto/user_identifier_query_dto';
import { AdminInterestCreateDTO } from '../../../../schemas/admin/interests/dto/interest_create_dto';
import { AdminInterestCreateResponse, AdminInterestDeletedResponse } from '../../../../schemas/admin/interests/response';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminInterestsRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/admin/interests:
 *   post:
 *     tags: [Admin Interests]
 *     summary: Crear interest para un usuario (ADMIN)
 *     description: |
 *       Crea un interest para un usuario creado por el admin autenticado.
 *       Respeta `seats_quota` del usuario.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema: { type: integer }
 *       - in: query
 *         name: email
 *         schema: { type: string }
 *       - in: query
 *         name: username
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interest creado
 *       400:
 *         description: Datos inválidos o sin seats disponibles
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Usuario no encontrado
 */
adminInterestsRouter.post('/interests', requireAdmin, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const query = AdminUserIdentifierQuerySchema.parse(req.query) as AdminUserIdentifierQueryDTO;
    const body = AdminInterestCreateBodySchema.parse(req.body) as AdminInterestCreateDTO;

    let user: any = null;
    if (query.id) user = await prisma.users.findUnique({ where: { id: query.id } });
    else if (query.email) user = await prisma.users.findUnique({ where: { email: query.email } });
    else if (query.username) user = await prisma.users.findUnique({ where: { username: query.username } });
    if (!user) throw new ValidationError('User not found.', HTTP.NOT_FOUND);
    if (!user.created_by_id || Number(user.created_by_id) !== adminId) {
      throw new ValidationError('No puedes crear interests para usuarios que no has creado.', 403);
    }

    const used = await prisma.interests.count({ where: { user_id: user.id } });
    if (used >= Number(user.seats_quota ?? 0)) {
      throw new ValidationError('No hay seats disponibles para crear más interests', HTTP.BAD_REQUEST);
    }

    const exists = await prisma.interests.findFirst({ where: { user_id: user.id, name: body.name } });
    if (exists) {
      throw new ValidationError('Ya existe un interest con ese nombre para el usuario', HTTP.BAD_REQUEST);
    }

    const interest = await prisma.interests.create({
      data: { user_id: user.id, name: body.name },
    });

    logger.info(`[Admin Interests] Created interest id=${interest.id} for user=${user.id}`);
    const payload: AdminInterestCreateResponse = { user_id: user.id, interest_id: interest.id, name: interest.name };
    buildResponse(res, HTTP.OK, payload, 'Interest creado');
  } catch (err) {
    next(err as any);
  }
});

/**
 * @openapi
 * /api/v1/admin/interests/{interestId}:
 *   delete:
 *     tags: [Admin Interests]
 *     summary: Eliminar interest de un usuario (ADMIN)
 *     description: |
 *       Elimina un interest de un usuario creado por el admin.
 *       Si el interest pertenece a algún grupo, se valida que dichos grupos mantengan al menos 2 interests.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: interestId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Interest eliminado
 *       400:
 *         description: Regla de grupos ≥ 2 violada
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Interest/Usuario no encontrado
 */
adminInterestsRouter.delete('/interests/:interestId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const { interestId } = AdminInterestDeleteParamsSchema.parse(req.params);
    const interest = await prisma.interests.findUnique({ where: { id: interestId } });
    if (!interest) throw new ValidationError('Interest no encontrado', HTTP.NOT_FOUND);
    const user = await prisma.users.findUnique({ where: { id: Number(interest.user_id) } });
    if (!user || Number(user.created_by_id) !== adminId) {
      throw new ValidationError('No puedes eliminar interests de usuarios que no has creado.', 403);
    }
    const items = await prisma.interest_group_items.findMany({ where: { interest_id: interestId } });
    for (const it of items) {
      const count = await prisma.interest_group_items.count({ where: { group_id: Number(it.group_id) } });
      if (count <= 2) {
        throw new ValidationError('El grupo debe mantener al menos 2 interests. Elimine el grupo o quite otros interests antes.', HTTP.BAD_REQUEST);
      }
    }
    await prisma.$transaction(async (tx) => {
      await tx.interest_group_items.deleteMany({ where: { interest_id: interestId } });
      await tx.interests.delete({ where: { id: interestId } });
    });
    const payload: AdminInterestDeletedResponse = { deleted_interest_id: interestId };
    buildResponse(res, HTTP.OK, payload, 'Interest eliminado');
  } catch (err) {
    next(err as any);
  }
});

export default adminInterestsRouter;
