import { Router, Request, Response, NextFunction } from 'express';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { InterestsGroupDeleteParamsSchema } from '../../../../schemas/interests/zod/groups_delete_params_schema';
import type { InterestsGroupDeleteParamsDTO } from '../../../../schemas/interests/dto/groups_delete_params_dto';
import type { GroupDeletedResponse } from '../../../../schemas/interests/response';

export const interestsGroupsDeleteRouter = Router();

/**
 * @openapi
 * /api/v1/interests/groups/{groupId}:
 *   delete:
 *     tags: [Profile]
 *     summary: Eliminar grupo de interests
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
 *       404:
 *         description: Grupo no encontrado
 */
interestsGroupsDeleteRouter.delete('/groups/:groupId', requireBearerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const params: InterestsGroupDeleteParamsDTO = InterestsGroupDeleteParamsSchema.parse(req.params as any);
    const groupId = params.groupId;
    const group = await prisma.interest_groups.findUnique({ where: { id: groupId } });
    if (!group || Number(group.user_id) !== userId) throw new ValidationError('Grupo no encontrado', HTTP.NOT_FOUND);
    await prisma.interest_groups.delete({ where: { id: groupId } });
    const payload: GroupDeletedResponse = { deleted_group_id: groupId };
    buildResponse(res, HTTP.OK, payload, 'Grupo eliminado');
  } catch (err) {
    next(err as any);
  }
});
