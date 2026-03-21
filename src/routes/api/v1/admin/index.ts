import { Router } from 'express';
import { adminUsersRouter } from './users_list';
import { adminUsersCreateRouter } from './users_create';
import { adminUsersDeleteRouter } from './users_delete';
import { adminUsersSeatsRouter } from './users_seats';
import { adminUsersPatchRouter } from './users_patch';
import { adminInterestsGroupsRouter } from './interests_groups';
import { adminInterestsRouter } from './interests';
import { adminUsersSummaryRouter } from './users_summary';
import { adminUsersSeatsSummaryRouter } from './users_seats_summary';

export const adminRouterV1 = Router();

/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: Endpoints de administración (solo rol admin)
 */
adminRouterV1.use(adminUsersRouter);
adminRouterV1.use(adminUsersCreateRouter);
adminRouterV1.use(adminUsersDeleteRouter);
adminRouterV1.use(adminUsersSeatsRouter);
adminRouterV1.use(adminUsersPatchRouter);
adminRouterV1.use(adminInterestsGroupsRouter);
adminRouterV1.use(adminInterestsRouter);
adminRouterV1.use(adminUsersSummaryRouter);
adminRouterV1.use(adminUsersSeatsSummaryRouter);

export default adminRouterV1;
