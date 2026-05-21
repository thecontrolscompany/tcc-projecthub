export const AI_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    description: "ChatGPT / OpenAI API",
    keyLabel: "API key",
    modelLabel: "Model",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Claude API",
    keyLabel: "API key",
    modelLabel: "Model",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini API",
    keyLabel: "API key",
    modelLabel: "Model",
  },
  {
    id: "xai",
    label: "xAI",
    description: "Grok API",
    keyLabel: "API key",
    modelLabel: "Model",
  },
  {
    id: "azure_openai",
    label: "Azure OpenAI",
    description: "Microsoft-hosted OpenAI endpoint",
    keyLabel: "API key",
    modelLabel: "Model deployment",
  },
];

export function getAiProvider(providerId) {
  return AI_PROVIDERS.find((provider) => provider.id === providerId) || null;
}

export function isAiProvider(providerId) {
  return Boolean(getAiProvider(providerId));
}

export const OPENAI_MODEL_OPTIONS = [
  { id: "gpt-5.5", label: "GPT-5.5" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini" },
  { id: "gpt-5.4-nano", label: "GPT-5.4 nano" },
  { id: "gpt-5-mini", label: "GPT-5 mini" },
  { id: "gpt-5", label: "GPT-5" },
];

export function getProviderModelOptions(providerId) {
  if (providerId === "openai") return OPENAI_MODEL_OPTIONS;
  if (providerId === "anthropic") {
    return [
      { id: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { id: "claude-3-7-sonnet-20250219", label: "Claude Sonnet 3.7" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude Sonnet 3.5 v2" },
      { id: "claude-3-5-haiku-20241022", label: "Claude Haiku 3.5" },
    ];
  }
  return [];
}

export function getDefaultProviderModel(providerId) {
  if (providerId === "openai") return "gpt-5.4-mini";
  if (providerId === "anthropic") return "claude-sonnet-4-20250514";
  return "";
}
