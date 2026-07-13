import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3100),
  apiKey: process.env.AGENT_API_KEY || "change-me",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  meshyApiKey: process.env.MESHY_API_KEY || "",
  model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
  maxIterations: Number(process.env.MAX_REACT_ITERATIONS || 20),
  maxReflections: Number(process.env.MAX_REFLEXION_ATTEMPTS || 2),
  studioTimeoutMs: Number(process.env.STUDIO_COMMAND_TIMEOUT_MS || 30000)
};

export function configurationStatus() {
  return {
    model: config.model,
    anthropicConfigured: Boolean(config.anthropicApiKey),
    meshyConfigured: Boolean(config.meshyApiKey),
    apiKeyIsDefault: config.apiKey === "change-me",
    maxIterations: config.maxIterations,
    maxReflections: config.maxReflections,
    studioTimeoutMs: config.studioTimeoutMs
  };
}
