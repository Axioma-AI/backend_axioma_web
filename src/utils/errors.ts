export class ApiError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ApiError';
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace?.(this, this.constructor);
    }
}

export class ValidationError extends ApiError {
  constructor(message: string, statusCode = 400) {
    super(message, statusCode);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string, statusCode = 404) {
    super(message, statusCode);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends ApiError {
  payload?: any;

  constructor(message: string, statusCode = 401, payload?: any) {
    super(message, statusCode);
    this.name = 'AuthError';
    this.payload = payload;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
