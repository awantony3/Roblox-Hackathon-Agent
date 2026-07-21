import { z } from "zod";
import { config } from "../config.js";
import type { Reflection } from "../types.js";
import type { Evaluation } from "./OutcomeEvaluator.js";
import { OpenAIClient } from "./OpenAIClient.js";

const ReflectionSchema = z.object({
  outcome: z.enum(["failed", "inconclusive"]),
  evidence: z.array(z.string()),
  rootCauses: z.array(z.string()),
  failedApproaches: z.array(z.string()),
  revisedStrategy: z.array(z.string()),
  retryRecommended: z.boolean()
});

export class ReflexionEngine {
  constructor(private client: OpenAIClient) {}

  async reflect(goal: string, evaluation: Evaluation, trace: unknown): Promise<Reflection> {
    const response = await this.client.chat.completions.create({
      model: config.model,
      max_completion_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Generate an evidence-grounded retry strategy. Return only JSON. Do not invent observations." },
        { role: "user", content: JSON.stringify({ goal, evaluation, trace }) }
      ]
    });
    const text = response.choices[0]?.message.content || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    return ReflectionSchema.parse(JSON.parse(match?.[0] || "{}"));
  }
}
