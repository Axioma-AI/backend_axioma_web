import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';
import { prisma } from '../../config/db_config';
import { toUserRecord, type UserRecord } from './common_repository';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export type { UserRecord };

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  const entity: any = await prisma.users.findUnique({ 
    where: { email }, 
    include: { }
  });
  const user = entity ? toUserRecord(entity as any) : null;
  logger.debug(`login_repository: getUserByEmail(${email}) -> ${user ? 'found' : 'null'}`);
  return user;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const entity: any = await prisma.users.findUnique({ 
    where: { username }, 
    include: { }
  });
  const user = entity ? toUserRecord(entity as any) : null;
  logger.debug(`login_repository: getUserByUsername(${username}) -> ${user ? 'found' : 'null'}`);
  return user;
}
