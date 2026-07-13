import type { ToolResult } from "../types.js";

export interface Evaluation {
  outcome: "passed" | "failed" | "inconclusive";
  evidence: string[];
  reason: string;
}

export class OutcomeEvaluator {
  evaluate(results: Array<{ tool: string; result: ToolResult }>, finalText: string): Evaluation {
    const failures = results.filter(({ result }) => !result.success);
    const successes = results.filter(({ result }) => result.success);
    const mutationTools = new Set(["create_instance", "set_properties", "create_script", "replace_script", "patch_script", "delete_instance", "build_from_spec", "create_tween", "create_keyframe_sequence", "apply_animation_asset", "quarantine_toolbox_asset", "approve_quarantined_asset"]);
    const verificationTools = new Set(["scan_project", "get_instance", "find_instances", "read_script", "preview_keyframe_sequence", "validate_project", "get_runtime_observation", "run_playtest"]);
    const lastMutation = results.reduce((last, item, index) => mutationTools.has(item.tool) && item.result.success ? index : last, -1);
    const verifiedAfterMutation = lastMutation < 0 || results.some((item, index) => index > lastMutation && verificationTools.has(item.tool) && item.result.success);
    const playtests = results.filter(({ tool, result }) => tool === "run_playtest" && result.success);
    const pendingUserAction = results.find(({ result }) => {
      const data = result.data as { requiresUserCompletion?: boolean } | undefined;
      return data?.requiresUserCompletion === true || (data as { requiresPolling?: boolean } | undefined)?.requiresPolling === true;
    });
    const evidence = [
      `${successes.length} tool operations succeeded`,
      ...(failures.length ? failures.map(({ tool, result }) => `${tool}: ${result.error || result.message || "failed"}`) : []),
      ...(playtests.length ? ["A playtest observation was collected"] : [])
    ];

    if (failures.length) return { outcome: "failed", evidence, reason: "One or more required tool operations failed" };
    if (pendingUserAction) return { outcome: "inconclusive", evidence: [...evidence, `${pendingUserAction.tool} requires user completion`], reason: "An external Studio workflow is waiting for the user" };
    if (!successes.length) return { outcome: "inconclusive", evidence, reason: finalText || "No observable Studio change was made" };
    if (!verifiedAfterMutation) return { outcome: "inconclusive", evidence: [...evidence, "No successful verification occurred after the last mutation"], reason: "Studio changes require a follow-up observation" };
    return { outcome: "passed", evidence, reason: "All observed tool operations succeeded" };
  }
}
