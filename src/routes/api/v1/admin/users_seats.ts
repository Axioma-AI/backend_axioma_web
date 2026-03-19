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

export const adminUsersSeatsRouter = Router();

/**
 * @openapi
 * /api/v1/admin/users/seats:
 *   post:
 *     tags: [Admin]
 *     summary: Asignar seats a un usuario (solo ADMIN)
 *     description: |
 *       Asigna la cuota de seats (`seats_quota`) a un usuario creado por el admin autenticado.
 *       - El admin tiene un pool total de 20 seats para repartir entre los usuarios que creó.
 *       - La suma de `seats_quota` de sus usuarios no puede exceder 20.
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
 *             required: [seats]
 *             properties:
 *               seats:
 *                 type: integer
 *                 minimum: 0
 *                 description: Nueva cuota de seats para el usuario.
 *     responses:
 *       200:
 *         description: Seats asignados
 *       400:
 *         description: Datos inválidos o suma de seats excede 20
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Usuario no encontrado
 */
adminUsersSeatsRouter.post('/users/seats', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
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

    const seatsInput = (req.body?.seats ?? req.body?.quota);
    const seats = Number(seatsInput);
    if (!Number.isFinite(seats) || seats < 0 || seats > 20) {
      throw new ValidationError('Invalid seats quota. Must be an integer between 0 and 20.', HTTP.BAD_REQUEST);
    }

    let targetUser: any = null;
    if (typeof idParam === 'string' && idParam.trim().length > 0) {
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0) throw new ValidationError('Invalid user id.', HTTP.BAD_REQUEST);
      targetUser = await prisma.users.findUnique({ where: { id } });
    } else if (typeof emailParam === 'string' && emailParam.trim().length > 0) {
      const email = emailParam.trim().toLowerCase();
      targetUser = await prisma.users.findUnique({ where: { email } });
    } else if (typeof usernameParam === 'string' && usernameParam.trim().length > 0) {
      const username = usernameParam.trim();
      targetUser = await prisma.users.findUnique({ where: { username } });
    }
    if (!targetUser) throw new ValidationError('User not found.', HTTP.NOT_FOUND);

    if (targetUser.id !== adminId) {
      if (!targetUser.created_by_id || Number(targetUser.created_by_id) !== adminId) {
        throw new ValidationError('No puedes asignar seats a usuarios que no has creado.', 403);
      }
    }

    const sumCreatedUsers = await prisma.users.aggregate({
      _sum: { seats_quota: true },
      where: { created_by_id: adminId, id: { not: targetUser.id } },
    });
    const createdUsersSum = Number(sumCreatedUsers._sum?.seats_quota ?? 0);
    const adminUser = await prisma.users.findUnique({ where: { id: adminId } });
    const adminUsedCount = await prisma.interests.count({ where: { user_id: adminId } });
    const currentTargetSeats = Number(targetUser.seats_quota ?? 0);
    const adminSeats = targetUser.id === adminId ? 0 : Number(adminUser?.seats_quota ?? 0);
    const tentativeTotal = createdUsersSum + adminSeats + seats;
    let newAdminSeats = adminSeats;
    if (tentativeTotal > 20 && targetUser.id !== adminId) {
      const delta = tentativeTotal - 20;
      const candidateAdminSeats = Math.max(adminSeats - delta, adminUsedCount);
      const minimalTotal = createdUsersSum + candidateAdminSeats + seats;
      if (minimalTotal > 20) {
        throw new ValidationError(`La suma de seats asignados (${tentativeTotal}) excede el límite de 20.`, HTTP.BAD_REQUEST);
      }
      newAdminSeats = candidateAdminSeats;
    }

    const freedSeats = targetUser.id !== adminId ? Math.max(currentTargetSeats - seats, 0) : 0;

    const result = await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id: targetUser.id },
        data: { seats_quota: seats },
      });
      let finalAdminSeats = newAdminSeats;
      const hasFreedSeats = freedSeats > 0;
      if (hasFreedSeats) {
        finalAdminSeats = newAdminSeats + freedSeats;
      }
      if (targetUser.id !== adminId) {
        await tx.users.update({
          where: { id: adminId },
          data: { seats_quota: finalAdminSeats },
        });
      }
      const finalTotal = createdUsersSum + finalAdminSeats + seats;
      return { finalTotal, finalAdminSeats };
    });

    logger.info(`[Admin] Seats updated for user id=${targetUser.id}: seats_quota=${seats}${freedSeats > 0 ? `; admin auto-recargado +${freedSeats}` : ''}${newAdminSeats !== adminSeats ? `; admin ajustado -${adminSeats - newAdminSeats}` : ''}`);
    buildResponse(res, HTTP.OK, { user_id: targetUser.id, seats_quota: seats, admin_pool_used: result.finalTotal, admin_pool_remaining: 20 - result.finalTotal }, 'Seats asignados');
  } catch (err: any) {
    next(err);
  }
});

export default adminUsersSeatsRouter;
