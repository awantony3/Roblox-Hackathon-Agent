import { studioBridge } from "../studio/StudioBridge.js";
import type { ToolResult } from "../types.js";

export interface AgentTool {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}
import { meshyClient } from "../assets/MeshyClient.js";

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object" as const, properties, required });
const str = { type: "string" };
const bool = { type: "boolean" };
const num = { type: "number" };

export const tools: AgentTool[] = [
  { name: "scan_project", description: "See the current Roblox hierarchy, selection, place metadata, and recent output.", input_schema: objectSchema({}) },
  { name: "get_instance", description: "Inspect an instance and its properties by full Roblox path.", input_schema: objectSchema({ path: str }, ["path"]) },
  { name: "find_instances", description: "Search descendants by name fragment and optional Roblox class name.", input_schema: objectSchema({ root: str, nameContains: str, className: str, limit: num }) },
  { name: "read_script", description: "Read the complete source of a Script, LocalScript, or ModuleScript by path.", input_schema: objectSchema({ path: str }, ["path"]) },
  { name: "capture_viewport", description: "Capture the current Studio viewport for visual inspection.", input_schema: objectSchema({ label: str }) },
  { name: "create_instance", description: "Create a Roblox instance and set properties atomically. Encode Vector3 as {x,y,z}, Color3 as {r,g,b} using 0-1 or 0-255 values, CFrame as {position:{x,y,z}}, and enums as strings such as 'Neon'.", input_schema: objectSchema({ className: str, name: str, parent: str, properties: { type: "object" } }, ["className", "name", "parent"]) },
  { name: "set_properties", description: "Alter properties on an existing instance. Encode Vector3 as {x,y,z}, Color3 as {r,g,b}, CFrame as {position:{x,y,z}}, and enum values as strings.", input_schema: objectSchema({ path: str, properties: { type: "object" } }, ["path", "properties"]) },
  { name: "create_script", description: "Create a Script, LocalScript, or ModuleScript with Luau source.", input_schema: objectSchema({ className: { type: "string", enum: ["Script", "LocalScript", "ModuleScript"] }, name: str, parent: str, source: str }, ["className", "name", "parent", "source"]) },
  { name: "replace_script", description: "Replace an existing script source. This is destructive and requires user confirmation in Studio.", input_schema: objectSchema({ path: str, source: str }, ["path", "source"]) },
  { name: "patch_script", description: "Replace an exact text fragment in an existing script. Requires destructive-change confirmation and fails if the expected text is absent.", input_schema: objectSchema({ path: str, search: str, replacement: str, replaceAll: bool }, ["path", "search", "replacement"]) },
  { name: "delete_instance", description: "Delete an instance. This is destructive and requires user confirmation in Studio.", input_schema: objectSchema({ path: str }, ["path"]) },
  { name: "build_from_spec", description: "Build many instances from a declarative spec in one Studio transaction.", input_schema: objectSchema({ name: str, instances: { type: "array", items: { type: "object" } } }, ["name", "instances"]) },
  { name: "create_tween", description: "Create a server Script that animates a target with TweenService. Goals use the same Roblox datatype encoding as set_properties.", input_schema: objectSchema({ path: str, scriptParent: str, scriptName: str, duration: num, goals: { type: "object" }, easingStyle: str, easingDirection: str, looping: bool, reverses: bool }, ["path", "duration", "goals"]) },
  { name: "create_keyframe_sequence", description: "Create a Roblox KeyframeSequence from typed keyframes and nested poses. Pose cframe uses {position:{x,y,z},rotation:{x,y,z}} with rotation in degrees.", input_schema: objectSchema({ parent: str, name: str, loop: bool, priority: str, keyframes: { type: "array", items: { type: "object" } } }, ["parent", "name", "keyframes"]) },
  { name: "preview_keyframe_sequence", description: "Register a KeyframeSequence with a temporary Studio-only active:// ID and optionally play it on a rig Animator.", input_schema: objectSchema({ keyframeSequencePath: str, rigPath: str, looped: bool, speed: num }, ["keyframeSequencePath"]) },
  { name: "apply_animation_asset", description: "Configure a rig to play an existing uploaded Roblox animation asset.", input_schema: objectSchema({ rigPath: str, animationId: str, looped: bool }, ["rigPath", "animationId"]) },
  { name: "upload_animation_asset", description: "Open Roblox Studio's native authenticated upload window for a KeyframeSequence. Requires destructive/external-action confirmation and user completion; Roblox Open Cloud does not currently list Animation as a supported upload type.", input_schema: objectSchema({ name: str, keyframeSequencePath: str, description: str }, ["name", "keyframeSequencePath"]) },
  { name: "search_toolbox", description: "Search Roblox Creator Store free models by keyword without inserting them.", input_schema: objectSchema({ query: str, page: num }, ["query"]) },
  { name: "quarantine_toolbox_asset", description: "Load a Roblox asset into ServerStorage.AgentAssetQuarantine, keep it sandboxed, and scan scripts before insertion.", input_schema: objectSchema({ assetId: num }, ["assetId"]) },
  { name: "approve_quarantined_asset", description: "Move a reviewed quarantined asset into the requested parent. Scripts are removed unless allowScripts is explicitly true. Requires confirmation.", input_schema: objectSchema({ quarantinePath: str, parent: str, allowScripts: bool }, ["quarantinePath", "parent"]) },
  { name: "generate_external_asset", description: "Create an asynchronous Meshy text-to-3D preview job. Uses low-poly generation by default and returns a job ID that must be polled.", input_schema: objectSchema({ prompt: str, modelType: { type: "string", enum: ["lowpoly", "standard"] }, poseMode: { type: "string", enum: ["", "a-pose", "t-pose"] } }, ["prompt"]) },
  { name: "get_external_asset_job", description: "Poll a Meshy text-to-3D job. Completed artifacts still require user review and native Studio import.", input_schema: objectSchema({ jobId: str }, ["jobId"]) },
  { name: "download_external_asset", description: "Download a verified completed Meshy artifact to the local agent data folder for native Studio import. Only cached Meshy URLs and GLB/FBX formats are accepted.", input_schema: objectSchema({ jobId: str, format: { type: "string", enum: ["glb", "fbx"] } }, ["jobId", "format"]) },
  { name: "validate_project", description: "Run Studio-side structural checks for empty scripts, suspicious script placement, duplicate sibling names, and missing animation configuration.", input_schema: objectSchema({ root: str }) },
  { name: "get_runtime_observation", description: "Observe whether Studio is in Play mode and return recent runtime errors, output messages, and player state.", input_schema: objectSchema({ clearAfterRead: bool }) },
  { name: "run_playtest", description: "Collect a Play-assisted observation window. The user must already have pressed Play in Studio. Supports assertions: no_errors, instance_exists, property_equals, player_count_at_least.", input_schema: objectSchema({ durationSeconds: num, assertions: { type: "array", items: { type: "object" } } }) }
];

export function toolNames() {
  return tools.map((tool) => tool.name);
}

const destructive = new Set(["delete_instance", "replace_script", "patch_script", "upload_animation_asset", "approve_quarantined_asset"]);

export function isDestructiveTool(name: string) {
  return destructive.has(name);
}

export async function executeTool(sessionId: string, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  if (name === "scan_project") {
    const snapshot = studioBridge.snapshot(sessionId);
    return snapshot ? { success: true, data: snapshot } : { success: false, error: "Roblox Studio plugin is not connected" };
  }
  if (name === "generate_external_asset") return meshyClient.createPreview(input);
  if (name === "get_external_asset_job") return meshyClient.getTask(input);
  if (name === "download_external_asset") return meshyClient.downloadArtifact(input);
  return studioBridge.execute(sessionId, name, input, isDestructiveTool(name));
}
