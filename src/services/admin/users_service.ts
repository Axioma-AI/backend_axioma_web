import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { listUsersRepo, type ListUsersParams } from '../../repositories/admin/users_repository';
import type { PublicUser } from '../../schemas/auth/common/user';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export interface AdminUserListItem extends PublicUser {
  seats_quota: number;
}

export interface AdminUsersListResult {
  users: AdminUserListItem[];
  page: number;
  size: number;
  total: number;
}

export async function listUsersService(params: ListUsersParams): Promise<AdminUsersListResult> {
  const { items, total, page, size } = await listUsersRepo(params);
  const users: AdminUserListItem[] = items.map((u) => ({
    id: u.id,
    name: u.name,
    lastname: u.lastname,
    username: u.username,
    email: u.email,
    phone: u.phone,
    role: {
      id: u.role_id,
      name: u.role_name,
    },
    seats_quota: Number(u.seats_quota ?? 0),
  }));
  logger.info(`[Admin] listUsersService: returning ${users.length}/${total} users`);
  return { users, page, size, total };
}
