import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { setupLogger } from '../../../../utils/logger';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { InterestsCreateSchema } from '../../../../schemas/interests/zod/interests_create_schema';
import type { InterestCreatedResponse } from '../../../../schemas/interests/response';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const interestsCreateRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/interests:
 *   post:
 *     tags: [User Interests]
 *     summary: Crear interest (usuario autenticado)
 *     description: |
 *       Crea un interest para el usuario autenticado. El número de interests está limitado por `seats_quota`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Interest creado
 *       400:
 *         description: Datos inválidos o sin seats disponibles
 */
interestsCreateRouter.post('/', requireBearerAuth, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const body = InterestsCreateSchema.parse(req.body);
    const nameRaw = body.name;

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new ValidationError('Usuario no encontrado', HTTP.NOT_FOUND);

    const used = await prisma.interests.count({ where: { user_id: userId } });
    if (used >= Number(user.seats_quota ?? 0)) {
      let isAdmin = false;
      if (user.role_id) {
        const role = await (prisma as any).roles.findUnique({ where: { id: Number(user.role_id) } });
        isAdmin = role?.name === 'admin';
      }
      if (!isAdmin) {
        throw new ValidationError('No hay seats disponibles para crear más interests', HTTP.BAD_REQUEST);
      }
      const sumCreatedUsers = await prisma.users.aggregate({
        _sum: { seats_quota: true },
        where: { created_by_id: userId },
      });
      const assignedToUsers = Number(sumCreatedUsers._sum?.seats_quota ?? 0);
      const adminSeats = Number(user.seats_quota ?? 0);
      const poolTotal = 20;
      const remaining = poolTotal - (assignedToUsers + adminSeats);
      if (remaining <= 0) {
        throw new ValidationError('No hay seats disponibles para crear más interests', HTTP.BAD_REQUEST);
      }
      const newAdminSeats = adminSeats + 1;
      if (assignedToUsers + newAdminSeats > poolTotal) {
        throw new ValidationError('No hay seats disponibles para crear más interests', HTTP.BAD_REQUEST);
      }
      await prisma.users.update({
        where: { id: userId },
        data: { seats_quota: newAdminSeats },
      });
    }

    const interest = await prisma.interests.create({
      data: { user_id: userId, name: nameRaw },
    });

    logger.info(`[Interests] Created interest id=${interest.id} for user=${userId}`);
    const payload: InterestCreatedResponse = { id: interest.id, name: interest.name };
    buildResponse(res, HTTP.OK, payload, 'Interest creado');
  } catch (err) {
    next(err as any);
  }
});
