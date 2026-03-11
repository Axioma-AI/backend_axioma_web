import { Router, Request, Response, NextFunction } from 'express';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

export const interestsSummaryRouter = Router();

/**
 * @openapi
 * /api/v1/interests/summary:
 *   get:
 *     tags: [User Interests]
 *     summary: Resumen de seats, interests y grupos (usuario)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen obtenido
 */
interestsSummaryRouter.get('/summary', requireBearerAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new ValidationError('Usuario no encontrado', HTTP.NOT_FOUND);
    const [used, interestsRaw, groups] = await Promise.all([
      prisma.interests.count({ where: { user_id: userId } }),
      prisma.interests.findMany({ where: { user_id: userId }, orderBy: { name: 'asc' } }),
      prisma.interest_groups.findMany({ where: { user_id: userId }, orderBy: { name: 'asc' }, include: { items: { include: { interest: true } } } as any }),
    ]);
    const interests = interestsRaw.map(i => ({ id: i.id, name: i.name }));
    const mappedGroups = groups.map(g => ({ id: g.id, name: g.name, interests: (g.items as any[]).map(it => ({ id: it.interest.id, name: it.interest.name })) }));
    buildResponse(res, HTTP.OK, { seats_quota: Number(user.seats_quota ?? 0), seats_used: used, seats_remaining: Number(user.seats_quota ?? 0) - used, interests, groups: mappedGroups }, 'Resumen obtenido');
  } catch (err) {
    next(err as any);
  }
});
