export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

export function jsonError(
  status: number,
  payload: ApiError
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

