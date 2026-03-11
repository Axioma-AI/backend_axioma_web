import { Response } from 'express';
import { BaseResponse } from '../schemas/common/baseResponse';

export function buildResponse<T>(
  res: Response,
  status: number,
  data: T,
  message?: string
) {
  return res.status(status).json(new BaseResponse<T>(data, message));
}
