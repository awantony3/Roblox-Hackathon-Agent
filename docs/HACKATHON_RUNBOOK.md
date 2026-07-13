# Hackathon runbook

## 1. Configure

```bash
cd /Users/antonywang/roblox-hackathon-agent
cp .env.example .env
```

Required:

- `ANTHROPIC_API_KEY` with available Claude API credit.
- `AGENT_API_KEY` set to a non-default local secret.

Optional:

- `MESHY_API_KEY` for production text-to-3D generation.

The Roblox plugin API key must match the backend. The plugin reads `RobloxHackathonAgent.ApiKey` and `RobloxHackathonAgent.ServerUrl` from plugin settings, falling back to `change-me` and `http://localhost:3100`.

## 2. Verify

```bash
npm install
npm run typecheck
npm test
npm run doctor
```

The doctor must report `READY` for autonomous building. Meshy is optional and does not block core readiness.

## 3. Install and start

```bash
./studio-plugin/sync.sh
npm start
```

Restart Roblox Studio after syncing the plugin. Enable HTTP requests in the experience security settings.

Check `GET /api/status` with the configured `X-API-Key`. Expected results are `ready: true`, at least one connected Studio session, no blockers, and the configured tool list.

## 4. Demo sequence

Use a disposable or backed-up place.

### Demo A — ReAct building

> Inspect this project. Create a small neon obstacle section with five platforms and one moving platform. Keep it isolated under a new Workspace model, add a TweenService animation, then inspect and structurally validate the result.

Expected evidence: project scan, batched build, tween script, follow-up inspection, and structural validation.

### Demo B — Runtime evidence

Press **Play** when the agent asks. Confirm that runtime mode, player state, `no_errors`, and target-instance assertions are reported.

### Demo C — Reflexion

Use a controlled broken script or invalid target in a disposable model. The trace should show:

```text
failure → observed evidence → reflection → revised strategy → verification
```

### Demo D — Animation

- Generate a KeyframeSequence.
- Preview it with a temporary `active://` ID.
- Open native publishing only if time and account ownership are ready.

### Demo E — Assets

- Search Creator Store.
- Quarantine one model.
- Show its script scan.
- Approve insertion with scripts removed.
- Optionally demonstrate Meshy test mode or a prepared production artifact.

## 5. Safety rules

- Do not use the primary production place.
- Do not approve deletion or script replacement without reading the request.
- Keep Creator Store assets quarantined until scan results are visible.
- Remove scripts from third-party assets by default.
- Do not expose API keys, signed URLs, or full project script snapshots.
- Save or publish only after manual review.

## 6. Known blockers

- Claude requires a funded Anthropic account.
- Studio must be restarted after plugin updates.
- Play mode must be started by the user.
- Animation publishing requires Roblox's authenticated UI.
- Generated GLB/FBX files require Studio's native 3D Importer.

## 7. Recovery

- Use Studio Undo for committed mutations.
- Failed mutation recordings are canceled automatically.
- Reject destructive confirmation by letting its 20-second timer expire.
- Stop the backend with `Ctrl+C`.
- Remove isolated demo models manually if a request is interrupted.

## 8. Presentation fallback

Record one successful end-to-end run. If model credit, networking, Studio authentication, or generation latency fails, show the recording and use `/api/status` plus the trace to explain the architecture.
