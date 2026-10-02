import { NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { isUniqueViolation } from "@/lib/db-errors"

export { isUniqueViolation }

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NAME_CONFLICT"
  | "INVALID_MOVE"
  | "QUOTA_EXCEEDED"
  | "FILE_TOO_LARGE"
  | "RATE_LIMITED"
  | "STORAGE_ERROR"
  | "INTERNAL"

const STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NAME_CONFLICT: 409,
  INVALID_MOVE: 400,
  QUOTA_EXCEEDED: 413,
  FILE_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  STORAGE_ERROR: 502,
  INTERNAL: 500,
}

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
  }
}

/** Unauthorized and missing look the same from outside (404, not 403). */
export const notFound = (what = "item") =>
  new ApiError("NOT_FOUND", `This ${what} doesn't exist or you don't have access.`)

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...err.details } },
      { status: STATUS[err.code] }
    )
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: err.issues[0]?.message ?? "Invalid input",
          issues: err.issues,
        },
      },
      { status: 400 }
    )
  }
  if (isUniqueViolation(err)) {
    return NextResponse.json(
      {
        error: {
          code: "NAME_CONFLICT",
          message: "An item with that name already exists here.",
        },
      },
      { status: 409 }
    )
  }
  console.error(err)
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "The server hit an unexpected error." } },
    { status: 500 }
  )
}


export async function requireUserId(): Promise<string> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) throw new ApiError("UNAUTHORIZED", "Sign in to continue.")
  return id
}

type Handler<Req extends Request, Ctx> = (req: Req, ctx: Ctx) => Promise<Response>

/** Wraps a route handler with the consistent `{ error: { code, message } }` shape. */
export function route<Req extends Request, Ctx>(
  handler: Handler<Req, Ctx>
): Handler<Req, Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      return errorResponse(err)
    }
  }
}

export async function readJson<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<z.infer<T>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    throw new ApiError("VALIDATION", "Request body must be JSON.")
  }
  return schema.parse(body)
}
