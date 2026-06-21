import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(
  message: string,
  status = 400,
  code?: string
) {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return apiError(error.message, error.statusCode, error.code);
  }

  if (isZodError(error)) {
    const message = error.errors.map((e) => e.message).join(", ");
    return apiError(message, 422, "VALIDATION_ERROR");
  }

  console.error("[API Error]", error);
  return apiError("An unexpected error occurred", 500, "INTERNAL_ERROR");
}

function isZodError(error: unknown): error is ZodError {
  return (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    Array.isArray((error as ZodError).errors)
  );
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}
