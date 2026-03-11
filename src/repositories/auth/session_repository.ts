import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { Sessions } from '../../models/database/dbName/session_model';
import { DeviceInfo } from '../../utils/device_info';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export interface SessionRecord {
  id: number;
  user_id: number;
  jti: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  // Device Info
  ip_address?: string | null;
  user_agent?: string | null;
  device_type?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  client_name?: string | null;
  client_version?: string | null;
  location_country?: string | null;
  location_region?: string | null;
  location_city?: string | null;
}

export function toSessionRecord(entity: any): SessionRecord {
  return {
    id: entity.id,
    user_id: (entity as any).user?.id ?? (entity as any).user_id ?? entity.userId ?? 0,
    jti: entity.jti,
    created_at: entity.created_at ?? entity.createdAt,
    updated_at: entity.updated_at ?? entity.updatedAt,
    expires_at: entity.expires_at ?? entity.expiresAt,
    revoked_at: entity.revoked_at ?? entity.revokedAt ?? null,
    ip_address: entity.ip_address ?? null,
    user_agent: entity.user_agent ?? null,
    device_type: entity.device_type ?? null,
    device_brand: entity.device_brand ?? null,
    device_model: entity.device_model ?? null,
    os_name: entity.os_name ?? null,
    os_version: entity.os_version ?? null,
    client_name: entity.client_name ?? null,
    client_version: entity.client_version ?? null,
    location_country: entity.location_country ?? null,
    location_region: entity.location_region ?? null,
    location_city: entity.location_city ?? null,
  };
}

export async function getActiveSessionByUserId(userId: number): Promise<SessionRecord | null> {
  const entity: any = await Sessions.findFirst({
    where: {
      user_id: userId,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    orderBy: [{ created_at: 'desc' }],
  });
  const rec = entity ? toSessionRecord(entity) : null;
  logger.debug(`session_repository: getActiveSessionByUserId(${userId}) -> ${rec ? 'found' : 'null'}`);
  return rec;
}

export async function getActiveSessionByJti(jti: string): Promise<SessionRecord | null> {
  const entity: any = await Sessions.findFirst({
    where: {
      jti,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    orderBy: [{ created_at: 'desc' }],
  });
  const rec = entity ? toSessionRecord(entity) : null;
  logger.debug(`session_repository: getActiveSessionByJti(${jti}) -> ${rec ? 'found' : 'null'}`);
  return rec;
}

export async function createSession(userId: number, jti: string, expiresAt: Date, deviceInfo?: DeviceInfo): Promise<SessionRecord> {
  const data: any = {
    users: { connect: { id: userId } },
    jti,
    expires_at: expiresAt,
  };

  if (deviceInfo) {
    data.ip_address = deviceInfo.ip_address;
    data.user_agent = deviceInfo.user_agent;
    data.device_type = deviceInfo.device_type;
    data.device_brand = deviceInfo.device_brand;
    data.device_model = deviceInfo.device_model;
    data.os_name = deviceInfo.os_name;
    data.os_version = deviceInfo.os_version;
    data.client_name = deviceInfo.client_name;
    data.client_version = deviceInfo.client_version;
    data.location_country = deviceInfo.location_country;
    data.location_region = deviceInfo.location_region;
    data.location_city = deviceInfo.location_city;
  }

  const saved: any = await Sessions.create({
    data,
  });
  logger.info(`Session created id=${saved.id} for user_id=${userId}`);
  return toSessionRecord(saved);
}

export async function revokeSessionByJti(jti: string): Promise<boolean> {
  const entity: any = await Sessions.findFirst({ where: { jti } });
  if (!entity) {
    logger.warn(`No session found for jti=${jti} when revoking`);
    return false;
  }
  if (entity.revoked_at ?? entity.revokedAt) {
    logger.debug(`Session jti=${jti} was already revoked`);
    return false;
  }
  await Sessions.update({ where: { id: entity.id }, data: { revoked_at: new Date() } });
  logger.info(`Session revoked jti=${jti}`);
  return true;
}

export async function revokeAllActiveSessionsByUserId(userId: number, exceptJti?: string): Promise<number> {
  const rows: any[] = await Sessions.findMany({
    where: {
      user_id: userId,
      revoked_at: null,
      expires_at: { gt: new Date() },
    },
    orderBy: [{ created_at: 'desc' }],
    take: 500,
  });
  let count = 0;
  for (const row of rows) {
    if (exceptJti && row.jti === exceptJti) continue;
    await Sessions.update({ where: { id: row.id }, data: { revoked_at: new Date() } });
    count++;
  }
  if (count > 0) logger.info(`Revoked ${count} active sessions for user_id=${userId}${exceptJti ? ` (except jti=${exceptJti})` : ''}`);
  return count;
}

export async function getSessionByJti(jti: string): Promise<SessionRecord | null> {
  const entity: any = await Sessions.findFirst({
    where: { jti },
    orderBy: [{ created_at: 'desc' }],
  });
  const rec = entity ? toSessionRecord(entity) : null;
  logger.debug(`session_repository: getSessionByJti(${jti}) -> ${rec ? 'found' : 'null'}`);
  return rec;
}
