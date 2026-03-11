import { Router, Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../../../../middlewares/auth';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { ValidationError } from '../../../../utils/errors';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';

export const adminUsersSeatsSummaryRouter = Router();
const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

/**
 * @openapi
 * /api/v1/admin/users/seats:
 *   get:
 *     tags: [Admin]
 *     summary: Resumen de seats del admin (pool 20)
 *     description: |
 *       Devuelve el estado del pool de 20 seats del admin:
 *       - Suma de seats asignados a usuarios creados por el admin
 *       - Seats del propio usuario admin y los usados en interests
 *       - Restante del pool considerando ambos (usuarios y admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resumen de seats
 */
adminUsersSeatsSummaryRouter.get('/users/seats', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminId = Number((req as any).userId);
    const adminUser = await prisma.users.findUnique({ where: { id: adminId } });
    if (!adminUser) {
      throw new ValidationError('Admin no encontrado', HTTP.NOT_FOUND);
    }

    const [{ _sum }, usedCount] = await Promise.all([
      prisma.users.aggregate({ _sum: { seats_quota: true }, where: { created_by_id: adminId } }),
      prisma.interests.count({ where: { user_id: adminId } }),
    ]);

    const poolTotal = 20;
    const assignedToUsers = Number(_sum?.seats_quota ?? 0);
    const adminSeats = Number(adminUser.seats_quota ?? 0);
    const overallUsed = assignedToUsers + adminSeats;
    const overallRemaining = Math.max(poolTotal - overallUsed, 0);
    const adminSeatsRemaining = Math.max(adminSeats - usedCount, 0);

    const payload = {
      admin_pool_total: poolTotal,
      admin_pool_assigned_to_users: assignedToUsers,
      admin_user_seats_quota: adminSeats,
      admin_user_seats_used: usedCount,
      admin_overall_remaining: overallRemaining,
      admin_user_seats_remaining: adminSeatsRemaining,
    };
    logger.info('[Admin Seats] Summary', payload as any);
    buildResponse(res, HTTP.OK, payload, 'Resumen de seats del admin');
  } catch (err) {
    next(err as any);
  }
});
