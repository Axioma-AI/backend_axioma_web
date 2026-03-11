import { Router, Request, Response, NextFunction } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminUsersSummaryRouter = Router();

adminUsersSummaryRouter.get('/users/summary', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const idParam = req.query.id;
    const emailParam = req.query.email;
    const usernameParam = req.query.username;
    const provided = [
      typeof idParam === 'string' && idParam.trim().length > 0,
      typeof emailParam === 'string' && emailParam.trim().length > 0,
      typeof usernameParam === 'string' && usernameParam.trim().length > 0,
    ].filter(Boolean).length;
    if (provided !== 1) {
      throw new ValidationError('Provide exactly one identifier: id OR email OR username.', HTTP.BAD_REQUEST);
    }

    let user: any = null;
    if (typeof idParam === 'string' && idParam.trim().length > 0) {
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0) throw new ValidationError('Invalid user id.', HTTP.BAD_REQUEST);
      user = await prisma.users.findUnique({ where: { id } });
    } else if (typeof emailParam === 'string' && emailParam.trim().length > 0) {
      const email = emailParam.trim().toLowerCase();
      user = await prisma.users.findUnique({ where: { email } });
    } else if (typeof usernameParam === 'string' && usernameParam.trim().length > 0) {
      const username = usernameParam.trim();
      user = await prisma.users.findUnique({ where: { username } });
    }
    if (!user) throw new ValidationError('User not found.', HTTP.NOT_FOUND);
    if (!user.created_by_id || Number(user.created_by_id) !== adminId) {
      throw new ValidationError('No puedes ver recursos de usuarios que no has creado.', 403);
    }

    const [used, allInterests, groups] = await Promise.all([
      prisma.interests.count({ where: { user_id: user.id } }),
      prisma.interests.findMany({ where: { user_id: user.id }, orderBy: { name: 'asc' } }),
      prisma.interest_groups.findMany({ where: { user_id: user.id }, orderBy: { name: 'asc' }, include: { items: { include: { interest: true } } } as any }),
    ]);

    const mappedGroups = groups.map(g => ({ id: g.id, name: g.name, interests: (g.items as any[]).map(it => ({ id: it.interest.id, name: it.interest.name })) }));
    const assignedIds = new Set<number>();
    for (const g of mappedGroups) for (const it of g.interests) assignedIds.add(it.id);
    const unassignedInterests = allInterests.filter(i => !assignedIds.has(i.id));

    buildResponse(
      res,
      HTTP.OK,
      {
        user: { id: user.id, email: user.email, username: user.username },
        seats_quota: Number(user.seats_quota ?? 0),
        seats_used: used,
        seats_remaining: Number(user.seats_quota ?? 0) - used,
        interests: unassignedInterests,
        groups: mappedGroups
      },
      'Resumen de usuario'
    );
  } catch (err) {
    next(err as any);
  }
});

export default adminUsersSummaryRouter;
