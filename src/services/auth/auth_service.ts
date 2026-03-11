import type { PublicUser } from '../../schemas/auth/common/user';
import type { LoginResponse } from '../../schemas/auth/login/response';
import { registerService } from './register_service';
import { loginService } from './login_service';
import { setupLogger } from '../../utils/logger';
import { getAppSettings, type AppSettings } from '../../config/settings';

const _APP_SETTINGS: AppSettings = getAppSettings();
const logger = setupLogger(_APP_SETTINGS.log_level);

export type { PublicUser };
export type LoginResult = LoginResponse;

export async function register(rawBody: any, creatorId: number): Promise<PublicUser> {
  logger.info('[AuthService] Register delegate called');
  const { user } = await registerService(rawBody, creatorId);
  logger.info('[AuthService] Register delegate success', { userId: user.id });
  return user;
}

export async function login(rawBody: any): Promise<LoginResult> {
  logger.info('[AuthService] Login delegate called');
  const result = await loginService(rawBody);
  logger.info('[AuthService] Login delegate success', { userId: result.user_id, requiresTwoFactor: result.requires_two_factor });
  return result;
}
