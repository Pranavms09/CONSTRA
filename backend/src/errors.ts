import type { ContentfulStatusCode } from "hono/utils/http-status";

// Mirrors FastAPI's HTTPException: clients read `{ detail }` from error bodies.
export class ApiError extends Error {
  constructor(public status: ContentfulStatusCode, public detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

export const fail = (status: ContentfulStatusCode, detail: unknown): never => {
  throw new ApiError(status, detail);
};

export async function jsonBody<T = any>(req: { json: () => Promise<unknown> }): Promise<T> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object") throw new Error();
    return body as T;
  } catch {
    return fail(422, "Request body must be a JSON object.");
  }
}

export function intParam(value: string | undefined, name = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n)) fail(422, `Invalid integer for '${name}'`);
  return n;
}
