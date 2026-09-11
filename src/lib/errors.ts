export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export function badRequest(message: string, code = "bad_request"): AppError {
  return new AppError(400, message, code);
}

export function unauthorized(message = "Unauthorized", code = "unauthorized"): AppError {
  return new AppError(401, message, code);
}

export function forbidden(message = "Forbidden", code = "forbidden"): AppError {
  return new AppError(403, message, code);
}

export function notFound(message = "Not found", code = "not_found"): AppError {
  return new AppError(404, message, code);
}

export function conflict(message: string, code = "conflict"): AppError {
  return new AppError(409, message, code);
}

export function tooMany(message = "Slow down", code = "rate_limited"): AppError {
  return new AppError(429, message, code);
}
