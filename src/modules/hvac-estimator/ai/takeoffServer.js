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
      temperature: 0.1,
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
      temperature: 0.1,
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
        temperature: 0.1,
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
    "    Duct Temp                    — any duct-mounted temp sensor (OA, MA, SA, RA, discharge, leaving air)",
    "    WellTmpSensor                — immersion/well temp sensor in pipe (HWR, CHWR, supply, return)",
    "    HumTemp Duct                 — combined duct temp + humidity sensor",
    "    Temp Sensor Room BACnet      — wall/space-mounted room temperature sensor",
    "  Pressure sensors:",
    "    DP Transducer Air            — air differential pressure transducer (static, filter DP, duct DP)",
    "    DP Switch Air (Filter)       — simple filter DP switch (binary)",
    "    Diff Pressure Water          — water differential pressure sensor (CHWS, HWS, building/campus loop)",
    "  Airflow:",
    "    Air Flow Stn                 — air flow measurement station / AFMS",
    "  Valves:",
    "    ValveActuator                — 2-way or 3-way modulating valve with actuator (PICV, HW, CHW, reheat)",
    "  Dampers:",
    "    Dmpr Actuator                — motorized damper actuator furnished by controls contractor",
    "    Hardwire Interlock           — hardwired interlock relay between two devices (smoke damper/VFD, EF/AHU)",
    "  Fans / VFDs:",
    "    VSD Start/Stop/Status/Speed  — VFD or VSD integration with start/stop, status, speed (via BACnet or hardwired)",
    "    EF Start/Stop/Status in EMT  — exhaust fan start/stop/status wired in EMT conduit",
    "  Pumps:",
    "    Pump Start/Stop/Status       — pump start/stop/status (hardwired, no VFD)",
    "  Relays:",
    "    General Relay                — output relay for control or status where no better assembly applies",
    "    Relay                        — basic relay (use General Relay unless specifically a zone relay)",
    "  Third-party device monitoring (BACnet MSTP or status-only):",
    "    Control/Status               — any third-party device monitored via BACnet MSTP or DI status point",
    "                                   (use for: DHW systems, gas detection, electric meters, water meters,",
    "                                    air curtains, lift stations, generators, Belimo Energy Valves,",
    "                                    circulation pumps via BACnet, condensing units, etc.)",
    "  Controllers / enclosures:",
    "    Enclosure (Small) Controller/ Xfmr  — small DDC panel with transformer (FCU/VAV DXR, zone controllers)",
    "    Enclosure (Average) Controller/ Xfmr — medium DDC panel with transformer (AHU, system-level PXC panels)",
    "  Transformers:",
    "    General XMFR (Panel Mtd)     — panel-mounted transformer (including fire/smoke damper transformers)",
    "  Misc:",
    "    Home Run Conduit             — home run conduit run back to control panel",
    "    Zone Current Switch+Relay    — current switch with relay for proving fan/motor operation",
    "",
    "IMPORTANT RULES:",
    "- NEVER use General Relay for a damper actuator — use Dmpr Actuator instead.",
    "- NEVER use General Relay for fan start/stop/status — use EF Start/Stop/Status in EMT or VSD Start/Stop/Status/Speed.",
    "- NEVER use Insertion Flow Meter for an AFMS or duct air flow station — use Air Flow Stn.",
    "- NEVER use Temp Sensor Room BACnet for a duct-mounted sensor — use Duct Temp or HumTemp Duct.",
    "- NEVER use BACnet Integration as an assembly name — use Control/Status or VSD Start/Stop/Status/Speed instead.",
    "- DO NOT generate assemblies for 'Provided by Others' (PBO) field devices — if a device is explicitly stated as PBO, skip it or note it in assumptions.",
    "- For VAV DXR controller packages: the damper actuator is INCLUDED in the DXR controller — do NOT list it as a separate assembly.",
    "- Always include a control panel assembly (Enclosure (Average) Controller/ Xfmr) for each AHU or system-level panel explicitly mentioned.",
    "- Always include transformers (General XMFR (Panel Mtd)) for fire/smoke dampers when listed in an Inclusions section.",
    "- Read the Inclusions and Exclusions sections carefully and capture all included scope items as assemblies.",
    "- When a system appears multiple times (e.g. AHU-1 and AHU-2), combine them into one system with qty > 1 ONLY if they are identical. If they differ in points, create separate systems.",
    "- ALWAYS include a 'Network / BAS Backbone' system as the last system, even if it is not described in the scope. Use it to capture backbone wiring, conduit, BAS front-end extensions, and network infrastructure. If nothing is mentioned, leave its points empty and add a note that it requires review.",
    "- notes field must always be a plain string, never an array.",
    "The baseScopeName should be the actual project scope label from the proposal, not a generic placeholder like 'Scope'.",
    "Return ONLY a single JSON object that matches this schema exactly:",
    JSON.stringify(schemaExample, null, 2),
    "",
    "Rules:",
    "- Include one system object for each HVAC system or equipment group in the scope.",
    "- Each system should include the point-level items that make up the equipment.",
    "- Each point should include the assemblies needed to build that point.",
    "- Use conservative assumptions. If something is unclear, omit it or add an assumption note.",
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
