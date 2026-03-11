import { z } from 'zod';
import { HTTP } from '../schemas/common/baseResponse';
import { ValidationError } from '../utils/errors';

export function zodValidation<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  httpStatus: number = HTTP.BAD_REQUEST
): T {
  try {
    return schema.parse(payload);
  } catch (err: any) {
    const issue = err?.issues?.[0];
    const path = Array.isArray(issue?.path) && issue.path.length > 0 ? issue.path.join('.') : '';
    const msg = issue?.message ?? 'Invalid request.';
    const message = path ? `${path}: ${msg}` : msg;

    throw new ValidationError(message, httpStatus);
  }
}
