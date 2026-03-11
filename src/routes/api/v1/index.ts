import { Router } from 'express';
import { authRouterV1 } from './auth';
import { profileRouterV1 } from './profile';
import { twoFactorRouter } from './two_factor';
import { adminRouterV1 } from './admin';
import { interestsRouterV1 } from './interests';

export const apiRouterV1 = Router();

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: Endpoints de autenticación
 *   - name: Two Factor Authentication
 *     description: Endpoints de autenticación de dos factores (2FA)
 *   - name: Admin
 *     description: Endpoints de administración (solo rol admin)
 */
apiRouterV1.use('/auth', authRouterV1);
apiRouterV1.use('/profile', profileRouterV1);
apiRouterV1.use('/two-factor', twoFactorRouter);
apiRouterV1.use('/admin', adminRouterV1);
apiRouterV1.use('/interests', interestsRouterV1);

export default apiRouterV1;
