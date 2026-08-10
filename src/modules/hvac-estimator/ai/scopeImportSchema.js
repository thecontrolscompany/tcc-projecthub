import { z } from "zod";

const coercedString = z.union([
  z.string(),
  z.array(z.string()).transform((arr) => arr.join("\n")),
]).optional().default("");

const coercedStringArray = z.union([
  z.array(z.string()),
  z.string().transform((s) => (s ? [s] : [])),
]).default([]);

const SOURCE_TYPE_ALIASES = new Map([
  ["paste", "pasted_scope"],
  ["pasted", "pasted_scope"],
  ["plain_text", "pasted_scope"],
  ["plaintext", "pasted_scope"],
  ["scope_text", "pasted_scope"],
  ["text", "pasted_scope"],
  ["upload", "uploaded_scope"],
  ["uploaded", "uploaded_scope"],
  ["document", "uploaded_scope"],
  ["documents", "uploaded_scope"],
  ["file", "uploaded_scope"],
  ["files", "uploaded_scope"],
  ["drawing", "drawings"],
  ["plans", "drawings"],
  ["combined", "mixed"],
  ["both", "mixed"],
]);

const scopeSourceTypeSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;

  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return SOURCE_TYPE_ALIASES.get(normalized) || normalized;
}, z.enum(["pasted_scope", "uploaded_scope", "drawings", "mixed"]).default("pasted_scope"));

export const scopeImportAssemblySchema = z.object({
  assemblyRef: z.string().min(1),
  assemblyName: z.string().optional().default(""),
  qty: z.number().finite().positive().default(1),
  notes: coercedString,
});

export const scopeImportPointSchema = z.object({
  name: z.string().min(1),
  qty: z.number().finite().positive().default(1),
  assemblies: z.array(scopeImportAssemblySchema).default([]),
  notes: coercedString,
});

export const scopeImportSystemSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().default(""),
  qty: z.number().finite().positive().default(1),
  location: z.string().optional().default(""),
  sourceText: z.string().optional().default(""),
  points: z.array(scopeImportPointSchema).default([]),
  notes: coercedString,
});

export const scopeImportSchema = z.object({
  projectName: z.string().min(1).default(""),
  customerName: z.string().optional().default(""),
  baseScopeName: z.string().optional().default(""),
  sourceType: scopeSourceTypeSchema,
  sourceFiles: coercedStringArray,
  systems: z.array(scopeImportSystemSchema).default([]),
  assumptions: coercedStringArray,
  exclusions: coercedStringArray,
  notes: coercedStringArray,
});

export function normalizeScopeImport(value) {
  return scopeImportSchema.parse(value ?? {});
}
