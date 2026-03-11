import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { RoleName } from '../../schemas/roles';
import { prisma } from '../../config/db_config';
import { toUserRecord, type UserRecord } from './common_repository';
import type { RegisterCreateDTO } from '../../schemas/auth/register/dto/register_dto';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export type { UserRecord };

export async function emailExists(email: string): Promise<boolean> {
  const count = await prisma.users.count({ where: { email } });
  logger.debug(`register_repository: emailExists(${email}) -> ${count > 0}`);
  return count > 0;
}

export async function usernameExists(username: string): Promise<boolean> {
  const count = await prisma.users.count({ where: { username } });
  logger.debug(`register_repository: usernameExists(${username}) -> ${count > 0}`);
  return count > 0;
}

export async function getRoleIdByName(name: RoleName): Promise<number | null> {
  // Cast name to string if needed because Prisma might expect exact enum or string depending on schema
  const role = await (prisma as any).roles.findUnique({ where: { name: name } });
  return role ? role.id : null;
}

export type CreateUserParams = RegisterCreateDTO;

export async function countUsersCreatedBy(creatorId: number): Promise<number> {
  const count = await prisma.users.count({ where: { created_by_id: creatorId } });
  logger.debug(`register_repository: countUsersCreatedBy(${creatorId}) -> ${count}`);
  return count;
}

export async function createUser(params: CreateUserParams): Promise<UserRecord> {
  const result = await prisma.$transaction(async (tx) => {
    const userData: any = {
      username: params.username,
      email: params.email,
      password: params.password_hash,
      first_name: params.first_name,
      last_name_paternal: params.last_name_paternal,
      last_name_maternal: params.last_name_maternal,
      phone: params.phone ?? null,
      country_code: params.country_code ?? null,
    };
    
    if (params.role_id) {
       userData.role_id = params.role_id;
    }
    if (typeof params.change_password === 'boolean') {
       userData.change_password = params.change_password;
    }
    if (typeof params.created_by_id === 'number' && Number.isFinite(params.created_by_id)) {
       userData.created_by_id = params.created_by_id;
    }
    if (typeof params.seats_quota === 'number' && Number.isFinite(params.seats_quota)) {
       userData.seats_quota = params.seats_quota;
    }

    const user = await tx.users.create({
      data: userData,
    });

    await tx.user_password_history.create({
      data: {
        user_id: user.id,
        password: params.password_hash,
      },
    });

    return await tx.users.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: true } as any
    });
  });

  logger.info(`User created with id=${result.id}`);
  logger.debug(`register_repository: user created id=${result.id}`);
  return toUserRecord(result);
}
