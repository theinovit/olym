type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

export function dataResponse<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, init);
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status });
}
