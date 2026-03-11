import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { prisma } from '../../config/db_config';
import { toUserRecord, type UserRecord } from '../auth/common_repository';
import type { UpdateProfileDTO } from '../../schemas/profile/dto/profile_update_dto';
import type { ProfileUserDTO } from '../../schemas/profile/dto/profile_user_dto';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export async function getProfileById(id: number): Promise<ProfileUserDTO | null> {
  const entity: any = await prisma.users.findUnique({ 
    where: { id }, 
    include: { roles: true } as any 
  });
  if (!entity) {
    logger.debug(`profile_repository: getProfileById(${id}) -> not found`);
    return null;
  }
  const user = toUserRecord(entity as any);
  logger.debug(`profile_repository: getProfileById(${id}) -> found`);
  return toProfileUser(user, entity);
}

export async function usernameExistsForOther(id: number, username: string): Promise<boolean> {
  const count = await prisma.users.count({ where: { username, NOT: { id } } });
  if (count > 0) logger.debug(`profile_repository: usernameExistsForOther(${id}, ${username}) -> collision found`);
  return count > 0;
}

export async function phoneExistsForOther(id: number, phone: string): Promise<boolean> {
  const count = await prisma.users.count({ where: { phone, NOT: { id } } as any });
  if (count > 0) logger.debug(`profile_repository: phoneExistsForOther(${id}) -> collision found`);
  return count > 0;
}

export async function updateProfile(
  id: number,
  changes: UpdateProfileDTO
): Promise<ProfileUserDTO | null> {
  const result = await prisma.$transaction(async (tx) => {
    const userData: any = {};
    if (changes.username !== undefined) userData.username = changes.username;
    if (changes.avatar_type !== undefined) userData.avatar_type = changes.avatar_type;
    if (changes.avatar_data !== undefined) userData.avatar_data = changes.avatar_data;
    if (changes.name !== undefined) userData.first_name = changes.name;
    if (changes.lastname !== undefined) userData.last_name_paternal = changes.lastname;
    if (changes.country_code !== undefined) userData.country_code = changes.country_code;
    
    if (Object.keys(userData).length > 0) {
      await tx.users.update({ where: { id }, data: userData });
    }
    
    if (changes.phone !== undefined) {
      const data: any = { phone: changes.phone ?? null };
      if (changes.country_code !== undefined) data.country_code = changes.country_code;
      await tx.users.update({ where: { id }, data });
    }
    
    return await tx.users.findUnique({
      where: { id },
      include: { roles: true } as any
    });
  });

  if (!result) return null;

  const user = toUserRecord(result as any);
  logger.info(`Profile updated for user ${id}`);
  return toProfileUser(user, result);
}

function toProfileUser(user: UserRecord, entity?: any): ProfileUserDTO {
  const country_code = entity?.country_code ?? null;

  return {
    id: user.id,
    name: user.name,
    lastname: user.lastname,
    username: user.username,
    email: user.email,
    phone: user.phone,
    country_code,
    role: {
      id: user.role_id,
      name: user.role_name,
    },
  };
}

export async function updateUserPassword(
  id: number,
  newPasswordHash: string
): Promise<boolean> {
  const entity = await prisma.users.findUnique({ where: { id } });
  if (!entity) return false;
  const currentPassword = entity.password as string | null;

  await prisma.$transaction(async (tx) => {
    if (currentPassword && currentPassword.length > 0) {
      await tx.user_password_history.create({
        data: {
          user_id: id,
          password: currentPassword,
        },
      });
    }

    await tx.users.update({ where: { id }, data: { password: newPasswordHash, change_password: false } });
  });

  logger.info(`Password updated for user ${id}`);
  return true;
}

export async function getPasswordHistoryHashesByUserId(
  id: number
): Promise<string[]> {
  const rows = await prisma.user_password_history.findMany({
    where: { user_id: id },
    orderBy: { created_at: 'desc' },
    select: { password: true },
  });
  return rows.map((r) => r.password);
}
