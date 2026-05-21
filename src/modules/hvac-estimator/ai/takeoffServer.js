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
        name: "Chilled Water System (CHWS)",
        type: "plant",
        qty: 1,
        location: "Mechanical Room",
        sourceText: "Describe the source scope language here.",
        points: [
          {
            name: "Chiller enable relay",
            qty: 1,
            assemblies: [
              {
                assemblyRef: "CHWS-RELAY-001",
                assemblyName: "Chiller Enable Relay Assembly",
                qty: 1,
                notes: "Include controller input and wiring",
              },
            ],
            notes: "Optional notes",
          },
        ],
        notes: "",
      },
    ],
    assumptions: ["Assume BACnet integration is provided by others."],
    exclusions: ["Controls devices furnished by others are excluded unless listed."],
    notes: ["This example is illustrative only."],
  };

  return [
    "Use the source scope text and any uploaded file text to infer HVAC systems, points, and assemblies.",
    "Return ONLY a single JSON object that matches this schema exactly:",
    JSON.stringify(schemaExample, null, 2),
    "",
    "Rules:",
    "- Include one system object for each HVAC system or equipment group in the scope.",
    "- Each system should include the point-level items that make up the equipment.",
    "- Each point should include the assemblies needed to build that point.",
    "- Use conservative assumptions. If something is unclear, omit it or add an assumption note.",
    "- Keep assemblyRef stable and human-readable when exact estimator assembly IDs are unknown.",
    "",
    `Estimate context: ${JSON.stringify({
      projectName: estimate?.name || "",
      customerName: estimate?.body?.customer || estimate?.customer || "",
      baseScopeName: estimate?.body?.settings?.baseScopeName || estimate?.settings?.baseScopeName || "",
      organizationId: estimate?.organizationId || estimate?.organization_id || "",
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
