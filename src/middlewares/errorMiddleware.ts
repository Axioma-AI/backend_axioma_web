import { NextFunction, Request, Response } from "express";
import { ApiError, ValidationError, NotFoundError } from "../utils/errors";
import { HTTP } from "../schemas/common/baseResponse";
import { Prisma } from "@prisma/client";
import { parsePrismaError } from "../utils/prisma_error_parser";
import { ZodError } from "zod";

export const errorMiddleware = (
    error: Error & Partial<ApiError>,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let statusCode = error.statusCode ?? HTTP.INTERNAL_SERVER_ERROR;
    let message = error.statusCode ? error.message : 'Internal Server Error';

    try {
      if (error instanceof ZodError) {
        statusCode = HTTP.BAD_REQUEST;
        const msgs = Array.from(new Set(error.issues.map(i => i.message).filter(Boolean)));
        message = msgs.length > 0 ? msgs.join('; ') : 'Datos inválidos.';
      }
    } catch {
      statusCode = HTTP.INTERNAL_SERVER_ERROR;
      message = 'Internal Server Error';
    }

    // Sanitize Prisma errors into friendly ApiErrors
    try {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError ||
        error instanceof Prisma.PrismaClientValidationError ||
        error instanceof Prisma.PrismaClientUnknownRequestError
      ) {
        try {
          parsePrismaError(error, {
            notFound: 'Registro no encontrado.',
            unique: 'El valor ya está en uso.',
            fk: 'Violación de restricción de integridad referencial.',
            validation: 'Datos inválidos.',
            unknown: 'Error de base de datos inesperado.',
          });
        } catch (converted: any) {
          if (converted instanceof ValidationError || converted instanceof NotFoundError) {
            statusCode = converted.statusCode ?? HTTP.BAD_REQUEST;
            message = converted.message ?? 'Solicitud inválida.';
          } else if (converted instanceof ApiError) {
            statusCode = converted.statusCode ?? HTTP.BAD_REQUEST;
            message = converted.message ?? 'Solicitud inválida.';
          } else {
            statusCode = HTTP.INTERNAL_SERVER_ERROR;
            message = 'Internal Server Error';
          }
        }
      }
    } catch {
      statusCode = HTTP.INTERNAL_SERVER_ERROR;
      message = 'Internal Server Error';
    }

    return res.status(statusCode).json({ success: false, data: null, message });
};
