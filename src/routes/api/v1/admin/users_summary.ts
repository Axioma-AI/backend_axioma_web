import { Router, Request, Response, NextFunction } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { AdminUserIdentifierQuerySchema } from '../../../../schemas/admin/interests/zod/user_identifier_query_schema';
import type { AdminUserIdentifierQueryDTO } from '../../../../schemas/admin/interests/dto/user_identifier_query_dto';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminUsersSummaryRouter = Router();

adminUsersSummaryRouter.get('/users/summary', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

    const firstName = user.first_name ?? '';
    const lastName = user.last_name_paternal
      ? user.last_name_paternal + (user.last_name_maternal ? ' ' + user.last_name_maternal : '')
      : '';

    buildResponse(
      res,
      HTTP.OK,
      {
        user: { 
          id: user.id, 
          email: user.email, 
          username: user.username,
          name: firstName || null,
          lastname: lastName || null,
          phone: user.phone ?? null,
          country_code: user.country_code ?? null,
        },
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
