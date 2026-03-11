import { prisma } from '../../../config/db_config';

// Delegate para el modelo 'personal_access_tokens' de Prisma
export const PersonalTokens = (prisma as any).personal_access_tokens;
