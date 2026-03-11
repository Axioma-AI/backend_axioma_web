import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { ValidationError } from '../../utils/errors';
import type { GetProfileResponse, UpdateProfileResponse } from '../../schemas/profile/response';
import { getProfileById, updateProfile, usernameExistsForOther, phoneExistsForOther } from '../../repositories/profile/profile_repository';
import { updateUserPassword } from '../../repositories/profile/profile_repository';
import { validateProfilePhoto } from '../../utils/image_validation';
import { ImageType } from '../../schemas/media/image_types';
import { verifyPassword, hashPassword } from '../../utils/password_utils';
import { getUserById } from '../../repositories/auth/common_repository';
import { zodValidation } from '../../utils/zod_validation';
import { UpdateProfileSchema, type UpdateProfileInput } from '../../schemas/profile/zod/profile_update_schema';
import { PasswordUpdateSchema, type PasswordUpdateInput } from '../../schemas/profile/zod/password_update_schema';
import type { UpdateProfileDTO } from '../../schemas/profile/dto/profile_update_dto';
import { prisma } from '../../config/db_config';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export async function getProfileService(id: number): Promise<GetProfileResponse> {
  const user = await getProfileById(id);
  if (!user) {
    throw new ValidationError('User not found.', 404);
  }
  logger.info('[ProfileService] Get profile', { userId: id });
  // Exponer URL local para descargar avatar desde la BD
  user.avatar_url = '/api/v1/profile/avatar';
  return { user };
}

export async function updateProfileService(
  id: number,
  rawBody: any,
  avatarFile?: { originalname: string; mimetype: string; buffer: Buffer; size?: number }
): Promise<UpdateProfileResponse> {
  const input: UpdateProfileInput = zodValidation(UpdateProfileSchema, rawBody);
  const changes: UpdateProfileDTO = { ...input };
  logger.info('[ProfileService] Update profile', { userId: id, hasAvatar: !!avatarFile });

  if (changes.username) {
    const exists = await usernameExistsForOther(id, changes.username);
    if (exists) throw new ValidationError('Username already in use.');
  }
  if (changes.phone) {
    const exists = await phoneExistsForOther(id, changes.phone);
    if (exists) throw new ValidationError('Phone already in use.');
  }

  // Si no viene archivo y no hay cambios de texto, rechazar la actualización
  if (!avatarFile &&
      changes.name === undefined &&
      changes.lastname === undefined &&
      changes.username === undefined &&
      changes.phone === undefined &&
      changes.country_code === undefined &&
      changes.avatar_type === undefined &&
      changes.avatar_data === undefined) {
    throw new ValidationError('Provide at least one field or the avatar.');
  }

  if (avatarFile) {
    const content = validateProfilePhoto({
      originalname: avatarFile.originalname,
      mimetype: avatarFile.mimetype,
      buffer: avatarFile.buffer,
      size: avatarFile.size,
    });
    let avatarType: ImageType | undefined = undefined;
    const mime = (avatarFile.mimetype || '').toLowerCase();
    if (mime === 'image/jpeg') {
      avatarType = ImageType.JPEG;
    } else if (mime === 'image/png') {
      avatarType = ImageType.PNG;
    } else if (mime === 'image/heic') {
      avatarType = ImageType.HEIC;
    } else if (mime === 'image/heif') {
      avatarType = ImageType.HEIF;
    }

    if (!avatarType) {
      throw new ValidationError('Unable to determine avatar type.');
    }

    changes.avatar_type = avatarType;

    changes.avatar_data = Buffer.from(content);
  }

  const user = await updateProfile(id, changes);
  if (!user) {
    throw new ValidationError('User not found.', 404);
  }
  logger.info('[ProfileService] Update profile success', { userId: id });
  user.avatar_url = '/api/v1/profile/avatar';
  return { user };
}

export async function updatePasswordService(
  id: number,
  rawBody: any
): Promise<{ success: boolean }>{
  logger.info('[ProfileService] Change password', { userId: id });
  const user = await getProfileById(id);
  if (!user) {
    throw new ValidationError('User not found.', 404);
  }
  const { current_password, new_password }: PasswordUpdateInput = zodValidation(PasswordUpdateSchema, rawBody);
  // necesitamos el hash actual; recuperar entidad completa
  // Usamos common_repository.getUserById para obtener el password_hash
  // pero aquí tenemos sólo ProfileUser; volvemos a consultar con repositorio común
  const full = await getUserById(id);
  if (!full) {
    throw new ValidationError('User not found.', 404);
  }
  const ok = await verifyPassword(current_password, full.password_hash);
  if (!ok) {
    throw new ValidationError('Incorrect current password.', 401);
  }
  const newHash = await hashPassword(new_password);
  const updated = await updateUserPassword(id, newHash);
  if (!updated) {
    throw new ValidationError('Unable to update password.', 500);
  }
  logger.info('[ProfileService] Change password success', { userId: id });
  return { success: true };
}
