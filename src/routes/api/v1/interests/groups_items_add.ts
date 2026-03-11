import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { InterestsGroupDeleteParamsSchema } from '../../../../schemas/interests/zod/groups_delete_params_schema';
import { InterestsGroupItemAddSchema } from '../../../../schemas/interests/zod/groups_items_add_schema';
import type { InterestsGroupDeleteParamsDTO } from '../../../../schemas/interests/dto/groups_delete_params_dto';
import type { InterestsGroupItemAddDTO } from '../../../../schemas/interests/dto/groups_items_add_dto';
import type { GroupItemAddedResponse } from '../../../../schemas/interests/response';

export const interestsGroupsItemsAddRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/interests/groups/{groupId}/items:
 *   post:
 *     tags: [User Interests]
 *     summary: Añadir interest existente (o crear si falta) a un grupo
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
 *             description: Proveer interest_id o interest_name (exactamente uno).
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               interest_id: { type: integer }
 *               interest_name: { type: string }
 *             description: Proveer interest_id o interest_name (exactamente uno).
 *     responses:
 *       200:
 *         description: Interest añadido al grupo
 *       400:
 *         description: Datos inválidos o sin seats disponibles
 *       404:
 *         description: Grupo o interest no encontrado
 */
interestsGroupsItemsAddRouter.post('/groups/:groupId/items', requireBearerAuth, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const params: InterestsGroupDeleteParamsDTO = InterestsGroupDeleteParamsSchema.parse(req.params as any);
    const groupId = params.groupId;
    const group = await prisma.interest_groups.findUnique({ where: { id: groupId } });
    if (!group || Number(group.user_id) !== userId) throw new ValidationError('Grupo no encontrado', HTTP.NOT_FOUND);

    const body: InterestsGroupItemAddDTO = InterestsGroupItemAddSchema.parse(req.body);
    const idInput = body.interest_id;
    const nameInput = body.interest_name ?? '';

    let interest: any = null;
    if (typeof idInput === 'number' && Number.isFinite(idInput) && idInput > 0) {
      const interestId = idInput;
      interest = await prisma.interests.findUnique({ where: { id: interestId } });
      if (!interest || Number(interest.user_id) !== userId) throw new ValidationError('Interest no encontrado', HTTP.NOT_FOUND);
    } else {
      const exists = await prisma.interests.findFirst({ where: { user_id: userId, name: nameInput } });
      if (exists) {
        interest = exists;
      } else {
        const user = await prisma.users.findUnique({ where: { id: userId } });
        if (!user) throw new ValidationError('Usuario no encontrado', HTTP.NOT_FOUND);
        const used = await prisma.interests.count({ where: { user_id: userId } });
        if (used >= Number(user.seats_quota ?? 0)) {
          throw new ValidationError('No hay seats disponibles para crear más interests', HTTP.BAD_REQUEST);
        }
        interest = await prisma.interests.create({ data: { user_id: userId, name: nameInput } });
      }
    }

    const existsItem = await prisma.interest_group_items.findFirst({ where: { group_id: groupId, interest_id: interest.id } });
    if (existsItem) {
      const payload: GroupItemAddedResponse = { group_id: groupId, interest_id: interest.id, already: true };
      buildResponse(res, HTTP.OK, payload, 'Interest ya pertenecía al grupo');
      return;
    }

    await prisma.interest_group_items.create({ data: { group_id: groupId, interest_id: interest.id } });
    const payload: GroupItemAddedResponse = { group_id: groupId, interest_id: interest.id };
    buildResponse(res, HTTP.OK, payload, 'Interest añadido al grupo');
  } catch (err) {
    next(err as any);
  }
});
