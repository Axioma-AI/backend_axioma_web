import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { ValidationError } from '../../utils/errors';
import type { LoginResponse } from '../../schemas/auth/login/response';
import { createAccessToken, createRefreshToken, decodeToken } from '../../utils/jwt';
import { getUserById } from '../../repositories/auth/common_repository';
import { createSession, revokeAllActiveSessionsByUserId, revokeSessionByJti } from '../../repositories/auth/session_repository';
import { DeviceInfo } from '../../utils/device_info';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export async function refreshAccessTokenService(userId: number, deviceInfo?: DeviceInfo, previousRefreshJti?: string): Promise<LoginResponse & { refresh_token?: string }> {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ValidationError('Usuario no autenticado.', 401);
  }

  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  logger.info(`Refreshing access token for user_id=${user.id}`);

  const payload = {
    sub: String(user.id),
    role_id: user.role_id,
  };

  const accessToken = await createAccessToken(payload);
  const decoded = await decodeToken(accessToken);
  if (decoded?.jti && decoded?.exp) {
    const expiresAt = new Date((decoded.exp as number) * 1000);
    try {
      await createSession(user.id, decoded.jti as string, expiresAt, deviceInfo);
    } catch (e: any) {
      logger.error(`Failed to create session on refresh: ${e?.message ?? e}`);
    }
  } else {
    logger.warn('Token missing jti/exp when refreshing session.');
  }

  // Rotate refresh token
  const newRefreshToken = await createRefreshToken(payload);
  const decodedRefresh = await decodeToken(newRefreshToken);
  if (decodedRefresh?.jti && decodedRefresh?.exp) {
    const expiresAt = new Date((decodedRefresh.exp as number) * 1000);
    try {
      await createSession(user.id, decodedRefresh.jti as string, expiresAt, deviceInfo);
    } catch (e: any) {
      logger.error(`Failed to create session for rotated refresh: ${e?.message ?? e}`);
    }
  }
  if (previousRefreshJti) {
    try { await revokeSessionByJti(previousRefreshJti); } catch {}
  }

  return {
    user_id: user.id,
    role_name: (user.role_name as any) ?? null,
    access_token: accessToken,
    refresh_token: newRefreshToken,
  };
}
