/**
 * Parses a fetch Response as JSON, with a clear error when the server
 * returns HTML instead (e.g. a 500 error page, an unexpected redirect,
 * or a misconfigured route that renders a Next.js page instead of JSON).
 *
 * Usage:
 *   const json = await safeJson<MyType>(response);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function safeJson<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    // Read the body so we can surface a useful message without crashing.
    const text = await response.text().catch(() => "");
    const isHtml = text.trimStart().startsWith("<");
    const snippet = text.slice(0, 200).replace(/\s+/g, " ").trim();

    const hint = isHtml
      ? `Server returned an HTML page (status ${response.status}). This usually means an auth redirect or an unhandled server error.`
      : `Server returned non-JSON content (status ${response.status}): ${snippet || "(empty body)"}`;

    throw new Error(hint);
  }

  return response.json() as Promise<T>;
}
