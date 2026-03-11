import { SignJWT, jwtVerify, importPKCS8, importSPKI } from 'jose';
import crypto from 'crypto';
import { setupLogger } from './logger';
import { getAppSettings, getJwtSettings, type AppSettings, type JwtSettings } from '../config/settings';

const _APP_SETTINGS: AppSettings = getAppSettings();
const _JWT_SETTINGS: JwtSettings = getJwtSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

const ALLOWED_ALGORITHMS = new Set([
  'HS256', 'HS384', 'HS512',
  'RS256', 'RS384', 'RS512',
  'PS256', 'PS384', 'PS512',
  'ES256', 'ES384', 'ES512',
  'EdDSA'
]);
const WEAK_SECRETS = new Set(['changeme', 'secret', 'password', '123456', 'default', 'admin', 'qwerty']);

function ensureConfigIsSecure(): void {
  const alg = _JWT_SETTINGS.jwt_algorithm;
  if (!ALLOWED_ALGORITHMS.has(alg)) {
    throw new Error(`JWT_ALGORITHM must be one of HS256/HS384/HS512/RS256/RS384/RS512/ES256/ES384/ES512. Received: ${alg}`);
  }

  if (_JWT_SETTINGS.jwt_algorithm.startsWith('HS')) {
    const secret = _JWT_SETTINGS.jwt_secret?.trim() ?? '';
    if (secret.length < 32) {
      throw new Error('JWT_SECRET is too short. Use at least 32 characters with high entropy.');
    }
    if (WEAK_SECRETS.has(secret.toLowerCase())) {
      throw new Error('JWT_SECRET uses a known weak value. Choose a random, high‑entropy secret.');
    }
  } else {
    const priv = _JWT_SETTINGS.jwt_private_key?.trim() ?? '';
    const pub = _JWT_SETTINGS.jwt_public_key?.trim() ?? '';
    if (!priv || !pub) {
      throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY are required for RS*/PS*/ES*/EdDSA.');
    }
    const hasPemPriv = priv.includes('BEGIN PRIVATE KEY') && priv.includes('END PRIVATE KEY');
    const hasPemPub = pub.includes('BEGIN PUBLIC KEY') && pub.includes('END PUBLIC KEY');
    if (!hasPemPriv || !hasPemPub) {
      throw new Error('JWT keys must be valid PEM strings with BEGIN/END markers.');
    }
  }
}

function isHmac(): boolean {
  return _JWT_SETTINGS.jwt_algorithm.startsWith('HS');
}

async function getSigningKey(): Promise<any> {
  ensureConfigIsSecure();
  if (isHmac()) {
    return new TextEncoder().encode(_JWT_SETTINGS.jwt_secret);
  }
  const alg = _JWT_SETTINGS.jwt_algorithm;
  const priv = _JWT_SETTINGS.jwt_private_key as string;
  return await importPKCS8(priv, alg);
}

async function getVerifyKey(): Promise<any> {
  ensureConfigIsSecure();
  if (isHmac()) {
    return new TextEncoder().encode(_JWT_SETTINGS.jwt_secret);
  }
  const alg = _JWT_SETTINGS.jwt_algorithm;
  const pub = _JWT_SETTINGS.jwt_public_key as string;
  return await importSPKI(pub, alg);
}

async function buildToken(data: Record<string, any>, expiresMinutes: number): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();
  const payload = { ...data, jti };

  try {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: _JWT_SETTINGS.jwt_algorithm, typ: 'JWT' })
      .setIssuedAt(nowSeconds)
      .setExpirationTime(nowSeconds + expiresMinutes * 60)
      .setIssuer(_JWT_SETTINGS.jwt_issuer)
      .setAudience(_JWT_SETTINGS.jwt_audience)
      .sign(await getSigningKey());
    logger.debug('✅ JWT generated successfully');
    return token;
  } catch (e: any) {
    logger.error(`❌ Error generating JWT: ${e?.message ?? e}`);
    throw e;
  }
}

export async function createAccessToken(data: Record<string, any>): Promise<string> {
  return await buildToken(data, _JWT_SETTINGS.jwt_expiration_minutes);
}

export async function createRefreshToken(data: Record<string, any>): Promise<string> {
  return await buildToken(data, _JWT_SETTINGS.jwt_refresh_expiration_minutes);
}

export async function decodeToken(token: string): Promise<Record<string, any> | null> {
  try {
    const { payload } = await jwtVerify(token, await getVerifyKey(), {
      issuer: _JWT_SETTINGS.jwt_issuer,
      audience: _JWT_SETTINGS.jwt_audience,
      algorithms: [_JWT_SETTINGS.jwt_algorithm as any],
      clockTolerance: 60,
    });
    logger.debug('🔓 JWT decoded successfully');
    return payload as Record<string, any>;
  } catch (e: any) {
    logger.warn(`⚠️ Invalid or expired token: ${e?.message ?? e}`);
    return null;
  }
}
