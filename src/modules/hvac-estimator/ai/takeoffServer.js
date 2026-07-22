import { extractProposalFromDocx, extractProposalFromPdf, extractTextFromImage } from "@/lib/opportunity-document-ingestion";
import { scopeImportSchema, normalizeScopeImport } from "./scopeImportSchema.js";

const OPENAI_DEFAULT = "https://api.openai.com";
const XAI_DEFAULT = "https://api.x.ai";
const AZURE_API_VERSION = "2024-10-21";

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildMessages(prompt) {
  return [
    {
      role: "system",
      content:
        "You are a senior HVAC estimator. Return only valid JSON matching the provided schema. " +
        "Do not wrap the JSON in code fences or add commentary.",
    },
    {
      role: "user",
      content: prompt,
    },
  ];
}

function extractJsonFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("AI provider returned an empty response.");

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("AI provider did not return valid JSON.");
  }
}

async function callOpenAiCompatible({ endpoint, apiKey, model, prompt, organizationId, provider }) {
  const baseUrl = trimTrailingSlash(endpoint) || (provider === "xai" ? XAI_DEFAULT : OPENAI_DEFAULT);
  const url = provider === "azure_openai"
    ? `${baseUrl}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${AZURE_API_VERSION}`
    : `${baseUrl}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: provider === "azure_openai"
      ? {
          "content-type": "application/json",
          "api-key": apiKey,
        }
      : {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: buildMessages(prompt),
      user: organizationId,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.error || `AI request failed (${response.status}).`);
  }

  return json?.choices?.[0]?.message?.content || "";
}

async function callAnthropic({ apiKey, model, prompt, organizationId }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      system:
        "You are a senior HVAC estimator. Return only valid JSON matching the provided schema. " +
        "Do not wrap the JSON in code fences or add commentary.",
      messages: [
        { role: "user", content: [{ type: "text", text: `${prompt}\n\nOrganization: ${organizationId}` }] },
      ],
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.error?.type || `Anthropic request failed (${response.status}).`);
  }

  const content = Array.isArray(json?.content) ? json.content : [];
  return content
    .map((entry) => (entry && entry.type === "text" ? entry.text : ""))
    .filter(Boolean)
    .join("\n");
}

const SCHEDULE_KEYWORD = /SCHEDULE/i;
const MAX_SCHEDULE_PAGES = 18;
const SCHEDULE_RENDER_CONCURRENCY = 3;
const TITLE_BLOCK_WINDOW_CHARS = 300;

const SCHEDULE_TRANSCRIBE_SYSTEM_PROMPT =
  "You are transcribing a construction drawing schedule sheet for an HVAC controls estimator. " +
  "Transcribe every row of every schedule/table on this sheet as plain text. For each table, include its title, " +
  "then list every row with its tag/mark, description or type, quantity (if shown), and any CFM/size/model data present. " +
  "Preserve tags and quantities exactly as shown. Note if the sheet is explicitly marked EXISTING equipment vs NEW equipment. " +
  "Ignore title blocks, revision stamps, firm logos, and general boilerplate notes unrelated to equipment/device counts. " +
  "Do not add commentary, explanation, or JSON — plain transcribed text only.";

let pdfjsOfficialBuildReady = null;
function ensurePdfjsOfficialBuild() {
  if (!pdfjsOfficialBuildReady) {
    pdfjsOfficialBuildReady = import("unpdf").then(({ definePDFJSModule }) =>
      definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs")),
    );
  }
  return pdfjsOfficialBuildReady;
}

// Sheet titles in this drawing set's title block land in the last handful of extracted
// lines on the page. Matching "SCHEDULE" anywhere on the page (including body notes like
// "REFER TO FIXTURE SCHEDULE") produces heavy false-positive noise that starves the page
// cap before it ever reaches the real schedule sheets — tail-only was validated against a
// real 61-page set to cleanly isolate the actual schedule sheets.
function looksLikeScheduleSheet(pageText) {
  const tail = String(pageText || "").slice(-TITLE_BLOCK_WINDOW_CHARS);
  return SCHEDULE_KEYWORD.test(tail);
}

function extractSheetTitle(pageText) {
  const lines = String(pageText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const tailLines = lines.slice(-6);
  const scheduleLine = tailLines.find((line) => SCHEDULE_KEYWORD.test(line));
  if (scheduleLine) return scheduleLine;

  // The title itself can sit further back if the sheet has trailing table/legend rows
  // after it (e.g. a schedule table with many rows followed by the revision block) —
  // search the whole page for the last line mentioning SCHEDULE before falling back.
  const anyScheduleLine = [...lines].reverse().find((line) => SCHEDULE_KEYWORD.test(line));
  return anyScheduleLine || tailLines[tailLines.length - 1] || "";
}

// Renders PDF pages that look like schedule-table sheets so they can be read via vision.
// Pure text extraction reliably loses schedule TABLE data on CAD-exported drawing sets
// (only the table titles survive) even though it works fine for narrative/notes text.
export async function extractScheduleSheetCandidates(buffer) {
  const { getDocumentProxy, extractText, renderPageAsImage } = await import("unpdf");
  await ensurePdfjsOfficialBuild();

  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(doc);
  const pages = Array.isArray(text) ? text : [text];

  const candidates = [];
  pages.forEach((pageText, index) => {
    if (looksLikeScheduleSheet(pageText)) {
      candidates.push({ pageNumber: index + 1, title: extractSheetTitle(pageText) });
    }
  });

  const capped = candidates.slice(0, MAX_SCHEDULE_PAGES);
  const skippedCount = candidates.length - capped.length;

  const rendered = [];
  for (let i = 0; i < capped.length; i += SCHEDULE_RENDER_CONCURRENCY) {
    const batch = capped.slice(i, i + SCHEDULE_RENDER_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        try {
          const imageDataUrl = await renderPageAsImage(doc, candidate.pageNumber, {
            scale: 2,
            toDataURL: true,
            canvasImport: () => import("@napi-rs/canvas"),
          });
          return { ...candidate, imageDataUrl };
        } catch (error) {
          console.error(`Unable to render page ${candidate.pageNumber} as image:`, error);
          return null;
        }
      }),
    );
    rendered.push(...batchResults.filter(Boolean));
  }

  return { pages: rendered, skippedCount };
}

async function callOpenAiVision({ endpoint, apiKey, model, provider, organizationId, imageDataUrl, pageLabel }) {
  const baseUrl = trimTrailingSlash(endpoint) || (provider === "xai" ? XAI_DEFAULT : OPENAI_DEFAULT);
  const url = provider === "azure_openai"
    ? `${baseUrl}/openai/deployments/${encodeURIComponent(model)}/chat/completions?api-version=${AZURE_API_VERSION}`
    : `${baseUrl}/v1/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: provider === "azure_openai"
      ? { "content-type": "application/json", "api-key": apiKey }
      : { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: SCHEDULE_TRANSCRIBE_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: `Sheet: ${pageLabel || "unknown"}. Transcribe all schedule tables on this drawing sheet.` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      user: organizationId,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.error || `AI vision request failed (${response.status}).`);
  }
  return json?.choices?.[0]?.message?.content || "";
}

async function callAnthropicVision({ apiKey, model, imageDataUrl, pageLabel }) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) throw new Error("Invalid rendered page image data.");
  const [, mediaType, base64Data] = match;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: 0,
      system: SCHEDULE_TRANSCRIBE_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Sheet: ${pageLabel || "unknown"}. Transcribe all schedule tables on this drawing sheet.` },
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
          ],
        },
      ],
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.error?.type || `Anthropic vision request failed (${response.status}).`);
  }
  const content = Array.isArray(json?.content) ? json.content : [];
  return content
    .map((entry) => (entry && entry.type === "text" ? entry.text : ""))
    .filter(Boolean)
    .join("\n");
}

async function callGeminiVision({ apiKey, model, imageDataUrl, pageLabel }) {
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(imageDataUrl);
  if (!match) throw new Error("Invalid rendered page image data.");
  const [, mimeType, base64Data] = match;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${SCHEDULE_TRANSCRIBE_SYSTEM_PROMPT}\n\nSheet: ${pageLabel || "unknown"}. Transcribe all schedule tables on this drawing sheet.` },
            { inline_data: { mime_type: mimeType, data: base64Data } },
          ],
        },
      ],
      generationConfig: { temperature: 0 },
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.error?.status || `Gemini vision request failed (${response.status}).`);
  }
  return (json?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n");
}

async function transcribeScheduleImage({ provider, apiKey, model, endpoint, organizationId, imageDataUrl, pageLabel }) {
  if (provider === "anthropic") {
    return callAnthropicVision({ apiKey, model, imageDataUrl, pageLabel });
  }
  if (provider === "gemini") {
    return callGeminiVision({ apiKey, model, imageDataUrl, pageLabel });
  }
  if (provider === "openai" || provider === "xai" || provider === "azure_openai") {
    return callOpenAiVision({ endpoint, apiKey, model, provider, organizationId, imageDataUrl, pageLabel });
  }
  throw new Error(`Unsupported provider for vision transcription: ${provider}`);
}

// Transcribes each rendered schedule-sheet image via the same AI connection already
// selected for the takeoff. Individual page failures are skipped, not fatal — the rest
// of the pipeline still benefits from whichever pages succeeded.
export async function transcribeScheduleImages({ provider, apiKey, model, endpoint, organizationId, pages }) {
  const results = [];
  for (let i = 0; i < pages.length; i += SCHEDULE_RENDER_CONCURRENCY) {
    const batch = pages.slice(i, i + SCHEDULE_RENDER_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (page) => {
        try {
          const text = await transcribeScheduleImage({
            provider,
            apiKey,
            model,
            endpoint,
            organizationId,
            imageDataUrl: page.imageDataUrl,
            pageLabel: page.title || `Page ${page.pageNumber}`,
          });
          return { pageNumber: page.pageNumber, title: page.title, text };
        } catch (error) {
          console.error(`Vision transcription failed for page ${page.pageNumber}:`, error);
          return null;
        }
      }),
    );
    results.push(...batchResults.filter(Boolean));
  }
  return results;
}

async function callGemini({ apiKey, model, prompt, organizationId }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are a senior HVAC estimator. Return only valid JSON matching the provided schema. " +
                "Do not wrap the JSON in code fences or add commentary.\n\n" +
                `Organization: ${organizationId}\n\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
      },
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error?.message || json?.error?.status || `Gemini request failed (${response.status}).`);
  }

  return (json?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => part?.text || "")
    .filter(Boolean)
    .join("\n");
}

export async function extractUploadedFileText(file) {
  const name = String(file?.name || "");
  const type = String(file?.type || "");
  const buffer = Buffer.from(await file.arrayBuffer());

  if (type.startsWith("text/") || /^(text|json|xml|csv|markdown)/i.test(type)) {
    return buffer.toString("utf8");
  }

  if (/\.docx$/i.test(name) || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const extracted = await extractProposalFromDocx(buffer);
    return extracted.extractedText || "";
  }

  if (/\.pdf$/i.test(name) || type === "application/pdf") {
    const extracted = await extractProposalFromPdf(buffer);
    return extracted.extractedText || "";
  }

  if (/^image\//i.test(type) || /\.(png|jpe?g|gif|bmp|webp|tif|tiff)$/i.test(name)) {
    return await extractTextFromImage(buffer);
  }

  if (/\.txt$/i.test(name) || /\.md$/i.test(name)) {
    return buffer.toString("utf8");
  }

  return "";
}

export async function buildScopeTakeoffPrompt({
  estimate,
  scopeText,
  uploadedFiles,
}) {
  const fileBlock = uploadedFiles.length
    ? uploadedFiles.map((entry) => `FILE: ${entry.name}\n${entry.text || "[No extractable text was available for this file.]"}\n`).join("\n")
    : "";

  const schemaExample = {
    projectName: "KAFB Jones and Arnold Hall",
    customerName: "Johnson Controls",
    baseScopeName: "Jones Hall",
    sourceType: "mixed",
    sourceFiles: ["scope-of-work.pdf"],
    systems: [
      {
        name: "Air Handling Unit (AHU-1)",
        type: "equipment",
        qty: 1,
        location: "Mechanical Room",
        sourceText: "Describe the source scope language here.",
        points: [
          {
            name: "AHU Control Panel",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-pxc-panel", assemblyName: "Enclosure (Average) Controller/ Xfmr", qty: 1, notes: "PXC control panel furnished by controls contractor" }],
            notes: "",
          },
          {
            name: "OA Duct Temp",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-oa-duct-temp", assemblyName: "Duct Temp", qty: 1, notes: "" }],
            notes: "",
          },
          {
            name: "Preheat Valve",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-preheat-valve", assemblyName: "ValveActuator", qty: 1, notes: "PICV modulating" }],
            notes: "",
          },
          {
            name: "OA Air Flow (AFMS)",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-afms", assemblyName: "Air Flow Stn", qty: 1, notes: "Air flow measurement station" }],
            notes: "",
          },
          {
            name: "RA Temp/Humidity",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-ra-temp-rh", assemblyName: "HumTemp Duct", qty: 1, notes: "RA duct temp and humidity sensor" }],
            notes: "",
          },
          {
            name: "Supply Fan VFD",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-sf-vfd", assemblyName: "VSD Start/Stop/Status/Speed", qty: 1, notes: "Via BACnet MSTP" }],
            notes: "",
          },
          {
            name: "Filter DP",
            qty: 1,
            assemblies: [{ assemblyRef: "ahu-filter-dp", assemblyName: "DP Transducer Air", qty: 1, notes: "Pre/final filter differential pressure" }],
            notes: "",
          },
          {
            name: "Smoke Damper Interlock",
            qty: 2,
            assemblies: [{ assemblyRef: "ahu-smoke-damper-interlock", assemblyName: "Hardwire Interlock", qty: 2, notes: "OA and RA smoke damper interlock with SA fan VFD" }],
            notes: "",
          },
        ],
        notes: "",
      },
      {
        name: "Chilled Water System",
        type: "plant",
        qty: 1,
        location: "Mechanical Room",
        sourceText: "Describe the source scope language here.",
        points: [
          {
            name: "CHWP VFD Integration",
            qty: 2,
            assemblies: [{ assemblyRef: "chw-pump-vfd", assemblyName: "VSD Start/Stop/Status/Speed", qty: 2, notes: "Via BACnet MSTP" }],
            notes: "",
          },
          {
            name: "Campus CHWS/CHWR DP",
            qty: 1,
            assemblies: [{ assemblyRef: "chw-campus-dp", assemblyName: "Diff Pressure Water", qty: 1, notes: "" }],
            notes: "",
          },
          {
            name: "CHWS/CHWR Immersion Temp",
            qty: 2,
            assemblies: [{ assemblyRef: "chw-immersion-temp", assemblyName: "WellTmpSensor", qty: 2, notes: "Supply and return immersion sensors" }],
            notes: "",
          },
        ],
        notes: "",
      },
    ],
    assumptions: ["Assume BACnet cards for third-party equipment are provided by others."],
    exclusions: ["CO2 sensors excluded per drawings.", "Occupancy sensors provided by others."],
    notes: ["Fire/smoke damper transformers included per Inclusions section."],
  };

  return [
    "Use the source scope text and any uploaded file text to infer HVAC systems, points, and assemblies.",
    "Always use the exact catalog assembly names from the list below — do not invent names or use sentence-length descriptions.",
    "",
    "CATALOG ASSEMBLY NAMES — use these exact strings for assemblyName:",
    "  Temperature sensors:",
    "    Duct Temp                    — single-point duct temp sensor: OA and SA duct, leaving-air (preheat/cooling/reheat). NOT for VAV/FCU discharge air.",
    "    AvgTempSensor                — averaging temp element: mixed-air and return-air duct on AHUs, where stratification is expected.",
    "    Discharge Air Temp           — VAV or FCU discharge/leaving air temperature sensor after heating coil",
    "    WellTmpSensor                — immersion/well temp sensor in pipe (HWR, CHWR, supply, return)",
    "    HumTemp Duct                 — combined duct temp + humidity sensor",
    "    Temp Sensor Room BACnet      — wall/space-mounted room temperature sensor",
    "    17' Low Limit                — freezestat / low-limit thermostat on an AHU or RTU coil",
    "    OA Temp                      — outside-air temp sensor mounted outdoors: RTU outside air, and ambient/OA sensing for plant equipment (cooling towers, chillers, boilers)",
    "    RTU MA-T s                   — RTU mixed-air temp sensor",
    "  Pressure sensors:",
    "    DP Transducer Air            — air differential pressure transducer (static, filter DP, duct DP)",
    "    DP Switch Air (Filter)       — simple filter DP switch (binary)",
    "    Diff Pressure Water          — water differential pressure sensor (CHWS, HWS, building/campus loop)",
    "  Airflow:",
    "    Air Flow Stn                 — air flow measurement station / AFMS",
    "  Valves:",
    "    Reheat Valve                 — VAV or FCU proportional hot water reheat coil valve actuator",
    "    ValveActuator                — all other modulating valves: AHU coils, bypass, PICV, CHW, plant-level HW (NOT VAV/FCU reheat)",
    "    Clg Twr Byp Vlv +Rigid+Wire+Tm — cooling tower / condenser water bypass valve, tower-specific assembly",
    "  Dampers:",
    "    Dmpr Actuator                — motorized damper actuator furnished by controls contractor",
    "    Hardwire Interlock           — hardwired interlock relay between two devices (smoke damper/VFD, EF/AHU)",
    "  Fans / VFDs:",
    "    VSD Start/Stop/Status/Speed  — VFD or VSD integration with start/stop, status, speed (via BACnet or hardwired)",
    "    EF Start/Stop/Status in EMT  — exhaust fan start/stop/status wired in EMT conduit",
    "  Staged heating / cooling:",
    "    Htg 2 Stg/Rly                — 2-stage electric heat via relays",
    "    Htg 3 Stg/Rly                — 3-stage electric heat via relays",
    "    Zone Htg 3 StgRly+Flex       — zone-level 3-stage electric heat, flex-connected",
    "    DX 2 Stg/Rly                 — 2-stage DX cooling via relays",
    "    DX 4 Stg/Sol                 — 4-stage DX cooling via solid-state control",
    "  Pumps:",
    "    Pump Start/Stop/Status       — pump start/stop/status (hardwired, no VFD)",
    "  Plant equipment:",
    "    Chiller Outside +Rigid+FS    — chiller start/stop/status/alarm, outdoor rigid conduit",
    "    Chiller Amps                 — chiller amp monitoring via CT",
    "    ISO Valve+Wire               — chilled/hot water isolation valve with end switch",
    "    Boiler Burner Cntl           — boiler burner control",
    "    Boiler Stm Press+Cbl         — steam boiler pressure sensor and cable",
    "  Relays:",
    "    General Relay                — output relay for control or status where no better assembly applies",
    "    Zone Current Switch+Relay    — current switch with relay for proving fan/motor operation (pump status, fan proof)",
    "  Third-party device monitoring (BACnet MSTP or status-only):",
    "    Control/Status               — any third-party device monitored via BACnet MSTP or DI status point",
    "                                   (use for: DHW systems, gas detection, electric meters, water meters,",
    "                                    air curtains, lift stations, generators, Belimo Energy Valves,",
    "                                    circulation pumps via BACnet, condensing units, etc.)",
    "  Controllers / enclosures:",
    "    VAV Controller               — VAV/VMA/CVM DDC controller package (includes damper actuator when factory-installed)",
    "    FCU Controller               — fan coil unit DDC controller (factory-installed)",
    "    Enclosure (Average) Controller/ Xfmr — AHU or system-level DDC panel with transformer",
    "    Enclosure (Small) Controller/ Xfmr   — small zone-level controller enclosure (NOT for VAV or FCU)",
    "    Enclosure (Large) Controller/ Xfmr   — large DDC panel for complex multi-system applications",
    "  Transformers:",
    "    General XMFR (Panel Mtd)     — panel-mounted transformer (including fire/smoke damper transformers)",
    "  Misc:",
    "    Home Run Conduit             — home run conduit run back to control panel",
    "",
    "IMPORTANT RULES:",
    "- NEVER use General Relay for a damper actuator — use Dmpr Actuator instead.",
    "- NEVER use General Relay for fan start/stop/status — use EF Start/Stop/Status in EMT or VSD Start/Stop/Status/Speed.",
    "- NEVER use Insertion Flow Meter for an AFMS or duct air flow station — use Air Flow Stn.",
    "- NEVER use Temp Sensor Room BACnet for a duct-mounted sensor — use Duct Temp, Discharge Air Temp, or HumTemp Duct.",
    "- NEVER use BACnet Integration as an assembly name — use Control/Status or VSD Start/Stop/Status/Speed instead.",
    "- NEVER use Enclosure (Small) Controller/ Xfmr for a VAV box — use VAV Controller.",
    "- NEVER use Enclosure (Small) Controller/ Xfmr for an FCU — use FCU Controller.",
    "- NEVER use ValveActuator for a VAV or FCU heating coil — use Reheat Valve.",
    "- NEVER use ValveActuator for a cooling tower or condenser water bypass valve — use Clg Twr Byp Vlv +Rigid+Wire+Tm.",
    "- NEVER use Duct Temp for a VAV or FCU discharge air sensor — use Discharge Air Temp.",
    "- Use AvgTempSensor for AHU mixed-air and return-air duct temps; use Duct Temp for OA and SA duct temps.",
    "- Use 17' Low Limit for an AHU or RTU freezestat / low-limit thermostat.",
    "- Use OA Temp and RTU MA-T s for RTU outside-air and mixed-air temperature sensors.",
    "- NEVER use Duct Temp for an outdoor-mounted or ambient temperature sensor — use OA Temp. Duct Temp is only for a sensor inserted into ductwork, so it NEVER applies to cooling towers, chillers, boilers, or pumping systems, which have no ductwork.",
    "- NEVER use General Relay for staged electric heat or staged DX cooling — use the Htg / DX staging assemblies.",
    "- NEVER use Control/Status for a chiller or boiler with real I/O points — use the Chiller or Boiler assemblies.",
    "- DO NOT generate assemblies for 'Provided by Others' (PBO) field devices — if a device is explicitly stated as PBO, skip it or note it in assumptions.",
    "- For VAV controller packages: the damper actuator is INCLUDED in the VAV Controller — do NOT list it as a separate assembly.",
    "- Always include a control panel assembly (Enclosure (Average) Controller/ Xfmr) for each AHU or system-level panel explicitly mentioned.",
    "- Always include transformers (General XMFR (Panel Mtd)) for fire/smoke dampers when listed in an Inclusions section.",
    "- Read the Inclusions and Exclusions sections carefully and capture all included scope items as assemblies.",
    "- When a system appears multiple times (e.g. AHU-1 and AHU-2), combine them into one system with qty > 1 ONLY if they are identical. If they differ in points, create separate systems.",
    "- ALWAYS include a 'Network / BAS Backbone' system as the last system, even if it is not described in the scope. Use it to capture backbone wiring, conduit, BAS front-end extensions, and network infrastructure. If nothing is mentioned, leave its points empty and add a note that it requires review.",
    "- notes field must always be a plain string, never an array.",
    "ASSEMBLY COUNT RULES — only include assemblies that are EXPLICITLY stated in the scope:",
    "- Simple exhaust fans: use exactly 1 assembly (EF Start/Stop/Status in EMT). Do NOT add relays, current switches, or interlocks unless the scope explicitly requires them.",
    "- Unit heaters: use exactly 1 assembly (Control/Status) unless the scope explicitly calls for start/stop/status hardwired integration.",
    "- Circulation pumps, sump pumps, and domestic hot water systems with no VFD: use exactly 1 assembly (Control/Status).",
    "- Electric meters, water meters, gas meters, air curtains, generators, gas detection, lighting controls: use exactly 1 assembly (Control/Status) each.",
    "- VAV boxes: use VAV Controller as the first assembly. Add Reheat Valve if hot-water reheat is present. Add Discharge Air Temp if explicitly stated. The damper actuator is built into the VAV Controller — do not add it separately.",
    "- Fan coil units: use FCU Controller + Reheat Valve (heating coil) + ValveActuator (cooling coil) as appropriate for pipe count. Add no others unless explicitly stated.",
    "- DO NOT infer sensors or assemblies from equipment type alone — only add what the scope document explicitly describes.",
    "DEVICE-BY-OTHERS RULES — scan every sentence of the scope for ownership language before generating assemblies:",
    "- If the scope states a device is furnished by a named party AND that same party is also responsible for installing and wiring it: include ZERO assemblies for it. It is not TCC work.",
    "  Applies to: discharge air temp sensors, room/space temp sensors, AFMS units, and valve actuators when the scope explicitly says another party installs them.",
    "- If a device is furnished by the prime contractor but TCC physically mounts and wires it to the BAS: include ONE Control/Status assembly as the install-labor proxy — do NOT use the full supply+install assembly.",
    "- If a device is furnished by the prime but the mechanical contractor installs it (explicitly stated): include ZERO assemblies. TCC's only work is the BACnet cable run, which is already covered by VSD Start/Stop/Status/Speed or Control/Status.",
    "- VFD/VSD BACnet integration (VSD Start/Stop/Status/Speed): always include regardless of who furnishes the drive — TCC always runs the BACnet cable.",
    "HOME-RUN CONDUIT RULE:",
    "- Count the total number of systems you are outputting (not counting the Network/BAS Backbone itself).",
    "- In the Network / BAS Backbone system, add a point named 'Home Run Conduit Allowance' with assemblyName 'Home Run Conduit' and qty equal to the total system count (minimum 10). This represents EMT conduit runs from field devices back to panels.",
    "- In the same system, add a point named 'Inter-Panel Cabling' with assemblyName 'Control/Status' and qty equal to the number of systems that have their own dedicated control panel (AHUs, large FCUs, plant systems).",
    "The baseScopeName should be the actual project scope label from the proposal, not a generic placeholder like 'Scope'.",
    "Return ONLY a single JSON object that matches this schema exactly:",
    JSON.stringify(schemaExample, null, 2),
    "",
    "Rules:",
    "- Include one system object for each HVAC system or equipment group in the scope.",
    "- Each system should include the point-level items that make up the equipment.",
    "- Each point should include the assemblies needed to build that point.",
    "- STRICT: only include assemblies that are explicitly mentioned in the scope text. Do not infer standard sensors if they are not explicitly listed.",
    "- Keep assemblyRef stable, human-readable, and slug-like when exact estimator assembly IDs are unknown.",
    "- Use assemblyName for the catalog-style label and assemblyRef for the stable source-facing identifier.",
    "",
    `Estimate context: ${JSON.stringify({
      projectName: estimate?.name || "",
      customerName: estimate?.body?.customer || estimate?.customer || "",
      baseScopeName: estimate?.body?.settings?.baseScopeName || estimate?.settings?.baseScopeName || "",
      organizationId: estimate?.organizationId || estimate?.organization_id || "",
      proposalDetails: {
        proposalScopeMode: estimate?.body?.settings?.proposalScopeMode || estimate?.settings?.proposalScopeMode || "",
        useCustomerScope: Boolean(estimate?.body?.settings?.useCustomerScope ?? estimate?.settings?.useCustomerScope),
        customerScope: estimate?.body?.settings?.customerScope || estimate?.settings?.customerScope || "",
        drawingBasis: estimate?.body?.settings?.drawingBasis || estimate?.settings?.drawingBasis || "",
        estimateDate: estimate?.body?.settings?.estimateDate || estimate?.settings?.estimateDate || "",
        customerContact: estimate?.body?.settings?.customerContact || estimate?.settings?.customerContact || "",
      },
    })}`,
    "",
    "Source scope text:",
    scopeText || "[No pasted scope text provided.]",
    "",
    fileBlock ? "Uploaded file text:" : "",
    fileBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function runScopeTakeoffWithProvider({
  provider,
  apiKey,
  model,
  endpoint,
  organizationId,
  prompt,
}) {
  let rawText = "";

  if (provider === "anthropic") {
    rawText = await callAnthropic({ apiKey, model, prompt, organizationId });
  } else if (provider === "gemini") {
    rawText = await callGemini({ apiKey, model, prompt, organizationId });
  } else if (provider === "openai" || provider === "xai" || provider === "azure_openai") {
    rawText = await callOpenAiCompatible({ endpoint, apiKey, model, prompt, organizationId, provider });
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const parsed = extractJsonFromText(rawText);
  const validated = normalizeScopeImport(scopeImportSchema.parse(parsed));
  return { rawText, validated };
}
