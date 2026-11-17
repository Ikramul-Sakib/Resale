export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function isSupabaseNotFound(error: { code?: string; status?: number } | null | undefined): boolean {
  return error?.code === 'PGRST116' || error?.status === 404;
}

export function repositoryError(error: { message?: string; code?: string } | null | undefined): AppError {
  if (error?.code === '23505') return new AppError(409, 'CONFLICT', 'The requested record already exists.');
  if (error?.code === '23503') return new AppError(400, 'INVALID_REFERENCE', 'A referenced record does not exist.');
  if (error?.code === '23514') return new AppError(400, 'CONSTRAINT_VIOLATION', 'The submitted data violates a database constraint.');
  return new AppError(500, 'DATABASE_ERROR', 'A database operation failed.');
}
