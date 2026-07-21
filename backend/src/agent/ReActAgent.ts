import type { ChatCompletionMessageFunctionToolCall, ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { config } from "../config.js";
import { tools, executeTool } from "../tools/registry.js";
import { LessonStore } from "../memory/LessonStore.js";
import type { AgentState, Reflection, ToolResult } from "../types.js";
import { OutcomeEvaluator } from "./OutcomeEvaluator.js";
import { ReflexionEngine } from "./ReflexionEngine.js";
import { retryPrompt, SYSTEM_PROMPT } from "./prompts.js";
import { FailedActionGuard } from "./FailedActionGuard.js";
import { OpenAIClient } from "./OpenAIClient.js";

type TraceItem = { tool: string; input: Record<string, unknown>; result: ToolResult };

export class ReActAgent {
  private client: OpenAIClient;
  private evaluator = new OutcomeEvaluator();
  private lessons = new LessonStore();
  private reflexion: ReflexionEngine;

  constructor() {
    this.client = new OpenAIClient();
    this.reflexion = new ReflexionEngine(this.client);
  }

  async run(sessionId: string, goal: string, onState: (state: AgentState, detail?: unknown) => void = () => {}) {
    if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");
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
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ];
    const openaiTools: ChatCompletionTool[] = tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.input_schema }
    }));
    const trace: TraceItem[] = [];
    let finalText = "";

    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
      onState("acting", { iteration: iteration + 1 });
      const response = await this.client.chat.completions.create({
        model: config.model,
        max_completion_tokens: 4096,
        messages,
        tools: openaiTools,
        tool_choice: "auto"
      });
      const message = response.choices[0]?.message;
      if (!message) throw new Error("OpenAI API returned no assistant message");
      messages.push(message);
      finalText = message.content || finalText;
      const calls = (message.tool_calls || []).filter(
        (call): call is ChatCompletionMessageFunctionToolCall => call.type === "function"
      );
      if (!calls.length) return { text: finalText, trace };

      onState("observing", { tools: calls.map((c) => c.function.name) });
      for (const call of calls) {
        let input: Record<string, unknown>;
        try { input = JSON.parse(call.function.arguments || "{}"); }
        catch { input = {}; }
        const toolName = call.function.name;
        const previousFailure = failedActionGuard.previousFailure(toolName, input);
        const result = previousFailure
          ? { success: false, error: `Repeated failed action blocked. Previous failure: ${previousFailure}` }
          : await executeTool(sessionId, toolName, input);
        failedActionGuard.observe(toolName, input, result);
        trace.push({ tool: toolName, input, result });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return { text: finalText || "Iteration budget exhausted", trace: [...trace, { tool: "agent_budget", input: {}, result: { success: false, error: "Iteration budget exhausted" } }] };
  }
}
