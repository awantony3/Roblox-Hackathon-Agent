import OpenAI from "openai";
import { config } from "../config.js";

export class OpenAIClient extends OpenAI {
  constructor() {
    super({ apiKey: config.openaiApiKey });
  }
}
