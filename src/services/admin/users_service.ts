import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { listUsersRepo, type ListUsersParams } from '../../repositories/admin/users_repository';
import type { AdminUsersListItem, AdminUsersListResponse } from '../../schemas/admin/users_list/response';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export async function listUsersService(params: ListUsersParams): Promise<AdminUsersListResponse> {
  const { items, total, page, size } = await listUsersRepo(params);
  const users: AdminUsersListItem[] = items.map((u) => ({
    id: u.id,
    name: u.name,
    paternal_lastname: u.paternal_lastname ?? null,
    maternal_lastname: u.maternal_lastname ?? null,
    username: u.username,
    email: u.email,
    phone: u.phone,
    country_code: u.country_code,
    role: {
      name: (u.role_name as 'admin' | 'member' | null),
    },
    seats_quota: Number(u.seats_quota ?? 0),
  }));
  logger.info(`[Admin] listUsersService: returning ${users.length}/${total} users`);
  return { users, page, size, total };
}
