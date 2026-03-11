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
import { AdminGroupsCreateBodySchema } from '../../../../schemas/admin/interests/zod/groups_create_body_schema';
import { AdminGroupDeleteParamsSchema } from '../../../../schemas/admin/interests/zod/group_delete_params_schema';
import { AdminGroupItemAddBodySchema } from '../../../../schemas/admin/interests/zod/group_item_add_body_schema';
import { AdminUserIdentifierQueryDTO } from '../../../../schemas/admin/interests/dto/user_identifier_query_dto';
import { AdminGroupsCreateDTO } from '../../../../schemas/admin/interests/dto/groups_create_dto';
import { AdminGroupDeletedResponse, AdminInterestGroupAddItemResponse, AdminInterestGroupCreateResponse } from '../../../../schemas/admin/interests/response';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminInterestsGroupsRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/admin/interests/groups:
 *   post:
 *     tags: [Admin Interests]
 *     summary: Crear grupo de interests para un usuario (ADMIN)
 *     description: |
 *       Crea un grupo para un usuario creado por el admin. Puede incluir `interest_names`; se crearán los faltantes respetando los seats del usuario.
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
 *               name: { type: string }
 *               interest_names:
 *                 type: array
 *                 items: { type: string }
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               interest_names:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Grupo creado
 *       400:
 *         description: Datos inválidos
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Usuario no encontrado
 */
adminInterestsGroupsRouter.post('/interests/groups', requireAdmin, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const query = AdminUserIdentifierQuerySchema.parse(req.query) as AdminUserIdentifierQueryDTO;
    const body = AdminGroupsCreateBodySchema.parse(req.body) as AdminGroupsCreateDTO;

    let user: any = null;
    if (query.id) user = await prisma.users.findUnique({ where: { id: query.id } });
    else if (query.email) user = await prisma.users.findUnique({ where: { email: query.email } });
    else if (query.username) user = await prisma.users.findUnique({ where: { username: query.username } });
    if (!user) throw new ValidationError('User not found.', HTTP.NOT_FOUND);
    if (!user.created_by_id || Number(user.created_by_id) !== adminId) {
      throw new ValidationError('No puedes gestionar groups para usuarios que no has creado.', 403);
    }

    const name = body.name;
    const interestNames = body.interest_names;

    const existingInterests = await prisma.interests.findMany({ where: { user_id: user.id, name: { in: interestNames } } });
    const existingNames = new Set(existingInterests.map(i => i.name));
    const missingNames = interestNames.filter(n => !existingNames.has(n));
    const used = await prisma.interests.count({ where: { user_id: user.id } });
    const remainingSeats = Number(user.seats_quota ?? 0) - used;
    if (missingNames.length > remainingSeats) {
      throw new ValidationError('No hay seats suficientes para crear todos los interests solicitados', HTTP.BAD_REQUEST);
    }

    const created = await prisma.$transaction(async (tx) => {
      const newInterests = await Promise.all(missingNames.map(n => tx.interests.create({ data: { user_id: user.id, name: n } })));
      const group = await tx.interest_groups.create({ data: { user_id: user.id, name } });
      const allInterests = [...existingInterests, ...newInterests];
      if (allInterests.length < 2) {
        throw new ValidationError('Un grupo debe contener al menos 2 interests', HTTP.BAD_REQUEST);
      }
      for (const i of allInterests) {
        await tx.interest_group_items.create({ data: { group_id: group.id, interest_id: i.id } });
      }
      return { group, interests: allInterests };
    });

    const payload: AdminInterestGroupCreateResponse = { user_id: user.id, group_id: created.group.id, name: created.group.name, interests: created.interests.map(i => ({ id: i.id, name: i.name })) };
    buildResponse(res, HTTP.OK, payload, 'Grupo creado');
  } catch (err) {
    next(err as any);
  }
});

export default adminInterestsGroupsRouter;

/**
 * @openapi
 * /api/v1/admin/interests/groups/{groupId}:
 *   delete:
 *     tags: [Admin Interests]
 *     summary: Eliminar un grupo de interests de un usuario (ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Grupo eliminado
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Grupo/Usuario no encontrado
 */
adminInterestsGroupsRouter.delete('/interests/groups/:groupId', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const { groupId } = AdminGroupDeleteParamsSchema.parse(req.params);
    const group = await prisma.interest_groups.findUnique({ where: { id: groupId } });
    if (!group) throw new ValidationError('Grupo no encontrado', HTTP.NOT_FOUND);
    const user = await prisma.users.findUnique({ where: { id: Number(group.user_id) } });
    if (!user || Number(user.created_by_id) !== adminId) {
      throw new ValidationError('No puedes eliminar grupos de usuarios que no has creado.', 403);
    }
    await prisma.interest_groups.delete({ where: { id: groupId } });
    const payload: AdminGroupDeletedResponse = { deleted_group_id: groupId };
    buildResponse(res, HTTP.OK, payload, 'Grupo eliminado');
  } catch (err) {
    next(err as any);
  }
});

/**
 * @openapi
 * /api/v1/admin/interests/groups/{groupId}/items:
 *   post:
 *     tags: [Admin Interests]
 *     summary: Añadir interest existente (o crear si falta) a un grupo de un usuario (ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interest_id: { type: integer }
 *               interest_name: { type: string }
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               interest_id: { type: integer }
 *               interest_name: { type: string }
 *     responses:
 *       200:
 *         description: Interest añadido al grupo
 *       400:
 *         description: Datos inválidos o sin seats disponibles
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Grupo o interest no encontrado
 */
adminInterestsGroupsRouter.post('/interests/groups/:groupId/items', requireAdmin, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const { groupId } = AdminGroupDeleteParamsSchema.parse(req.params);
    const group = await prisma.interest_groups.findUnique({ where: { id: groupId } });
    if (!group) throw new ValidationError('Grupo no encontrado', HTTP.NOT_FOUND);

    const user = await prisma.users.findUnique({ where: { id: Number(group.user_id) } });
    if (!user || Number(user.created_by_id) !== adminId) {
      throw new ValidationError('No puedes gestionar groups para usuarios que no has creado.', 403);
    }

    const addBody = AdminGroupItemAddBodySchema.parse(req.body);

    let interest: any = null;
    if (addBody.interest_id) {
      const interestId = addBody.interest_id;
      interest = await prisma.interests.findUnique({ where: { id: interestId } });
      if (!interest || Number(interest.user_id) !== Number(user.id)) throw new ValidationError('Interest no encontrado', HTTP.NOT_FOUND);
    } else {
      const exists = await prisma.interests.findFirst({ where: { user_id: Number(user.id), name: addBody.interest_name! } });
      if (exists) {
        interest = exists;
      } else {
        const used = await prisma.interests.count({ where: { user_id: Number(user.id) } });
        if (used >= Number(user.seats_quota ?? 0)) {
          throw new ValidationError('No hay seats disponibles para crear más interests', HTTP.BAD_REQUEST);
        }
        interest = await prisma.interests.create({ data: { user_id: Number(user.id), name: addBody.interest_name! } });
      }
    }

    const existsItem = await prisma.interest_group_items.findFirst({ where: { group_id: groupId, interest_id: interest.id } });
    if (existsItem) {
      const payload: AdminInterestGroupAddItemResponse = { group_id: groupId, interest_id: interest.id, already: true };
      buildResponse(res, HTTP.OK, payload, 'Interest ya pertenecía al grupo');
      return;
    }

    await prisma.interest_group_items.create({ data: { group_id: groupId, interest_id: interest.id } });
    const payload: AdminInterestGroupAddItemResponse = { group_id: groupId, interest_id: interest.id };
    buildResponse(res, HTTP.OK, payload, 'Interest añadido al grupo');
  } catch (err) {
    next(err as any);
  }
});
