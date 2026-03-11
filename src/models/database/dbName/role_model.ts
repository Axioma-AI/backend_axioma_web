import { prisma } from '../../../config/db_config';

// Delegate para el modelo 'roles' de Prisma
export const Roles = (prisma as any).roles;
