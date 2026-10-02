import type { ApiErrorBody } from "@/lib/types"

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details: Record<string, unknown> = {}
  ) {
    super(message)
  }
}

export async function api<T>(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: unknown } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
  } catch {
    throw new ApiClientError(
      "NETWORK",
      "Couldn't reach BaseDrive. Check your connection and try again.",
      0
    )
  }
  if (!res.ok) {
    let body: ApiErrorBody | null = null
    try {
      body = await res.json()
    } catch {}
    const { code = "INTERNAL", message = `Request failed (${res.status}).`, ...rest } =
      body?.error ?? {}
    throw new ApiClientError(code, message, res.status, rest)
  }
  return res.json() as Promise<T>
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : "The request failed."
