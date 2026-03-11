import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { AuthError, ValidationError } from '../../utils/errors';
import { getUserByEmail, getUserByUsername } from '../../repositories/auth/login_repository';
import { getUserById } from '../../repositories/auth/common_repository';
import { getProfileById, getPasswordHistoryHashesByUserId, updateUserPassword } from '../../repositories/profile/profile_repository';
import { verifyPassword, hashPassword } from '../../utils/password_utils';
import { zodValidation } from '../../utils/zod_validation';
import { ForgotPasswordSchema } from '../../schemas/auth/forgot_password/zod/forgot_password_schema';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export async function forgotPasswordService(rawBody: any): Promise<{ success: boolean }> {
  const input = zodValidation(ForgotPasswordSchema, rawBody);
  logger.info('[ForgotPasswordService] Request received', { hasEmail: !!input.email, hasUsername: !!input.username });

  let user = null;
  if (input.email) {
    user = await getUserByEmail(input.email);
  } else if (input.username) {
    user = await getUserByUsername(input.username);
  }

  if (!user) {
    throw new AuthError('Datos de recuperación inválidos.', 400);
  }

  const full = await getUserById(user.id);
  if (!full) {
    throw new AuthError('Datos de recuperación inválidos.', 400);
  }

  const currentHash = full.password_hash;
  const historyHashes = await getPasswordHistoryHashesByUserId(user.id);
  const allHashes = [currentHash, ...historyHashes];

  let lastMatches = false;
  for (const h of allHashes) {
    if (!h) {
      continue;
    }
    const ok = await verifyPassword(input.last_password, h);
    if (ok) {
      lastMatches = true;
      break;
    }
  }

  if (!lastMatches) {
    throw new AuthError('Datos de recuperación inválidos.', 400);
  }

  const profile = await getProfileById(user.id);
  if (!profile) {
    throw new AuthError('Datos de recuperación inválidos.', 400);
  }

  const normalizeString = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  let matches = 0;

  if (input.first_name && profile.name) {
    if (normalizeString(input.first_name) === normalizeString(profile.name)) {
      matches++;
    }
  }

  if (input.last_name_paternal && profile.lastname) {
    const profileLast = normalizeString(profile.lastname.split(' ')[0] ?? profile.lastname);
    if (normalizeString(input.last_name_paternal) === profileLast) {
      matches++;
    }
  }

  if (input.last_name_maternal && profile.lastname) {
    const parts = profile.lastname.split(' ');
    const maternal = parts.length > 1 ? parts.slice(1).join(' ') : '';
    if (normalizeString(input.last_name_maternal) === normalizeString(maternal)) {
      matches++;
    }
  }

  if (input.phone && profile.phone) {
    const cleanProfilePhone = String(profile.phone).replace(/\D/g, '');
    const cleanInputPhone = input.phone.replace(/\D/g, '');
    if (cleanProfilePhone === cleanInputPhone && cleanProfilePhone.length > 0) {
      matches++;
    }
  }

  if (input.country_code && profile.country_code) {
    if (normalizeString(input.country_code) === normalizeString(profile.country_code)) {
      matches++;
    }
  }

  if (matches < 3) {
    logger.warn('[ForgotPasswordService] Profile data mismatch', { userId: user.id, matches });
    throw new AuthError('Datos de recuperación inválidos.', 400);
  }

  for (const h of allHashes) {
    if (!h) {
      continue;
    }
    const reused = await verifyPassword(input.new_password, h);
    if (reused) {
      throw new ValidationError('La nueva contraseña no puede ser igual a una contraseña usada anteriormente.');
    }
  }

  const newHash = await hashPassword(input.new_password);
  const updated = await updateUserPassword(user.id, newHash);
  if (!updated) {
    throw new ValidationError('No se pudo actualizar la contraseña.', 500);
  }

  logger.info(`Password reset via forgot-password for user ${user.id}`);
  return { success: true };
}
