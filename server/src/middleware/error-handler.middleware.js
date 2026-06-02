import { Prisma } from '@prisma/client';
import { AppError, BadRequestError, ConflictError, NotFoundError, InternalServerError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import logger from '../utils/logger.js';

const normalizeDatabaseError = (error) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ConflictError('Duplicate value', {
        fields: error.meta?.target || [],
      });
    }
    if (error.code === 'P2025') {
      return new NotFoundError(error.meta?.cause || 'Record not found');
    }
    if (error.code === 'P2003' || error.code === 'P2004') {
      return new BadRequestError('Database constraint failed', {
        code: error.code,
        meta: error.meta,
      });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new BadRequestError('Database validation failed');
  }

  return error;
};

export const errorHandler = (err, req, res, _next) => {
  const normalized = normalizeDatabaseError(err);
  const error = normalized instanceof AppError
    ? normalized
    : new InternalServerError(normalized.message || 'Internal server error');

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error('Unhandled application error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: error.statusCode,
      error: normalized,
    });
  }

  const config = req.app.get('config');
  const details = error.statusCode >= 500 && config?.isProduction ? {} : error.details;

  res.status(error.statusCode).json(ApiResponse.error(error.message, details));
};
