import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "../config.js";
import type { Reflection } from "../types.js";
import type { Evaluation } from "./OutcomeEvaluator.js";

const ReflectionSchema = z.object({
  outcome: z.enum(["failed", "inconclusive"]),
  evidence: z.array(z.string()),
  rootCauses: z.array(z.string()),
  failedApproaches: z.array(z.string()),
  revisedStrategy: z.array(z.string()),
  retryRecommended: z.boolean()
});

export class ReflexionEngine {
  constructor(private client: Anthropic) {}

  async reflect(goal: string, evaluation: Evaluation, trace: unknown): Promise<Reflection> {
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: 1200,
      system: "Generate an evidence-grounded retry strategy. Return only JSON. Do not invent observations.",
      messages: [{ role: "user", content: JSON.stringify({ goal, evaluation, trace }) }]
    });
    const text = response.content.find((block) => block.type === "text")?.text || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return ReflectionSchema.parse(JSON.parse(match?.[0] || "{}"));
  }
}
