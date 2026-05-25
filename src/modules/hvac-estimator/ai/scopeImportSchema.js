import { z } from "zod";

const coercedString = z.union([
  z.string(),
  z.array(z.string()).transform((arr) => arr.join("\n")),
]).optional().default("");

const coercedStringArray = z.union([
  z.array(z.string()),
  z.string().transform((s) => (s ? [s] : [])),
]).default([]);

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
  sourceType: z.enum(["pasted_scope", "uploaded_scope", "drawings", "mixed"]).default("pasted_scope"),
  sourceFiles: coercedStringArray,
  systems: z.array(scopeImportSystemSchema).default([]),
  assumptions: coercedStringArray,
  exclusions: coercedStringArray,
  notes: coercedStringArray,
});

export function normalizeScopeImport(value) {
  return scopeImportSchema.parse(value ?? {});
}
