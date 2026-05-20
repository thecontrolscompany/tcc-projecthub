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
