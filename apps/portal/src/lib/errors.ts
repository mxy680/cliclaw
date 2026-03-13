export class CliclawError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "CliclawError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends CliclawError {
  constructor(message = "Bad request") {
    super(message, "BAD_REQUEST", 400);
  }
}

export class UnauthorizedError extends CliclawError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends CliclawError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends CliclawError {
  constructor(message = "Not found") {
    super(message, "NOT_FOUND", 404);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof CliclawError) {
    return Response.json(
      { error: err.message, code: err.code },
      { status: err.statusCode }
    );
  }
  console.error("Unhandled error:", err);
  return Response.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
