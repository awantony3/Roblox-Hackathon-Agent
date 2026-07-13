import { access } from "node:fs/promises";
import path from "node:path";
import { configurationStatus } from "./config.js";

export interface DoctorCheck { name: string; ok: boolean; detail: string }

async function fileCheck(name: string, filePath: string): Promise<DoctorCheck> {
  try {
    await access(filePath);
    return { name, ok: true, detail: filePath };
  } catch {
    return { name, ok: false, detail: `Missing: ${filePath}` };
  }
}

export async function runReadinessChecks(home = process.env.HOME || "") {
  const status = configurationStatus();
  const checks: DoctorCheck[] = [
    { name: "Node.js", ok: Number(process.versions.node.split(".")[0]) >= 18, detail: process.version },
    { name: "Anthropic key", ok: status.anthropicConfigured, detail: status.anthropicConfigured ? "Configured" : "Set ANTHROPIC_API_KEY in .env" },
    { name: "Meshy key", ok: status.meshyConfigured, detail: status.meshyConfigured ? "Configured" : "Optional: set MESHY_API_KEY for production 3D generation" },
    { name: "Agent API key", ok: !status.apiKeyIsDefault, detail: status.apiKeyIsDefault ? "Replace the default AGENT_API_KEY and match it in the plugin" : "Custom value configured" },
    await fileCheck("Studio plugin source", path.resolve("studio-plugin/RobloxHackathonAgent.lua")),
    await fileCheck("Installed Studio plugin", path.join(home, "Documents/Roblox/Plugins/RobloxHackathonAgent.lua"))
  ];
  return { ready: checks.filter((check) => check.name !== "Meshy key").every((check) => check.ok), checks };
}
