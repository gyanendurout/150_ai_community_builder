export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: AppError }

export function ok<T>(data: T): Result<T> {
  return { data, error: null }
}

export function err(message: string, code: string, statusCode = 500): Result<never> {
  return { data: null, error: new AppError(message, code, statusCode) }
}
