import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { AuthError, ValidationError } from '../../utils/errors';
import type { LoginResponse } from '../../schemas/auth/login/response';
import { verifyPassword } from '../../utils/password_utils';
import { createAccessToken, decodeToken, createRefreshToken } from '../../utils/jwt';
import {
  getUserByEmail,
  getUserByUsername,
  type UserRecord,
} from '../../repositories/auth/login_repository';
import { getActiveSessionByUserId, createSession, revokeAllActiveSessionsByUserId } from '../../repositories/auth/session_repository';
import { getTwoFactorByUserId } from '../../repositories/two_factor/two_factor_repository';
import { verifyTwoFactorTokenService } from '../two_factor/two_factor_service';
import { DeviceInfo } from '../../utils/device_info';
import { zodValidation } from '../../utils/zod_validation';
import { LoginRequestSchema } from '../../schemas/auth/login/zod/login_schema';


const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);


export async function loginService(rawBody: any, deviceInfo?: DeviceInfo): Promise<LoginResponse> {
  const input = zodValidation(LoginRequestSchema, rawBody);
  const user = input.email
    ? await getUserByEmail(input.email)
    : await getUserByUsername(input.username!);

  if (!user) {
    throw new AuthError('Credenciales inválidas.');
  }

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    throw new AuthError('Credenciales inválidas.');
  }

  const requiresPasswordChange = user.change_password === true;

  // Verificar 2FA si está habilitado para el usuario
  const twoFactorRecord = await getTwoFactorByUserId(user.id);
  let requiresTwoFactor = false;
  if (twoFactorRecord && twoFactorRecord.is_enabled) {
    // Si se proporciona token, verificarlo; de lo contrario, indicar que está pendiente
    if (input.two_factor_token) {
      try {
        const ok2fa = await verifyTwoFactorTokenService(user.id, input.two_factor_token);
        if (!ok2fa) {
          throw new AuthError('Código de autenticación de dos factores inválido.');
        }
      } catch (error: any) {
        if (error instanceof AuthError) {
          throw error;
        }
        throw new AuthError('Error al verificar código de autenticación de dos factores.');
      }
    } else {
      requiresTwoFactor = true;
    }
  } else if (input.two_factor_token) {
    // Se proporcionó token 2FA pero no está habilitado
    throw new AuthError('La autenticación de dos factores no está habilitada para este usuario.', 400);
  }

  const active = await getActiveSessionByUserId(user.id);
  if (active) {
    if (input.force_new_session) {
      await revokeAllActiveSessionsByUserId(user.id);
      logger.info(`User ${user.id} forced new session, revoking previous ones.`);
    } else {
      throw new AuthError('Ya existe una sesión activa para este usuario.', 409, {
        active_session: {
          ip_address: active.ip_address,
          os_name: active.os_name,
          client_name: active.client_name,
          location_city: active.location_city,
          location_country: active.location_country,
          created_at: active.created_at,
        }
      });
    }
  }

  logger.info(`Login successful: ${user.email}`);
  const payload = {
    sub: String(user.id),
    role_id: user.role_id,
    two_factor_pending: requiresTwoFactor ? true : undefined,
    change_password_required: requiresPasswordChange ? true : undefined,
  };
  const accessToken = await createAccessToken(payload);
  // Registrar sesión usando jti y exp del token
  const decoded = await decodeToken(accessToken);
  if (decoded?.jti && decoded?.exp) {
    const expiresAt = new Date((decoded.exp as number) * 1000);
    try {
      await createSession(user.id, decoded.jti as string, expiresAt, deviceInfo);
    } catch (e: any) {
      logger.error(`Failed to create session: ${e?.message ?? e}`);
    }
  } else {
    logger.warn('Token missing jti/exp when creating session.');
  }

  // Generar Refresh Token y su sesión
  const refreshToken = await createRefreshToken(payload);
  const decodedRefresh = await decodeToken(refreshToken);
  if (decodedRefresh?.jti && decodedRefresh?.exp) {
    const expiresAt = new Date((decodedRefresh.exp as number) * 1000);
    try {
      await createSession(user.id, decodedRefresh.jti as string, expiresAt, deviceInfo);
    } catch (e: any) {
      logger.error(`Failed to create refresh session: ${e?.message ?? e}`);
    }
  }

  return {
    user_id: user.id,
    role_name: (user.role_name as any) ?? null,
    access_token: accessToken,
    refresh_token: refreshToken,
    requires_two_factor: requiresTwoFactor || undefined,
    requires_password_change: requiresPasswordChange || undefined,
  };
}
