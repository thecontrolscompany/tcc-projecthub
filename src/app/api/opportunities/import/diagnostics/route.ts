/**
 * Diagnostic endpoint — visit /api/opportunities/import/diagnostics to see
 * exactly which module is failing to load on the server. All imports are
 * dynamic so a crash in any one does NOT crash the whole response.
 */
export async function GET() {
  const results: Record<string, string> = {
    runtime: process.version,
    env: process.env.NODE_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
  };

  const tests: Array<[string, () => Promise<unknown>]> = [
    ["mammoth", () => import("mammoth")],
    ["pdf-parse", () => import("pdf-parse")],
    ["exceljs", () => import("exceljs")],
    [
      "opportunity-document-ingestion",
      () => import("@/lib/opportunity-document-ingestion"),
    ],
    [
      "opportunity-import-server (auth only)",
      () => import("@/lib/opportunity-import-server").then((m) => m.requireAdminWithMicrosoft),
    ],
  ];

  for (const [label, loader] of tests) {
    try {
      await loader();
      results[label] = "OK";
    } catch (err) {
      results[label] = err instanceof Error ? `ERROR: ${err.message}` : `ERROR: ${String(err)}`;
    }
  }

  return Response.json(results);
}
