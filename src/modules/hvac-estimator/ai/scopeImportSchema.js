import { z } from "zod";

export const scopeImportAssemblySchema = z.object({
  assemblyRef: z.string().min(1),
  assemblyName: z.string().optional().default(""),
  qty: z.number().finite().positive().default(1),
  notes: z.string().optional().default(""),
});

export const scopeImportPointSchema = z.object({
  name: z.string().min(1),
  qty: z.number().finite().positive().default(1),
  assemblies: z.array(scopeImportAssemblySchema).default([]),
  notes: z.string().optional().default(""),
});

export const scopeImportSystemSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().default(""),
  qty: z.number().finite().positive().default(1),
  location: z.string().optional().default(""),
  sourceText: z.string().optional().default(""),
  points: z.array(scopeImportPointSchema).default([]),
  notes: z.string().optional().default(""),
});

export const scopeImportSchema = z.object({
  projectName: z.string().min(1).default(""),
  customerName: z.string().optional().default(""),
  baseScopeName: z.string().optional().default(""),
  sourceType: z.enum(["pasted_scope", "uploaded_scope", "drawings", "mixed"]).default("pasted_scope"),
  sourceFiles: z.array(z.string()).default([]),
  systems: z.array(scopeImportSystemSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  notes: z.array(z.string()).default([]),
});

export function normalizeScopeImport(value) {
  return scopeImportSchema.parse(value ?? {});
}
