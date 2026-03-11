import { Router, Request, Response, NextFunction } from 'express';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { InterestsDeleteParamsSchema } from '../../../../schemas/interests/zod/interests_delete_params_schema';
import type { InterestsDeleteParamsDTO } from '../../../../schemas/interests/dto/interests_delete_params_dto';
import type { InterestDeletedResponse } from '../../../../schemas/interests/response';

export const interestsDeleteRouter = Router();

/**
 * @openapi
 * /api/v1/interests/{interestId}:
 *   delete:
 *     tags: [User Interests]
 *     summary: Eliminar interest (usuario)
 *     description: |
 *       Elimina un interest del usuario autenticado.
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
 *       404:
 *         description: Interest/Usuario no encontrado
 */
interestsDeleteRouter.delete('/:interestId', requireBearerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const params: InterestsDeleteParamsDTO = InterestsDeleteParamsSchema.parse(req.params as any);
    const interestId = params.interestId;
    const interest = await prisma.interests.findUnique({ where: { id: interestId } });
    if (!interest || Number(interest.user_id) !== userId) throw new ValidationError('Interest no encontrado', HTTP.NOT_FOUND);
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
    const payload: InterestDeletedResponse = { deleted_interest_id: interestId };
    buildResponse(res, HTTP.OK, payload, 'Interest eliminado');
  } catch (err) {
    next(err as any);
  }
});
