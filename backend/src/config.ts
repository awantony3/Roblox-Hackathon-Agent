import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3100),
  apiKey: process.env.AGENT_API_KEY || "change-me",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  meshyApiKey: process.env.MESHY_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-5.6",
  maxIterations: Number(process.env.MAX_REACT_ITERATIONS || 20),
  maxReflections: Number(process.env.MAX_REFLEXION_ATTEMPTS || 2),
  studioTimeoutMs: Number(process.env.STUDIO_COMMAND_TIMEOUT_MS || 30000)
};

export function configurationStatus() {
  return {
    model: config.model,
    openaiConfigured: Boolean(config.openaiApiKey),
    meshyConfigured: Boolean(config.meshyApiKey),
    apiKeyIsDefault: config.apiKey === "change-me",
    maxIterations: config.maxIterations,
    maxReflections: config.maxReflections,
    studioTimeoutMs: config.studioTimeoutMs
  };
}
