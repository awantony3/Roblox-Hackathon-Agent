import { config } from "../config.js";
import type { ToolResult } from "../types.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type FetchLike = typeof fetch;

export class MeshyClient {
  private artifacts = new Map<string, Record<string, string>>();
  constructor(private apiKey = config.meshyApiKey, private fetcher: FetchLike = fetch) {}

  private async request(path: string, init?: RequestInit) {
    if (!this.apiKey) return { success: false, error: "MESHY_API_KEY is not configured" } satisfies ToolResult;
    const response = await this.fetcher(`https://api.meshy.ai/openapi/v2${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json", ...(init?.headers || {}) }
    });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) return { success: false, error: `Meshy ${response.status}: ${String(body.message || body.error || "request failed")}`, data: body } satisfies ToolResult;
    return { success: true, data: body } satisfies ToolResult;
  }

  async createPreview(input: Record<string, unknown>): Promise<ToolResult> {
    const prompt = String(input.prompt || "").trim();
    if (!prompt) return { success: false, error: "A non-empty Meshy prompt is required" };
    if (prompt.length > 600) return { success: false, error: "Meshy prompts are limited to 600 characters" };
    const result = await this.request("/text-to-3d", {
      method: "POST",
      body: JSON.stringify({
        mode: "preview",
        prompt,
        model_type: input.modelType === "standard" ? "standard" : "lowpoly",
        ai_model: "latest",
        pose_mode: input.poseMode || "",
        moderation: true,
        target_formats: ["glb", "fbx"],
        auto_size: true,
        origin_at: "bottom"
      })
    });
    if (!result.success) return result;
    const body = result.data as { result?: string };
    return { success: true, message: "Meshy preview job created", data: { jobId: body.result, provider: "meshy", stage: "preview", requiresPolling: true } };
  }

  async getTask(input: Record<string, unknown>): Promise<ToolResult> {
    const jobId = String(input.jobId || "");
    if (!jobId) return { success: false, error: "jobId is required" };
    const result = await this.request(`/text-to-3d/${encodeURIComponent(jobId)}`);
    if (!result.success) return result;
    const task = result.data as { status?: string; progress?: number; model_urls?: Record<string, string>; thumbnail_url?: string; task_error?: { message?: string } };
    if (task.status === "FAILED" || task.status === "CANCELED") return { success: false, error: task.task_error?.message || `Meshy task ${task.status}`, data: task };
    const complete = task.status === "SUCCEEDED";
    if (complete && task.model_urls) this.artifacts.set(jobId, task.model_urls);
    return {
      success: true,
      message: complete ? "Meshy asset is ready for review and native Studio import" : `Meshy task ${task.status || "pending"}`,
      data: {
        jobId, status: task.status, progress: task.progress, modelUrls: task.model_urls, thumbnailUrl: task.thumbnail_url,
        requiresPolling: !complete, requiresUserCompletion: complete, provenance: { provider: "meshy", jobId }
      }
    };
  }

  async downloadArtifact(input: Record<string, unknown>): Promise<ToolResult> {
    const jobId = String(input.jobId || "");
    const format = String(input.format || "glb").toLowerCase();
    if (!new Set(["glb", "fbx"]).has(format)) return { success: false, error: "Only GLB and FBX downloads are allowed" };
    const rawUrl = this.artifacts.get(jobId)?.[format];
    if (!rawUrl) return { success: false, error: "No verified artifact URL is cached; poll the completed Meshy job first" };
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !(url.hostname === "meshy.ai" || url.hostname.endsWith(".meshy.ai"))) {
      return { success: false, error: "Meshy returned an untrusted artifact hostname" };
    }
    const response = await this.fetcher(url);
    if (!response.ok) return { success: false, error: `Artifact download failed with HTTP ${response.status}` };
    const declaredSize = Number(response.headers.get("content-length") || 0);
    const maxBytes = 50 * 1024 * 1024;
    if (declaredSize > maxBytes) return { success: false, error: "Artifact exceeds the 50 MB download limit" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) return { success: false, error: "Artifact exceeds the 50 MB download limit" };
    const directory = path.resolve("backend/data/assets");
    await mkdir(directory, { recursive: true });
    const safeJobId = jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(directory, `${safeJobId}.${format}`);
    await writeFile(filePath, bytes);
    return {
      success: true,
      message: "Meshy artifact downloaded; import it with Roblox Studio's native 3D Importer",
      data: { jobId, format, filePath, sizeBytes: bytes.byteLength, requiresUserCompletion: true, provenance: { provider: "meshy", jobId, sourceUrl: rawUrl } }
    };
  }
}

export const meshyClient = new MeshyClient();
