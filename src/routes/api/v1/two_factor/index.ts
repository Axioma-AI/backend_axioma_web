import { Router } from 'express';
import { twoFactorSetupRouter } from './two_factor_setup';
import { twoFactorVerifyRouter } from './two_factor_verify';
import { twoFactorStatusRouter } from './two_factor_status';
import { twoFactorDisableRouter } from './two_factor_disable';

export const twoFactorRouter = Router();

// Mount all 2FA routes
twoFactorRouter.use(twoFactorSetupRouter);
twoFactorRouter.use(twoFactorVerifyRouter);
twoFactorRouter.use(twoFactorStatusRouter);
twoFactorRouter.use(twoFactorDisableRouter);
