import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { prisma } from '../../config/db_config';
import { toUserRecord, type UserRecord } from '../auth/common_repository';
import { RoleName } from '../../schemas/roles';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export interface ListUsersParams {
  page?: number;
  size?: number;
  q?: string;
  role_name?: RoleName | string | null;
  created_by_id?: number;
}

export interface ListUsersResult {
  items: UserRecord[];
  total: number;
  page: number;
  size: number;
}

export async function listUsersRepo(params: ListUsersParams): Promise<ListUsersResult> {
  const page = Number.isFinite(params.page as number) && (params.page as number) > 0 ? (params.page as number) : 1;
  const sizeRaw = Number.isFinite(params.size as number) && (params.size as number) > 0 ? (params.size as number) : 20;
  const size = Math.min(sizeRaw, 100);
  const skip = (page - 1) * size;

  const where: any = {};
  const orFilters: any[] = [];
  const q = typeof params.q === 'string' ? params.q.trim() : '';
  if (q) {
    orFilters.push(
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { first_name: { contains: q, mode: 'insensitive' } },
      { last_name_paternal: { contains: q, mode: 'insensitive' } },
      { last_name_maternal: { contains: q, mode: 'insensitive' } },
    );
  }
  if (typeof params.role_name === 'string' && params.role_name.trim().length > 0) {
    const roleFilter = params.role_name.toLowerCase();
    orFilters.push(
      { roles: { name: roleFilter as any } },
      { role: roleFilter as any }
    );
  }
  if (orFilters.length > 0) {
    where.OR = orFilters;
  }
  if (typeof params.created_by_id === 'number' && Number.isFinite(params.created_by_id)) {
    where.created_by_id = params.created_by_id;
  }

  const total = await prisma.users.count({ where });
  const entities: any[] = await prisma.users.findMany({
    where,
    include: { roles: true } as any,
    orderBy: { id: 'desc' },
    skip,
    take: size,
  });
  const items = entities.map((e) => toUserRecord(e));
  logger.info(`[Admin] listUsersRepo: fetched ${items.length}/${total} users (page=${page}, size=${size})`);
  return { items, total, page, size };
}
