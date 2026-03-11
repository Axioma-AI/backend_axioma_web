import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { ValidationError } from '../../utils/errors';
import type { RegisterResponse } from '../../schemas/auth/register/response';
import { hashPassword } from '../../utils/password_utils';
import { RoleName } from '../../schemas/roles';
import {
  emailExists,
  usernameExists,
  getRoleIdByName,
  createUser,
  type UserRecord,
  countUsersCreatedBy,
} from '../../repositories/auth/register_repository';
import type { PublicUser } from '../../schemas/auth/common/user';
import { zodValidation } from '../../utils/zod_validation';
import { RegisterRequestSchema, type RegisterRequestInput } from '../../schemas/auth/register/zod/register_schema';
import { RegisterRootRequestSchema, type RegisterRootRequestInput } from '../../schemas/auth/register/zod/register_root_schema';
import { prisma } from '../../config/db_config';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

function toPublicUser(u: UserRecord): PublicUser {
  return {
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
  };
}

async function baseRegisterService(input: any, defaultRoleName: RoleName, creatorId?: number, opts?: { seats_quota?: number }): Promise<RegisterResponse> {

  if (await emailExists(input.email)) {
    throw new ValidationError('El email ya está registrado.');
  }
  if (await usernameExists(input.username)) {
    throw new ValidationError('El username ya está registrado.');
  }

  if (typeof creatorId === 'number' && Number.isFinite(creatorId)) {
    const createdCount = await countUsersCreatedBy(creatorId);
    if (createdCount >= 4) {
      throw new ValidationError('Este admin ya creó el máximo de 4 usuarios.', 403);
    }
  }

  let roleId: number | null = null;
  if (typeof input.role_name === 'string' && input.role_name.trim().length > 0) {
    roleId = await getRoleIdByName(input.role_name as any);
    if (!roleId) throw new ValidationError('role_name inválido: no existe.');
  } else {
    roleId = await getRoleIdByName(defaultRoleName);
    if (!roleId) {
      logger.warn(`Role ${defaultRoleName} not found; creating user without role_id`);
    }
  }

  const password_hash = await hashPassword(input.password);
  
  // Campos relacionados a compañías/organizaciones eliminados del modelo

  const user = await createUser({
    first_name: input.first_name,
    last_name_paternal: input.last_name_paternal,
    last_name_maternal: input.last_name_maternal,
    username: input.username,
    email: input.email,
    phone: input.phone,
    country_code: input.country_code,
    password_hash,
    role_id: roleId ?? null,
    change_password: typeof input.force_change_password === 'boolean' ? input.force_change_password : undefined,
    created_by_id: typeof creatorId === 'number' && Number.isFinite(creatorId) ? creatorId : undefined,
    seats_quota: typeof opts?.seats_quota === 'number' ? opts?.seats_quota : undefined,
  });

  logger.info(`User registered: ${user.email} (id=${user.id})`);
  return { user: toPublicUser(user) };
}

export async function registerService(rawBody: any, creatorId: number): Promise<RegisterResponse> {
  const input: RegisterRequestInput = zodValidation(RegisterRequestSchema, rawBody);
  return baseRegisterService(input, RoleName.MEMBER, creatorId);
}

export async function registerRootService(rawBody: any): Promise<RegisterResponse> {
  const input: RegisterRootRequestInput = zodValidation(RegisterRootRequestSchema, rawBody);
  return baseRegisterService(input, RoleName.ADMIN, undefined, { seats_quota: 20 });
}
