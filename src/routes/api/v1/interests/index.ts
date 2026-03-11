import { Router } from 'express';
import { interestsCreateRouter } from './interests_create';
import { interestsDeleteRouter } from './interests_delete';
import { interestsGroupsCreateRouter } from './groups_create';
import { interestsGroupsDeleteRouter } from './groups_delete';
import { interestsGroupsItemsAddRouter } from './groups_items_add';
import { interestsGroupsItemsDeleteRouter } from './groups_items_delete';
import { interestsSummaryRouter } from './summary';
import { errorMiddleware } from '../../../../middlewares/errorMiddleware';

export const interestsRouterV1 = Router();

interestsRouterV1.use('/', interestsCreateRouter);
interestsRouterV1.use('/', interestsDeleteRouter);
interestsRouterV1.use('/', interestsGroupsCreateRouter);
interestsRouterV1.use('/', interestsGroupsDeleteRouter);
interestsRouterV1.use('/', interestsGroupsItemsAddRouter);
interestsRouterV1.use('/', interestsGroupsItemsDeleteRouter);
interestsRouterV1.use('/', interestsSummaryRouter);
interestsRouterV1.use(errorMiddleware);

export default interestsRouterV1;
