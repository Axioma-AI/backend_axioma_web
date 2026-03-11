import { Router, Request, Response, NextFunction } from 'express';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { InterestsGroupItemDeleteParamsSchema } from '../../../../schemas/interests/zod/groups_items_delete_params_schema';
import type { InterestsGroupItemDeleteParamsDTO } from '../../../../schemas/interests/dto/groups_items_delete_params_dto';
import type { GroupItemRemovedResponse } from '../../../../schemas/interests/response';

export const interestsGroupsItemsDeleteRouter = Router();

/**
 * @openapi
 * /api/v1/interests/groups/{groupId}/items/{interestId}:
 *   delete:
 *     tags: [User Interests]
 *     summary: Quitar interest de un grupo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: interestId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Interest removido del grupo
 *       400:
 *         description: El grupo no puede quedar con menos de 2 interests
 *       404:
 *         description: Grupo o interest no encontrado
 */
interestsGroupsItemsDeleteRouter.delete('/groups/:groupId/items/:interestId', requireBearerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const params: InterestsGroupItemDeleteParamsDTO = InterestsGroupItemDeleteParamsSchema.parse(req.params as any);
    const groupId = params.groupId;
    const interestId = params.interestId;
    const group = await prisma.interest_groups.findUnique({ where: { id: groupId } });
    if (!group || Number(group.user_id) !== userId) throw new ValidationError('Grupo no encontrado', HTTP.NOT_FOUND);
    const count = await prisma.interest_group_items.count({ where: { group_id: groupId } });
    if (count <= 2) {
      throw new ValidationError('El grupo debe mantener al menos 2 interests. Elimine el grupo si desea quitar más.', HTTP.BAD_REQUEST);
    }
    const exists = await prisma.interest_group_items.findFirst({ where: { group_id: groupId, interest_id: interestId } });
    if (!exists) throw new ValidationError('Interest no pertenece al grupo', HTTP.NOT_FOUND);
    await prisma.interest_group_items.delete({ where: { id: exists.id } });
    const payload: GroupItemRemovedResponse = { removed_interest_id: interestId, group_id: groupId };
    buildResponse(res, HTTP.OK, payload, 'Interest removido del grupo');
  } catch (err) {
    next(err as any);
  }
});
