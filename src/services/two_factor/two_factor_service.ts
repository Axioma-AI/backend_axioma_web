import speakeasy from 'speakeasy';
import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { ValidationError } from '../../utils/errors';
import type { TwoFactorSetupResponse, TwoFactorVerifyResponse, TwoFactorStatusResponse } from '../../schemas/two_factor/response';
import {
  getTwoFactorByUserId,
  createTwoFactorRecord,
  updateTwoFactorRecord,
  deleteTwoFactorRecord,
  enableTwoFactor,
  disableTwoFactor,
  type TwoFactorRecord
} from '../../repositories/two_factor/two_factor_repository';
import { getUserById } from '../../repositories/auth/common_repository';
import { hashPassword, verifyPassword } from '../../utils/password_utils';
import {
  createRecoveryCodes,
  deleteAllRecoveryCodes,
  getUnusedRecoveryCodesByUser,
  markRecoveryCodeAsUsed,
} from '../../repositories/two_factor/recovery_codes_repository';
import { createAccessToken, decodeToken } from '../../utils/jwt';
import { createSession } from '../../repositories/auth/session_repository';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

/**
 * Genera un secreto y configuración inicial para 2FA
 */
export async function setupTwoFactorService(
  userId: number
): Promise<TwoFactorSetupResponse> {
  logger.info('[TwoFactorService] Setup start', { userId });
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  const existing = await getTwoFactorByUserId(userId);
  if (existing && existing.is_enabled) {
    throw new ValidationError('2FA ya está habilitado para este usuario.', 409);
  }

  const finalIssuer = _APP_SETTINGS.service_name || 'SeagullAI Backend';
  const accountName = user.email;
  const finalLabel = `${finalIssuer}:${accountName}`;

  const secret = speakeasy.generateSecret({
    length: 32,
    name: finalLabel,
    issuer: finalIssuer
  });

  if (existing) {
    const updated = await updateTwoFactorRecord(userId, {
      secret: secret.base32,
      issuer: finalIssuer,
      label: finalLabel,
      is_enabled: false,
      confirmed_at: null
    });
    
    if (!updated) {
      throw new ValidationError('Error al actualizar la configuración 2FA.', 500);
    }
  } else {
    const created = await createTwoFactorRecord(
      userId,
      secret.base32,
      'sha1', // Algoritmo por defecto
      6,      // 6 dígitos
      30,     // 30 segundos de período
      finalIssuer,
      finalLabel
    );
    
    if (!created) {
      throw new ValidationError('Error al crear la configuración 2FA.', 500);
    }
  }

  logger.info('[TwoFactorService] Setup success', { userId });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  return {
    secret: secret.base32,
    qr_code_url: secret.otpauth_url || '',
    manual_entry_key: secret.base32,
    issuer: finalIssuer,
    label: finalLabel,
    expires_at: expiresAt
  };
}

/**
 * Verifica un código TOTP y habilita 2FA si es correcto
 */
export async function verifyAndEnableTwoFactorService(
  userId: number,
  token: string
): Promise<TwoFactorVerifyResponse> {
  logger.info('[TwoFactorService] Verify & enable start', { userId });
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  const twoFactorRecord = await getTwoFactorByUserId(userId);
  if (!twoFactorRecord) {
    throw new ValidationError('No se encontró configuración 2FA para este usuario.', 404);
  }

  if (twoFactorRecord.is_enabled) {
    throw new ValidationError('2FA ya está habilitado para este usuario.', 409);
  }

  const configTime = new Date(twoFactorRecord.updated_at);
  const now = new Date();
  const diffMs = now.getTime() - configTime.getTime();
  const diffMinutes = diffMs / 1000 / 60;

  if (diffMinutes > 10) {
    throw new ValidationError('El tiempo para configurar 2FA ha expirado (10 minutos). Por favor, inicie el proceso nuevamente.', 400);
  }

  const verified = speakeasy.totp.verify({
    secret: twoFactorRecord.secret,
    encoding: 'base32',
    token: token,
    step: twoFactorRecord.period,
    digits: twoFactorRecord.digits,
    algorithm: twoFactorRecord.algorithm,
    window: 2 // Permitir una ventana de ±2 períodos (±60 segundos por defecto)
  });

  if (!verified) {
    logger.warn(`Invalid 2FA token attempt for user ${userId}`);
    throw new ValidationError('Código de verificación inválido.', 400);
  }

  const enabled = await enableTwoFactor(userId);
  if (!enabled) {
    throw new ValidationError('Error al habilitar 2FA.', 500);
  }

  logger.info('[TwoFactorService] 2FA enabled', { userId });
  try { await deleteAllRecoveryCodes(userId); } catch (e) { /* noop */ }

  const codesPlain: string[] = [];
  const codesHash: string[] = [];
  function genCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return `${s.slice(0,4)}-${s.slice(4,8)}-${s.slice(8,12)}`;
  }
  for (let i = 0; i < 10; i++) {
    const code = genCode();
    codesPlain.push(code);
  }
  for (const c of codesPlain) {
    const h = await hashPassword(c);
    codesHash.push(h);
  }
  await createRecoveryCodes(userId, codesHash);

  const payload = {
    sub: String(user.id),
    role_id: user.role_id,
  };
  const fullAccessToken = await createAccessToken(payload);
  const decoded = await decodeToken(fullAccessToken);
  if (decoded?.jti && decoded?.exp) {
    const expiresAt = new Date((decoded.exp as number) * 1000);
    try { await createSession(user.id, decoded.jti as string, expiresAt); } catch {}
  }

  return {
    success: true,
    message: '2FA habilitado correctamente.',
    user_id: user.id,
    role_id: user.role_id ?? null,
    recovery_codes: codesPlain,
    access_token: fullAccessToken,
  };
}

/**
 * Verifica un código TOTP para un usuario que ya tiene 2FA habilitado
 */
export async function verifyTwoFactorTokenService(
  userId: number,
  token: string
): Promise<boolean> {
  // Obtener la configuración 2FA
  const twoFactorRecord = await getTwoFactorByUserId(userId);
  if (!twoFactorRecord || !twoFactorRecord.is_enabled) {
    return false;
  }

  // Verificar el token usando speakeasy
  const verified = speakeasy.totp.verify({
    secret: twoFactorRecord.secret,
    encoding: 'base32',
    token: token,
    step: twoFactorRecord.period,
    digits: twoFactorRecord.digits,
    algorithm: twoFactorRecord.algorithm,
    window: 2 // Permitir una ventana de ±2 períodos
  });

  if (verified) {
    logger.debug(`2FA token verified successfully for user ${userId}`);
  } else {
    logger.warn(`Invalid 2FA token for user ${userId}`);
  }

  return verified;
}

/**
 * Completa el login 2FA: verifica el TOTP y entrega un access token completo
 */
export async function completeTwoFactorLoginService(
  userId: number,
  twoFactorToken: string
): Promise<{ user_id: number; role_id: number | null; access_token: string }> {
  logger.info('[TwoFactorService] Complete login with 2FA start', { userId });
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  const ok = await verifyTwoFactorTokenService(userId, twoFactorToken);
  if (!ok) {
    logger.warn('[TwoFactorService] Complete login with 2FA invalid token', { userId });
    throw new ValidationError('Código de autenticación de dos factores inválido.', 400);
  }

  // Emitir nuevo token de acceso sin two_factor_pending para conceder acceso completo
  const payload = {
    sub: String(user.id),
    role_id: user.role_id,
  };
  const accessToken = await createAccessToken(payload);
  // Registrar sesión usando jti y exp del token
  const decoded = await decodeToken(accessToken);
  if (decoded?.jti && decoded?.exp) {
    const expiresAt = new Date((decoded.exp as number) * 1000);
    try { await createSession(user.id, decoded.jti as string, expiresAt); } catch {}
  }

  return {
    user_id: user.id,
    role_id: user.role_id ?? null,
    access_token: accessToken,
  };
}

export async function completeTwoFactorLoginWithRecoveryCodeService(
  userId: number,
  recoveryCode: string
): Promise<{ user_id: number; role_id: number | null; access_token: string }> {
  logger.info('[TwoFactorService] Complete login with recovery code start', { userId });
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  const twoFactorRecord = await getTwoFactorByUserId(userId);
  if (!twoFactorRecord || !twoFactorRecord.is_enabled) {
    throw new ValidationError('La autenticación de dos factores no está habilitada para este usuario.', 400);
  }

  const codes = await getUnusedRecoveryCodesByUser(userId);
  if (!codes || codes.length === 0) {
    throw new ValidationError('No hay códigos de recuperación disponibles.', 400);
  }

  let matchedId: number | null = null;
  for (const c of codes) {
    const ok = await verifyPassword(recoveryCode, c.code_hash);
    if (ok) {
      matchedId = c.id;
      break;
    }
  }

  if (!matchedId) {
    logger.warn('[TwoFactorService] Recovery code invalid', { userId });
    throw new ValidationError('Código de recuperación inválido.', 400);
  }

  await markRecoveryCodeAsUsed(matchedId);

  const payload = {
    sub: String(user.id),
    role_id: user.role_id,
  };
  const accessToken = await createAccessToken(payload);
  const decoded = await decodeToken(accessToken);
  if (decoded?.jti && decoded?.exp) {
    const expiresAt = new Date((decoded.exp as number) * 1000);
    try { await createSession(user.id, decoded.jti as string, expiresAt); } catch {}
  }

  return {
    user_id: user.id,
    role_id: user.role_id ?? null,
    access_token: accessToken,
  };
}

/**
 * Obtiene el estado actual de 2FA para un usuario
 */
export async function getTwoFactorStatusService(userId: number): Promise<TwoFactorStatusResponse> {
  logger.info('[TwoFactorService] Get status', { userId });
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  const twoFactorRecord = await getTwoFactorByUserId(userId);
  
  if (!twoFactorRecord) {
    return {
      is_enabled: false,
      confirmed_at: null,
      issuer: null,
      label: null
    };
  }

  return {
    is_enabled: twoFactorRecord.is_enabled,
    confirmed_at: twoFactorRecord.confirmed_at ? twoFactorRecord.confirmed_at.toISOString() : null,
    issuer: twoFactorRecord.issuer,
    label: twoFactorRecord.label
  };
}

/**
 * Deshabilita 2FA para un usuario (requiere verificación de token)
 */
export async function disableTwoFactorService(
  userId: number,
  token: string
): Promise<TwoFactorVerifyResponse> {
  // Verificar que el usuario existe
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  // Obtener la configuración 2FA
  const twoFactorRecord = await getTwoFactorByUserId(userId);
  if (!twoFactorRecord || !twoFactorRecord.is_enabled) {
    throw new ValidationError('2FA no está habilitado para este usuario.', 404);
  }

  // Verificar el token antes de deshabilitar
  const verified = await verifyTwoFactorTokenService(userId, token);
  if (!verified) {
    throw new ValidationError('Código de verificación inválido.', 400);
  }

  // Deshabilitar 2FA
  const disabled = await disableTwoFactor(userId);
  if (!disabled) {
    throw new ValidationError('Error al deshabilitar 2FA.', 500);
  }

  logger.info(`2FA disabled for user ${userId}`);

  return {
    success: true,
    message: '2FA deshabilitado correctamente.'
  };
}

/**
 * Elimina completamente la configuración 2FA de un usuario
 */
export async function removeTwoFactorService(
  userId: number,
  token: string
): Promise<TwoFactorVerifyResponse> {
  // Verificar que el usuario existe
  const user = await getUserById(userId);
  if (!user) {
    throw new ValidationError('Usuario no encontrado.', 404);
  }

  // Obtener la configuración 2FA
  const twoFactorRecord = await getTwoFactorByUserId(userId);
  if (!twoFactorRecord) {
    throw new ValidationError('No se encontró configuración 2FA para este usuario.', 404);
  }

  // Si está habilitado, verificar el token antes de eliminar
  if (twoFactorRecord.is_enabled) {
    const verified = await verifyTwoFactorTokenService(userId, token);
    if (!verified) {
      throw new ValidationError('Código de verificación inválido.', 400);
    }
  }

  // Eliminar la configuración 2FA
  const deleted = await deleteTwoFactorRecord(userId);
  if (!deleted) {
    throw new ValidationError('Error al eliminar la configuración 2FA.', 500);
  }

  try {
    await deleteAllRecoveryCodes(userId);
  } catch {
  }

  logger.info(`2FA configuration removed for user ${userId}`);

  return {
    success: true,
    message: 'Configuración 2FA eliminada correctamente.'
  };
}
