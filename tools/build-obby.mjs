const BASE_URL = "http://localhost:3100";
const API_KEY = process.env.AGENT_API_KEY || "change-me";

async function request(path, options = {}) {
  const response = await fetch(BASE_URL + path, {
    ...options,
    headers: { "content-type": "application/json", "x-api-key": API_KEY, ...(options.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${body.error || JSON.stringify(body)}`);
  return body;
}

const sessions = await request("/api/studio/sessions");
const session = sessions.sessions.find((item) => item.connected);
if (!session) throw new Error("No connected Roblox Studio session");

async function execute(tool, input) {
  process.stdout.write(`${tool}: `);
  const result = await request("/api/studio/execute", {
    method: "POST",
    body: JSON.stringify({ sessionId: session.sessionId, tool, input }),
  });
  console.log(result.message || "ok");
  return result;
}

const existing = await execute("find_instances", { root: "Workspace", nameContains: "SkylineSprint", limit: 5 });
if ((existing.data?.count || 0) > 0) throw new Error("Workspace.SkylineSprint already exists; refusing to create a duplicate");

const instances = [];
const add = (className, name, parent, properties = {}) => instances.push({ className, name, parent, properties });
const part = (name, parent, position, size, color, extra = {}) => add("Part", name, parent, {
  Anchored: true,
  Position: position,
  Size: size,
  Color: color,
  Material: "SmoothPlastic",
  TopSurface: "Smooth",
  BottomSurface: "Smooth",
  ...extra,
});

add("Model", "SkylineSprint", "Workspace");
add("Folder", "Course", "Workspace.SkylineSprint");
add("Folder", "Checkpoints", "Workspace.SkylineSprint");
add("Folder", "Hazards", "Workspace.SkylineSprint");
add("Folder", "MovingPlatforms", "Workspace.SkylineSprint");
add("Folder", "Spinners", "Workspace.SkylineSprint");
add("Folder", "FadingPlatforms", "Workspace.SkylineSprint");
add("Folder", "Decor", "Workspace.SkylineSprint");

// Start island and course-wide lava floor.
part("StartIsland", "Workspace.SkylineSprint.Course", { x: 0, y: 4, z: 0 }, { x: 24, y: 2, z: 20 }, { r: 30, g: 38, b: 64 });
add("SpawnLocation", "Start", "Workspace.SkylineSprint.Course", {
  Anchored: true, Position: { x: 0, y: 5.5, z: -3 }, Size: { x: 8, y: 1, z: 8 },
  Color: { r: 70, g: 255, b: 190 }, Material: "Neon", Neutral: true, Duration: 0,
});
part("LavaFloor", "Workspace.SkylineSprint.Hazards", { x: 0, y: 0, z: 205 }, { x: 150, y: 2, z: 440 }, { r: 255, g: 55, b: 70 }, { Material: "Neon" });

// Stage 1: generous stepping stones.
for (let i = 0; i < 6; i++) {
  part(`Step_${i + 1}`, "Workspace.SkylineSprint.Course", { x: i % 2 === 0 ? -5 : 5, y: 5 + i * 0.7, z: 16 + i * 8 }, { x: 8, y: 1.5, z: 6 }, { r: 72, g: 133, b: 255 });
}

// Stage 2: narrow zig-zag beams.
for (let i = 0; i < 5; i++) {
  part(`ZigZag_${i + 1}`, "Workspace.SkylineSprint.Course", { x: i % 2 === 0 ? -7 : 7, y: 10, z: 67 + i * 8 }, { x: 12, y: 1.2, z: 3 }, { r: 174, g: 92, b: 255 });
}

// Stage 3: fading glass path.
for (let i = 0; i < 7; i++) {
  part(`Fade_${i + 1}`, "Workspace.SkylineSprint.FadingPlatforms", { x: (i - 3) * 7, y: 11, z: 111 + i * 6 }, { x: 6, y: 1, z: 6 }, { r: 70, g: 230, b: 255 }, { Material: "Glass", Transparency: 0.2 });
}

// Stage 4: moving platform crossing.
// Wide enough that even when adjacent platforms are at opposite tween extremes,
// the edge-to-edge gap remains below a conservative 12-stud jump envelope.
part("Move_1", "Workspace.SkylineSprint.MovingPlatforms", { x: 0, y: 12, z: 158 }, { x: 40, y: 1.4, z: 9 }, { r: 255, g: 193, b: 64 }, { Material: "Neon" });
part("Move_2", "Workspace.SkylineSprint.MovingPlatforms", { x: 0, y: 14, z: 171 }, { x: 40, y: 1.4, z: 9 }, { r: 255, g: 193, b: 64 }, { Material: "Neon" });
part("Move_3", "Workspace.SkylineSprint.MovingPlatforms", { x: 0, y: 16, z: 184 }, { x: 40, y: 1.4, z: 9 }, { r: 255, g: 193, b: 64 }, { Material: "Neon" });

// Stage 5: sweeper arenas.
for (let i = 0; i < 2; i++) {
  const z = 205 + i * 25;
  part(`Arena_${i + 1}`, "Workspace.SkylineSprint.Course", { x: 0, y: 17 + i * 2, z }, { x: 28, y: 1.5, z: 20 }, { r: 42, g: 48, b: 80 });
  part(`Spinner_${i + 1}`, "Workspace.SkylineSprint.Spinners", { x: 0, y: 19 + i * 2, z }, { x: 30, y: 1.2, z: 2 }, { r: 255, g: 70, b: 110 }, { Material: "Neon" });
}

// Stage 6: rising staircase.
for (let i = 0; i < 8; i++) {
  part(`Stair_${i + 1}`, "Workspace.SkylineSprint.Course", { x: 0, y: 20 + i * 2.2, z: 249 + i * 7 }, { x: 10, y: 1.5, z: 5 }, { r: 52, g: 211, b: 153 });
}

// Stage 7: offset pillars.
for (let i = 0; i < 7; i++) {
  part(`Pillar_${i + 1}`, "Workspace.SkylineSprint.Course", { x: [-10, 0, 10][i % 3], y: 38 + (i % 2) * 2, z: 307 + i * 8 }, { x: 6, y: 8 + (i % 3) * 2, z: 6 }, { r: 248, g: 113, b: 113 });
}

// Stage 8: precision rails.
for (let i = 0; i < 4; i++) {
  part(`Rail_${i + 1}`, "Workspace.SkylineSprint.Course", { x: i % 2 === 0 ? -5 : 5, y: 44, z: 367 + i * 12 }, { x: 2.5, y: 1.2, z: 12 }, { r: 250, g: 204, b: 21 }, { Material: "Metal" });
}

// Stage 9: final jumps and finish island.
for (let i = 0; i < 5; i++) {
  part(`FinalJump_${i + 1}`, "Workspace.SkylineSprint.Course", { x: i % 2 === 0 ? -8 : 8, y: 45 + i * 1.5, z: 414 + i * 9 }, { x: 7, y: 1.5, z: 5 }, { r: 244, g: 114, b: 182 });
}
part("FinishIsland", "Workspace.SkylineSprint.Course", { x: 0, y: 53, z: 466 }, { x: 30, y: 2, z: 24 }, { r: 30, g: 38, b: 64 });
part("Finish", "Workspace.SkylineSprint.Course", { x: 0, y: 54.5, z: 466 }, { x: 14, y: 1, z: 10 }, { r: 255, g: 235, b: 80 }, { Material: "Neon" });

// Checkpoints after each major section. Their numeric names drive the server logic.
const checkpoints = [
  [1, 0, 10, 58], [2, 0, 11, 104], [3, 0, 12, 151], [4, 0, 17, 193],
  [5, 0, 21, 242], [6, 0, 37, 300], [7, 0, 43, 360], [8, 0, 45, 407], [9, 0, 52, 455],
];
for (const [stage, x, y, z] of checkpoints) {
  part(`Checkpoint_${stage}`, "Workspace.SkylineSprint.Checkpoints", { x, y, z }, { x: 14, y: 1, z: 8 }, { r: 40, g: 255, b: 160 }, { Material: "Neon" });
}

// Floating guide arrows and title blocks provide visual direction without assets.
for (let i = 0; i < 10; i++) {
  part(`Guide_${i + 1}`, "Workspace.SkylineSprint.Decor", { x: i % 2 === 0 ? -32 : 32, y: 18 + i * 4, z: 20 + i * 45 }, { x: 2, y: 18, z: 2 }, { r: 56, g: 189, b: 248 }, { Material: "Neon", CanCollide: false });
}

await execute("build_from_spec", { name: "Build Skyline Sprint obby", instances });

const serverSource = `local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")

local obby = workspace:WaitForChild("SkylineSprint")
local checkpoints = obby:WaitForChild("Checkpoints")
local hazards = obby:WaitForChild("Hazards")
local movers = obby:WaitForChild("MovingPlatforms")
local spinners = obby:WaitForChild("Spinners")
local fading = obby:WaitForChild("FadingPlatforms")
local finish = obby.Course:WaitForChild("Finish")
local start = obby.Course:WaitForChild("Start")
local totalStages = #checkpoints:GetChildren() + 1

local function stageNumber(part)
    return tonumber(part.Name:match("(%d+)$")) or 0
end

local function setupPlayer(player)
    local leaderstats = Instance.new("Folder")
    leaderstats.Name = "leaderstats"
    leaderstats.Parent = player
    local stage = Instance.new("IntValue")
    stage.Name = "Stage"
    stage.Value = 0
    stage.Parent = leaderstats
    local wins = Instance.new("IntValue")
    wins.Name = "Wins"
    wins.Parent = leaderstats

    player.CharacterAdded:Connect(function(character)
        local root = character:WaitForChild("HumanoidRootPart", 8)
        if not root then return end
        task.wait(0.1)
        local target = stage.Value > 0 and checkpoints:FindFirstChild("Checkpoint_" .. stage.Value) or start
        if target then character:PivotTo(target.CFrame + Vector3.new(0, 4, 0)) end
    end)
end

Players.PlayerAdded:Connect(setupPlayer)
for _, player in Players:GetPlayers() do setupPlayer(player) end

for _, checkpoint in checkpoints:GetChildren() do
    checkpoint.Touched:Connect(function(hit)
        local player = Players:GetPlayerFromCharacter(hit.Parent)
        local stage = player and player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Stage")
        local number = stageNumber(checkpoint)
        if stage and number > stage.Value then
            stage.Value = number
            checkpoint.Color = Color3.fromRGB(255, 255, 255)
            task.delay(0.35, function() if checkpoint.Parent then checkpoint.Color = Color3.fromRGB(40, 255, 160) end end)
        end
    end)
end

for _, hazard in hazards:GetChildren() do
    hazard.Touched:Connect(function(hit)
        local humanoid = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid")
        if humanoid then humanoid.Health = 0 end
    end)
end

for index, mover in movers:GetChildren() do
    local offset = index % 2 == 0 and 24 or -24
    local tween = TweenService:Create(mover, TweenInfo.new(2.4 + index * 0.25, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), {
        Position = mover.Position + Vector3.new(offset, 0, 0)
    })
    tween:Play()
end

for _, tile in fading:GetChildren() do
    local busy = false
    tile.Touched:Connect(function(hit)
        if busy or not hit.Parent:FindFirstChildOfClass("Humanoid") then return end
        busy = true
        task.wait(0.3)
        tile.CanCollide = false
        TweenService:Create(tile, TweenInfo.new(0.25), {Transparency = 1}):Play()
        task.wait(2)
        tile.CanCollide = true
        TweenService:Create(tile, TweenInfo.new(0.25), {Transparency = 0.2}):Play()
        busy = false
    end)
end

local spinnerAngles = {}
for _, spinner in spinners:GetChildren() do
    spinnerAngles[spinner] = 0
    spinner.Touched:Connect(function(hit)
        local humanoid = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid")
        if humanoid then humanoid:TakeDamage(35) end
    end)
end
RunService.Heartbeat:Connect(function(dt)
    for spinner, angle in spinnerAngles do
        if spinner.Parent then
            spinnerAngles[spinner] = angle + dt * 1.8
            spinner.CFrame = CFrame.new(spinner.Position) * CFrame.Angles(0, spinnerAngles[spinner], 0)
        end
    end
end)

local finishDebounce = {}
finish.Touched:Connect(function(hit)
    local player = Players:GetPlayerFromCharacter(hit.Parent)
    if not player or finishDebounce[player] then return end
    finishDebounce[player] = true
    local stats = player:FindFirstChild("leaderstats")
    if stats then
        stats.Stage.Value = totalStages
        stats.Wins.Value += 1
    end
    finish.Color = Color3.fromRGB(255, 255, 255)
    task.delay(1, function()
        finishDebounce[player] = nil
        if finish.Parent then finish.Color = Color3.fromRGB(255, 235, 80) end
    end)
end)
`;

const clientSource = `local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local player = Players.LocalPlayer
local gui = Instance.new("ScreenGui")
gui.Name = "SkylineSprintUI"
gui.ResetOnSpawn = false
gui.Parent = player:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0.5, 0)
panel.Position = UDim2.new(0.5, 0, 0, 22)
panel.Size = UDim2.fromOffset(330, 76)
panel.BackgroundColor3 = Color3.fromRGB(18, 24, 44)
panel.BackgroundTransparency = 0.08
panel.Parent = gui
Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 16)
local stroke = Instance.new("UIStroke", panel)
stroke.Color = Color3.fromRGB(70, 255, 190)
stroke.Thickness = 2

local title = Instance.new("TextLabel")
title.BackgroundTransparency = 1
title.Size = UDim2.new(1, 0, 0, 30)
title.Position = UDim2.fromOffset(0, 7)
title.Font = Enum.Font.GothamBold
title.Text = "SKYLINE SPRINT"
title.TextColor3 = Color3.fromRGB(255, 255, 255)
title.TextSize = 20
title.Parent = panel

local status = Instance.new("TextLabel")
status.BackgroundTransparency = 1
status.Size = UDim2.new(1, -24, 0, 28)
status.Position = UDim2.fromOffset(12, 38)
status.Font = Enum.Font.GothamMedium
status.TextColor3 = Color3.fromRGB(70, 255, 190)
status.TextSize = 16
status.Parent = panel

local stage = player:WaitForChild("leaderstats"):WaitForChild("Stage")
local function update()
    status.Text = stage.Value >= 10 and "COURSE COMPLETE!" or string.format("Checkpoint %d / 9", stage.Value)
    TweenService:Create(panel, TweenInfo.new(0.15, Enum.EasingStyle.Back), {Size = UDim2.fromOffset(345, 80)}):Play()
    task.delay(0.16, function() TweenService:Create(panel, TweenInfo.new(0.18), {Size = UDim2.fromOffset(330, 76)}):Play() end)
end
stage.Changed:Connect(update)
update()
`;

await execute("create_script", { className: "Script", name: "SkylineSprintServer", parent: "ServerScriptService", source: serverSource });
await execute("create_script", { className: "LocalScript", name: "SkylineSprintClient", parent: "StarterPlayer.StarterPlayerScripts", source: clientSource });

await execute("set_properties", { path: "Lighting", properties: {
  ClockTime: 18.4, Brightness: 2.2, Ambient: { r: 45, g: 55, b: 90 }, OutdoorAmbient: { r: 80, g: 85, b: 120 },
  FogColor: { r: 40, g: 55, b: 90 }, FogEnd: 850,
} });

await execute("validate_project", { root: "game" });
await execute("get_instance", { path: "Workspace.SkylineSprint" });
console.log(`Skyline Sprint built in Studio session ${session.sessionId.slice(0, 8)}.`);
