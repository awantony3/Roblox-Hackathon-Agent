# Roblox and external asset pipelines

## Creator Store pipeline

```text
search_toolbox
    ↓
user/agent selects an asset ID
    ↓
quarantine_toolbox_asset
    ↓
ServerStorage.AgentAssetQuarantine
    ↓
script and provenance scan
    ↓
approve_quarantined_asset (confirmation required)
    ↓
scripts removed by default
    ↓
approved destination
```

Creator Store assets never go directly into `Workspace`. They first enter an isolated `ServerStorage` folder. The scanner reports:

- Script count and source length.
- Unreadable script source.
- Dynamic code execution patterns.
- Environment manipulation.
- Numeric remote `require()` calls.
- Runtime asset loading.
- External HTTP requests.

When `allowScripts` is false, every `LuaSourceContainer` is removed before insertion. When it is true, approval is still blocked if suspicious patterns exist.

The imported root receives provenance attributes:

- `AgentSource`
- `AgentAssetId`
- `AgentImportedAt`
- `AgentApproved`
- `AgentScriptsRemoved`

Roblox documents that `AssetService:LoadAssetAsync()` can load public third-party assets and returns sandboxed models by default. [Roblox AssetService reference](https://create.roblox.com/docs/reference/engine/classes/AssetService)

## Meshy pipeline

```text
generate_external_asset
    ↓
Meshy preview job ID
    ↓
get_external_asset_job
    ↓
PENDING / IN_PROGRESS ──→ poll later
    ↓ SUCCEEDED
verified Meshy artifact URLs
    ↓
download_external_asset
    ↓
backend/data/assets/<job>.(glb|fbx)
    ↓
user review + Roblox native 3D Importer
```

Meshy preview jobs use:

- Text-to-3D API v2.
- Low-poly mode by default.
- The latest model.
- Prompt moderation.
- Automatic sizing with a bottom origin.
- GLB and FBX target formats.

The agent never accepts an arbitrary download URL. Artifact URLs must come from a completed job polled by the same backend process, use HTTPS, and belong to `meshy.ai` or one of its subdomains. Downloads are limited to 50 MB.

Meshy documents a two-stage preview/refine workflow and asynchronous task polling. [Meshy Text-to-3D API](https://docs.meshy.ai/en/api/text-to-3d)

## Completion boundaries

- Starting a Meshy job returns `requiresPolling`; it is not a completed asset.
- A completed generation returns `requiresUserCompletion`; it is not yet inside Roblox.
- Downloading a file returns `requiresUserCompletion`; the native importer and visual review remain outstanding.
- Creator Store insertion is complete only after quarantine review, confirmation, insertion, and follow-up Studio inspection.

## Remaining work

- Read polygon, material, texture, rig, and scale metadata before import.
- Add a guided macOS file-picker handoff for the downloaded artifact.
- Verify Creator Store license/distribution metadata when exposed by the API.
- Support Meshy refine jobs after preview approval.
- Support image-to-3D jobs.
- Add thumbnail review to the plugin panel.
