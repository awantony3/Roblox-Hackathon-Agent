import type { ToolResult } from "../types.js";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export class FailedActionGuard {
  private failed = new Map<string, { reason: string; evidenceVersion: number }>();
  private evidenceVersion = 0;

  fingerprint(tool: string, input: Record<string, unknown>) {
    return `${tool}:${stable(input)}`;
  }

  previousFailure(tool: string, input: Record<string, unknown>) {
    const failure = this.failed.get(this.fingerprint(tool, input));
    return failure?.evidenceVersion === this.evidenceVersion ? failure.reason : undefined;
  }

  observe(tool: string, input: Record<string, unknown>, result: ToolResult) {
    const key = this.fingerprint(tool, input);
    if (result.success) {
      this.evidenceVersion += 1;
      this.failed.delete(key);
    } else {
      this.failed.set(key, { reason: result.error || result.message || "Tool failed", evidenceVersion: this.evidenceVersion });
    }
  }
}
