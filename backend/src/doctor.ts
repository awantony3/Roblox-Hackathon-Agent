import { runReadinessChecks } from "./readiness.js";

async function main() {
  const report = await runReadinessChecks();
  console.log("Roblox Hackathon Agent doctor\n");
  for (const check of report.checks) console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
  console.log(`\n${report.ready ? "READY" : "NOT READY"}`);
  process.exitCode = report.ready ? 0 : 1;
}

void main();
