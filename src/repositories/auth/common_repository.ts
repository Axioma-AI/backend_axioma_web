import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { prisma } from '../../config/db_config';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export interface UserRecord {
  id: number;
  name: string;
  lastname: string;
  username: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role_id: number | null;
  role_name: string | null;
  seats_quota?: number;
  change_password?: boolean;
  avatar_type: string | null;
  avatar_path?: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function getUserById(id: number): Promise<UserRecord | null> {
  const entity: any = await prisma.users.findUnique({ 
    where: { id }, 
    include: { roles: true } as any 
  });
  const user = entity ? toUserRecord(entity as any) : null;
  logger.debug(`common_repository: getUserById(${id}) -> ${user ? 'found' : 'null'}`);
  return user;
}

export function toUserRecord(entity: any): UserRecord {
  const firstName = entity.first_name ?? entity.name ?? '';
  const lastName = entity.last_name_paternal 
    ? (entity.last_name_paternal + (entity.last_name_maternal ? ' ' + entity.last_name_maternal : ''))
    : entity.lastname ?? '';
  const phone = entity.phone ?? null;

  return {
    id: entity.id,
    name: firstName,
    lastname: lastName,
    username: entity.username,
    email: entity.email,
    phone: phone,
    password_hash: entity.password ?? entity.password_hash ?? entity.passwordHash,
    role_id: entity.roles ? entity.roles.id : (entity.role_id ?? null),
    role_name: entity.roles ? entity.roles.name ?? null : (entity.role ?? null),
    seats_quota: Number(entity.seats_quota ?? 0),
    change_password: entity.change_password ?? entity.changePassword ?? false,
    avatar_type: entity.avatar_type ?? entity.avatarType ?? null,
    avatar_path: entity.avatar_path ?? entity.avatarPath ?? null,
    created_at: entity.created_at ?? entity.createdAt,
    updated_at: entity.updated_at ?? entity.updatedAt,
  };
}

logger.debug('common_repository (Prisma) initialized: shared user mapping and access.');
