import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getAppSettings, type AppSettings } from '../../../../config/settings';
import { setupLogger } from '../../../../utils/logger';
import { requireBearerAuth } from '../../../../middlewares/auth';
import { ValidationError } from '../../../../utils/errors';
import { prisma } from '../../../../config/db_config';
import { HTTP } from '../../../../schemas/common/baseResponse';
import { buildResponse } from '../../../../utils/response_builder';
import { InterestsGroupCreateSchema } from '../../../../schemas/interests/zod/groups_create_schema';
import type { GroupCreatedResponse } from '../../../../schemas/interests/response';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export const interestsGroupsCreateRouter = Router();
const upload = multer();

/**
 * @openapi
 * /api/v1/interests/groups:
 *   post:
 *     tags: [User Interests]
 *     summary: Crear grupo de interests (usuario)
 *     description: |
 *       Crea un grupo para el usuario autenticado con al menos 2 interests.
 *       Si se proveen `interest_names`, se crean los que faltan respetando `seats_quota`.
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
 *               name: { type: string }
 *               interest_names:
 *                 type: array
 *                 items: { type: string }
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               interest_names:
 *                 type: array
 *                 items: { type: string }
 *     responses:
 *       200:
 *         description: Grupo creado
 *       400:
 *         description: Datos inválidos o límite de seats excedido
 */
interestsGroupsCreateRouter.post('/groups', requireBearerAuth, upload.none(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number((req as any).userId);
    const body = InterestsGroupCreateSchema.parse(req.body);
    const name = body.name;
    const interestNames: string[] = body.interest_names;

    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new ValidationError('Usuario no encontrado', HTTP.NOT_FOUND);

    const existingInterests = await prisma.interests.findMany({ where: { user_id: userId, name: { in: interestNames } } });
    const existingNames = new Set(existingInterests.map(i => i.name));
    const missingNames = interestNames.filter(n => !existingNames.has(n));
    const used = await prisma.interests.count({ where: { user_id: userId } });
    const remainingSeats = Number(user.seats_quota ?? 0) - used;
    if (missingNames.length > remainingSeats) {
      throw new ValidationError('No hay seats suficientes para crear todos los interests solicitados', HTTP.BAD_REQUEST);
    }

    const created = await prisma.$transaction(async (tx) => {
      const newInterests = await Promise.all(missingNames.map(n => tx.interests.create({ data: { user_id: userId, name: n } })));
      const group = await tx.interest_groups.create({ data: { user_id: userId, name } });
      const allInterests = [...existingInterests, ...newInterests];
      if (allInterests.length < 2) {
        throw new ValidationError('Un grupo debe contener al menos 2 interests', HTTP.BAD_REQUEST);
      }
      for (const i of allInterests) {
        await tx.interest_group_items.create({ data: { group_id: group.id, interest_id: i.id } });
      }
      return { group, interests: allInterests };
    });

    logger.info(`[Interests] Created group id=${created.group.id} for user=${userId}`);
    const payload: GroupCreatedResponse = { group_id: created.group.id, name: created.group.name, interests: created.interests.map(i => ({ id: i.id, name: i.name })) };
    buildResponse(res, HTTP.OK, payload, 'Grupo creado');
  } catch (err) {
    next(err as any);
  }
});
