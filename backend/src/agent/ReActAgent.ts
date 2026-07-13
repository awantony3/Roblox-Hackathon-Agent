import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { tools, executeTool } from "../tools/registry.js";
import { LessonStore } from "../memory/LessonStore.js";
import type { AgentState, Reflection, ToolResult } from "../types.js";
import { OutcomeEvaluator } from "./OutcomeEvaluator.js";
import { ReflexionEngine } from "./ReflexionEngine.js";
import { retryPrompt, SYSTEM_PROMPT } from "./prompts.js";
import { FailedActionGuard } from "./FailedActionGuard.js";

type TraceItem = { tool: string; input: Record<string, unknown>; result: ToolResult };

export class ReActAgent {
  private client: Anthropic;
  private evaluator = new OutcomeEvaluator();
  private lessons = new LessonStore();
  private reflexion: ReflexionEngine;

  constructor() {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.reflexion = new ReflexionEngine(this.client);
  }

  async run(sessionId: string, goal: string, onState: (state: AgentState, detail?: unknown) => void = () => {}) {
    if (!config.anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    let prompt = goal;
    let reflection: Reflection | undefined;
    const completeTrace: TraceItem[] = [];
    const failedActionGuard = new FailedActionGuard();

    for (let attempt = 0; attempt <= config.maxReflections; attempt++) {
      onState(attempt ? "acting" : "planning", { attempt: attempt + 1 });
      const attemptResult = await this.runAttempt(sessionId, prompt, onState, failedActionGuard);
      completeTrace.push(...attemptResult.trace);
      onState("evaluating", { attempt: attempt + 1 });
      const evaluation = this.evaluator.evaluate(attemptResult.trace, attemptResult.text);

      if (evaluation.outcome === "passed") {
        if (reflection) await this.lessons.append(sessionId, { goal, reflection, validated: true, createdAt: new Date().toISOString() });
        onState("complete", evaluation);
        return { success: true, message: attemptResult.text, evaluation, trace: completeTrace, attempts: attempt + 1 };
      }
      if (attempt >= config.maxReflections) {
        onState("failed", evaluation);
        return { success: false, message: attemptResult.text, evaluation, reflection, trace: completeTrace, attempts: attempt + 1 };
      }

      onState("reflecting", evaluation);
      reflection = await this.reflexion.reflect(goal, evaluation, attemptResult.trace);
      if (!reflection.retryRecommended) {
        onState("failed", reflection);
        return { success: false, message: attemptResult.text, evaluation, reflection, trace: completeTrace, attempts: attempt + 1 };
      }
      prompt = retryPrompt(goal, reflection);
    }
    throw new Error("Unreachable agent state");
  }

  private async runAttempt(sessionId: string, prompt: string, onState: (state: AgentState, detail?: unknown) => void, failedActionGuard: FailedActionGuard) {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    const trace: TraceItem[] = [];
    let finalText = "";

    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
      onState("acting", { iteration: iteration + 1 });
      const response = await this.client.messages.create({ model: config.model, max_tokens: 4096, system: SYSTEM_PROMPT, tools, messages });
      messages.push({ role: "assistant", content: response.content });
      finalText = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") || finalText;
      const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!calls.length) return { text: finalText, trace };

      onState("observing", { tools: calls.map((c) => c.name) });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        const input = call.input as Record<string, unknown>;
        const previousFailure = failedActionGuard.previousFailure(call.name, input);
        const result = previousFailure
          ? { success: false, error: `Repeated failed action blocked. Previous failure: ${previousFailure}` }
          : await executeTool(sessionId, call.name, input);
        failedActionGuard.observe(call.name, input, result);
        trace.push({ tool: call.name, input, result });
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result), is_error: !result.success });
      }
      messages.push({ role: "user", content: results });
    }
    return { text: finalText || "Iteration budget exhausted", trace: [...trace, { tool: "agent_budget", input: {}, result: { success: false, error: "Iteration budget exhausted" } }] };
  }
}
