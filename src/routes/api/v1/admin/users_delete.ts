import { Router, Request, Response } from 'express';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireAdmin } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const adminUsersDeleteRouter = Router();

/**
 * @openapi
 * /api/v1/admin/users:
 *   delete:
 *     tags: [Admin]
 *     summary: Eliminar usuario (solo ADMIN)
 *     description: |
 *       Elimina un usuario por identificador único: `id`, `email` o `username`.
 *       Requiere confirmación por query `?confirm=true`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: false
 *         schema:
 *           type: integer
 *       - in: query
 *         name: email
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: username
 *         required: false
 *         schema:
 *           type: string
 *       - in: query
 *         name: confirm
 *         required: true
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BaseResponseDeleteUser'
 *       400:
 *         description: Falta confirmación o datos inválidos
 *       403:
 *         description: Acceso restringido
 *       404:
 *         description: Usuario no encontrado
 */
adminUsersDeleteRouter.delete('/users', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const confirmRaw = req.query.confirm;
    const confirmed = typeof confirmRaw === 'string'
      ? ['true', '1', 'yes', 'on'].includes(confirmRaw.trim().toLowerCase())
      : false;
    if (!confirmed) {
      throw new ValidationError('Confirmation required: add ?confirm=true to the request.', HTTP.BAD_REQUEST);
    }

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

    let toDelete: any = null;

    if (typeof idParam === 'string' && idParam.trim().length > 0) {
      const id = Number(idParam);
      if (!Number.isFinite(id) || id <= 0) {
        throw new ValidationError('Invalid user id.', HTTP.BAD_REQUEST);
      }
      const byId = await prisma.users.findUnique({ where: { id } });
      if (!byId) {
        throw new ValidationError('User not found.', HTTP.NOT_FOUND);
      }
      toDelete = byId;
    } else if (typeof emailParam === 'string' && emailParam.trim().length > 0) {
      const email = emailParam.trim().toLowerCase();
      const byEmail = await prisma.users.findUnique({ where: { email } });
      if (!byEmail) {
        throw new ValidationError('User not found.', HTTP.NOT_FOUND);
      }
      toDelete = byEmail;
    } else if (typeof usernameParam === 'string' && usernameParam.trim().length > 0) {
      const username = usernameParam.trim();
      const byUsername = await prisma.users.findUnique({ where: { username } });
      if (!byUsername) {
        throw new ValidationError('User not found.', HTTP.NOT_FOUND);
      }
      toDelete = byUsername;
    }

    if (!toDelete) {
      throw new ValidationError('User not found.', HTTP.NOT_FOUND);
    }

    const requesterId = Number((req as any).userId);
    if (Number.isFinite(requesterId) && requesterId === toDelete.id) {
      throw new ValidationError('No puedes eliminar tu propia cuenta.', 403);
    }

    const childCount = await prisma.users.count({ where: { created_by_id: toDelete.id } });
    if (childCount > 0) {
      throw new ValidationError('No se puede eliminar: el usuario tiene usuarios creados asociados.', 409);
    }

    const reclaimToAdmin = Number(toDelete.created_by_id) === requesterId;
    const freedSeats = Number(toDelete.seats_quota ?? 0);
    const adminUser = reclaimToAdmin ? await prisma.users.findUnique({ where: { id: requesterId } }) : null;
    const adminUsedCount = reclaimToAdmin ? await prisma.interests.count({ where: { user_id: requesterId } }) : 0;
    const sumOthers = reclaimToAdmin
      ? await prisma.users.aggregate({ _sum: { seats_quota: true }, where: { created_by_id: requesterId, id: { not: toDelete.id } } })
      : { _sum: { seats_quota: 0 } } as any;
    const othersSum = Number(sumOthers._sum?.seats_quota ?? 0);
    const adminSeats = Number(adminUser?.seats_quota ?? 0);
    const targetAdminSeats = Math.min(adminSeats + freedSeats, Math.max(20 - othersSum, adminSeats));
    const finalAdminSeats = Math.max(targetAdminSeats, adminUsedCount);

    await prisma.$transaction(async (tx) => {
      await tx.user_sessions.deleteMany({ where: { user_id: toDelete.id } });
      await tx.user_recovery_codes.deleteMany({ where: { user_id: toDelete.id } });
      await tx.userTwoFactor.deleteMany({ where: { user_id: toDelete.id } });
      await tx.users.delete({ where: { id: toDelete.id } });
      if (reclaimToAdmin && freedSeats > 0) {
        await tx.users.update({
          where: { id: requesterId },
          data: { seats_quota: finalAdminSeats },
        });
      }
    });

    logger.info(`[Admin] Deleted user id=${toDelete.id}${reclaimToAdmin && freedSeats > 0 ? `; admin reclamo +${finalAdminSeats - adminSeats}` : ''}`);
    buildResponse(res, HTTP.OK, { deleted_id: toDelete.id, reclaimed_to_admin: reclaimToAdmin ? (finalAdminSeats - adminSeats) : 0 }, 'User deleted');
  } catch (err: any) {
    const message = err?.message ?? 'Error deleting user';
    if (err instanceof ValidationError) {
      logger.warn(`[Admin] Delete user validation error: ${message}`);
    } else {
      logger.error(`[Admin] Delete user failed: ${message}`);
    }
    next(err);
  }
});
