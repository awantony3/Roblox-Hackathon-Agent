-- Roblox Hackathon Agent Studio Plugin v0.1.0
-- Enable Studio Settings > Security > Allow HTTP Requests.

local HttpService = game:GetService("HttpService")
local Selection = game:GetService("Selection")
local ChangeHistoryService = game:GetService("ChangeHistoryService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local LogService = game:GetService("LogService")
local ScriptContext = game:GetService("ScriptContext")
local KeyframeSequenceProvider = game:GetService("KeyframeSequenceProvider")
local InsertService = game:GetService("InsertService")
local AssetService = game:GetService("AssetService")

local SERVER_URL = plugin:GetSetting("RobloxHackathonAgent.ServerUrl") or "http://localhost:3100"
local API_KEY = plugin:GetSetting("RobloxHackathonAgent.ApiKey") or "change-me"
local SESSION_ID = HttpService:GenerateGUID(false)
local MAX_RUNTIME_MESSAGES = 200
local runtimeErrors = {}
local runtimeMessages = {}

local function pushBounded(buffer, item)
    table.insert(buffer, item)
    while #buffer > MAX_RUNTIME_MESSAGES do table.remove(buffer, 1) end
end

LogService.MessageOut:Connect(function(message, messageType)
    pushBounded(runtimeMessages, { message = message, messageType = tostring(messageType), at = DateTime.now():ToIsoDate() })
end)

pcall(function()
    ScriptContext.Error:Connect(function(message, stackTrace, scriptInstance)
        pushBounded(runtimeErrors, {
            message = message,
            stackTrace = stackTrace,
            scriptPath = scriptInstance and scriptInstance:GetFullName() or nil,
            at = DateTime.now():ToIsoDate()
        })
    end)
end)

local toolbar = plugin:CreateToolbar("Roblox AI Agent")
local toggleButton = toolbar:CreateButton("Agent", "Open Roblox Hackathon Agent", "rbxassetid://4458901886")
local info = DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, true, false, 420, 540, 320, 360)
local widget = plugin:CreateDockWidgetPluginGui("RobloxHackathonAgent", info)
widget.Title = "Roblox Hackathon Agent"

local root = Instance.new("Frame")
root.Size = UDim2.fromScale(1, 1)
root.BackgroundColor3 = Color3.fromRGB(27, 29, 35)
root.Parent = widget

local status = Instance.new("TextLabel")
status.Size = UDim2.new(1, -20, 0, 32)
status.Position = UDim2.fromOffset(10, 10)
status.BackgroundTransparency = 1
status.TextColor3 = Color3.fromRGB(128, 220, 160)
status.TextXAlignment = Enum.TextXAlignment.Left
status.Text = "Connecting…"
status.Parent = root

local input = Instance.new("TextBox")
input.Size = UDim2.new(1, -20, 0, 100)
input.Position = UDim2.fromOffset(10, 50)
input.BackgroundColor3 = Color3.fromRGB(42, 45, 54)
input.TextColor3 = Color3.new(1, 1, 1)
input.PlaceholderText = "Describe the Roblox game or feature to create…"
input.Text = ""
input.MultiLine = true
input.TextWrapped = true
input.ClearTextOnFocus = false
input.Parent = root

local runButton = Instance.new("TextButton")
runButton.Size = UDim2.new(1, -20, 0, 40)
runButton.Position = UDim2.fromOffset(10, 160)
runButton.BackgroundColor3 = Color3.fromRGB(92, 86, 214)
runButton.TextColor3 = Color3.new(1, 1, 1)
runButton.Text = "Build with Agent"
runButton.Parent = root

local output = Instance.new("TextLabel")
output.Size = UDim2.new(1, -20, 1, -220)
output.Position = UDim2.fromOffset(10, 210)
output.BackgroundColor3 = Color3.fromRGB(20, 22, 27)
output.TextColor3 = Color3.fromRGB(225, 225, 230)
output.TextXAlignment = Enum.TextXAlignment.Left
output.TextYAlignment = Enum.TextYAlignment.Top
output.TextWrapped = true
output.Text = "Ready. Safe additions apply automatically; destructive changes require approval."
output.Parent = root

local isConfirming = false

local function request(method, endpoint, body)
    local ok, response = pcall(function()
        return HttpService:RequestAsync({
            Url = SERVER_URL .. endpoint,
            Method = method,
            Headers = { ["Content-Type"] = "application/json", ["X-API-Key"] = API_KEY },
            Body = body and HttpService:JSONEncode(body) or nil
        })
    end)
    if not ok then return nil, tostring(response) end
    local decoded = response.Body ~= "" and HttpService:JSONDecode(response.Body) or {}
    if not response.Success then return nil, decoded.error or ("HTTP " .. response.StatusCode) end
    return decoded
end

local function resolvePath(path)
    local current = game
    for segment in string.gmatch(path, "[^%.]+") do
        if segment ~= "game" then current = current and current:FindFirstChild(segment) end
    end
    return current
end

local function encodeValue(value)
    if typeof(value) == "Vector3" then return { __type = "Vector3", x = value.X, y = value.Y, z = value.Z } end
    if typeof(value) == "Color3" then return { __type = "Color3", r = value.R, g = value.G, b = value.B } end
    if typeof(value) == "CFrame" then return { __type = "CFrame", components = { value:GetComponents() } } end
    if typeof(value) == "EnumItem" then return { __type = "Enum", value = tostring(value) } end
    return value
end

local function decodeValue(value)
    if type(value) ~= "table" then return value end
    if value.__type == "Vector3" then return Vector3.new(value.x, value.y, value.z) end
    if value.__type == "Color3" then return Color3.new(value.r, value.g, value.b) end
    if value.__type == "CFrame" then return CFrame.new(table.unpack(value.components)) end
    return value
end

local function decodeProperty(instance, key, value)
    if type(value) ~= "table" then
        local gotCurrent, current = pcall(function() return instance[key] end)
        if gotCurrent and typeof(current) == "EnumItem" and type(value) == "string" then
            local enumType = tostring(current):match("^Enum%.([^.]+)%.")
            if enumType and Enum[enumType] and Enum[enumType][value] then return Enum[enumType][value] end
        end
        return value
    end

    if value.__type then return decodeValue(value) end
    local gotCurrent, current = pcall(function() return instance[key] end)
    local currentType = gotCurrent and typeof(current) or nil

    if currentType == "Vector3" and value.x and value.y and value.z then
        return Vector3.new(value.x, value.y, value.z)
    elseif currentType == "Vector2" and value.x and value.y then
        return Vector2.new(value.x, value.y)
    elseif currentType == "Color3" and value.r and value.g and value.b then
        local scale = math.max(value.r, value.g, value.b) > 1 and 255 or 1
        return Color3.new(value.r / scale, value.g / scale, value.b / scale)
    elseif currentType == "CFrame" then
        local position = value.position or value
        if position.x and position.y and position.z then
            local base = CFrame.new(position.x, position.y, position.z)
            if value.rotation then
                base *= CFrame.Angles(math.rad(value.rotation.x or 0), math.rad(value.rotation.y or 0), math.rad(value.rotation.z or 0))
            end
            return base
        end
    elseif currentType == "UDim2" then
        return UDim2.new(value.scaleX or 0, value.offsetX or 0, value.scaleY or 0, value.offsetY or 0)
    elseif currentType == "UDim" then
        return UDim.new(value.scale or 0, value.offset or 0)
    elseif currentType == "NumberRange" then
        return NumberRange.new(value.min or value[1] or 0, value.max or value[2] or value.min or value[1] or 0)
    end
    return decodeValue(value)
end

local function toLuaLiteral(value)
    local valueType = typeof(value)
    if valueType == "string" then return string.format("%q", value) end
    if valueType == "number" or valueType == "boolean" then return tostring(value) end
    if valueType == "Vector3" then return string.format("Vector3.new(%s, %s, %s)", value.X, value.Y, value.Z) end
    if valueType == "Vector2" then return string.format("Vector2.new(%s, %s)", value.X, value.Y) end
    if valueType == "Color3" then return string.format("Color3.new(%s, %s, %s)", value.R, value.G, value.B) end
    if valueType == "CFrame" then return "CFrame.new(" .. table.concat({ value:GetComponents() }, ", ") .. ")" end
    if valueType == "UDim2" then return string.format("UDim2.new(%s, %s, %s, %s)", value.X.Scale, value.X.Offset, value.Y.Scale, value.Y.Offset) end
    if valueType == "EnumItem" then return tostring(value) end
    error("Unsupported tween value type: " .. valueType)
end

local function replacePlain(source, search, replacement, replaceAll)
    if search == "" then return nil, 0 end
    local pieces, cursor, count = {}, 1, 0
    while true do
        local first, last = string.find(source, search, cursor, true)
        if not first then break end
        table.insert(pieces, string.sub(source, cursor, first - 1))
        table.insert(pieces, replacement)
        cursor, count = last + 1, count + 1
        if not replaceAll then break end
    end
    if count == 0 then return nil, 0 end
    table.insert(pieces, string.sub(source, cursor))
    return table.concat(pieces), count
end

local function poseCFrame(spec)
    local transform = spec.cframe or spec.transform or {}
    local position = transform.position or transform
    local rotation = transform.rotation or {}
    return CFrame.new(position.x or 0, position.y or 0, position.z or 0)
        * CFrame.Angles(math.rad(rotation.x or 0), math.rad(rotation.y or 0), math.rad(rotation.z or 0))
end

local function enumMember(enumType, name)
    local ok, value = pcall(function() return enumType[name] end)
    return ok and value or nil
end

local function createPose(spec, poseCounter)
    poseCounter.count += 1
    if poseCounter.count > 2000 then error("Animation exceeds the 2,000-pose safety limit") end
    local pose = Instance.new("Pose")
    pose.Name = assert(spec.name, "Every pose requires a joint name")
    pose.CFrame = poseCFrame(spec)
    pose.Weight = tonumber(spec.weight) or 1
    local style = spec.easingStyle or "Linear"
    local direction = spec.easingDirection or "Out"
    local poseStyle = enumMember(Enum.PoseEasingStyle, style)
    local poseDirection = enumMember(Enum.PoseEasingDirection, direction)
    if poseStyle then pose.EasingStyle = poseStyle end
    if poseDirection then pose.EasingDirection = poseDirection end
    for _, childSpec in ipairs(spec.subposes or spec.children or {}) do
        createPose(childSpec, poseCounter).Parent = pose
    end
    return pose
end

local SCRIPT_RISK_PATTERNS = {
    { pattern = "loadstring", reason = "Dynamic code execution" },
    { pattern = "getfenv", reason = "Environment manipulation" },
    { pattern = "setfenv", reason = "Environment manipulation" },
    { pattern = "require%s*%(%s*%d+", reason = "Remote asset require" },
    { pattern = "InsertService%s*:%s*LoadAsset", reason = "Runtime remote asset loading" },
    { pattern = "AssetService%s*:%s*LoadAssetAsync", reason = "Runtime remote asset loading" },
    { pattern = "HttpService%s*:%s*GetAsync", reason = "External network request" },
    { pattern = "HttpService%s*:%s*PostAsync", reason = "External network request" }
}

local function scanAssetScripts(container)
    local report = { scriptCount = 0, suspiciousCount = 0, scripts = {} }
    for _, item in ipairs(container:GetDescendants()) do
        if item:IsA("LuaSourceContainer") then
            report.scriptCount += 1
            local entry = { path = item:GetFullName(), className = item.ClassName, risks = {}, sourceLength = 0 }
            local readable, source = pcall(function() return item.Source end)
            if readable then
                entry.sourceLength = #source
                if #source > 100000 then table.insert(entry.risks, "Unusually large script") end
                for _, risk in ipairs(SCRIPT_RISK_PATTERNS) do
                    if string.find(source, risk.pattern) then table.insert(entry.risks, risk.reason) end
                end
            else
                table.insert(entry.risks, "Script source could not be inspected")
            end
            if #entry.risks > 0 then report.suspiciousCount += 1 end
            table.insert(report.scripts, entry)
        end
    end
    return report
end

local function instanceSummary(instance, depth, includeSource)
    local item = { name = instance.Name, className = instance.ClassName, path = instance:GetFullName(), children = {} }
    if includeSource and instance:IsA("LuaSourceContainer") then item.source = instance.Source end
    if instance:IsA("BasePart") then
        item.properties = { Position = encodeValue(instance.Position), Size = encodeValue(instance.Size), Color = encodeValue(instance.Color), Anchored = instance.Anchored, Material = tostring(instance.Material) }
    end
    if depth > 0 then
        for _, child in ipairs(instance:GetChildren()) do table.insert(item.children, instanceSummary(child, depth - 1, includeSource)) end
    end
    return item
end

local function snapshot()
    local services = {}
    for _, name in ipairs({ "Workspace", "ReplicatedStorage", "ServerScriptService", "ServerStorage", "StarterGui", "StarterPlayer" }) do
        table.insert(services, instanceSummary(game:GetService(name), 2, false))
    end
    local selected = {}
    for _, item in ipairs(Selection:Get()) do table.insert(selected, instanceSummary(item, 1, false)) end
    return {
        placeId = game.PlaceId, gameId = game.GameId, hierarchy = services, selection = selected,
        runtime = { isRunning = RunService:IsRunning(), isEdit = RunService:IsEdit(), playerCount = #Players:GetPlayers(), errorCount = #runtimeErrors },
        capturedAt = DateTime.now():ToIsoDate()
    }
end

local function runtimeObservation(errorsFrom, messagesFrom)
    local errors, messages, playerStates = {}, {}, {}
    for index = errorsFrom or 1, #runtimeErrors do table.insert(errors, runtimeErrors[index]) end
    for index = messagesFrom or 1, #runtimeMessages do table.insert(messages, runtimeMessages[index]) end
    for _, player in ipairs(Players:GetPlayers()) do
        local character = player.Character
        local humanoid = character and character:FindFirstChildOfClass("Humanoid")
        table.insert(playerStates, {
            name = player.Name,
            userId = player.UserId,
            hasCharacter = character ~= nil,
            health = humanoid and humanoid.Health or nil,
            maxHealth = humanoid and humanoid.MaxHealth or nil
        })
    end
    return {
        isRunning = RunService:IsRunning(),
        isEdit = RunService:IsEdit(),
        players = playerStates,
        playerCount = #playerStates,
        errors = errors,
        messages = messages
    }
end

local function evaluateAssertion(assertion, observation)
    local assertionType = assertion.type
    if assertionType == "no_errors" then
        local passed = #observation.errors == 0
        return { type = assertionType, passed = passed, actual = #observation.errors, expected = 0 }
    elseif assertionType == "instance_exists" then
        local exists = resolvePath(assertion.path) ~= nil
        return { type = assertionType, path = assertion.path, passed = exists, actual = exists, expected = true }
    elseif assertionType == "property_equals" then
        local target = resolvePath(assertion.path)
        if not target then return { type = assertionType, path = assertion.path, passed = false, error = "Instance not found" } end
        local readOk, actual = pcall(function() return target[assertion.property] end)
        if not readOk then return { type = assertionType, path = assertion.path, passed = false, error = tostring(actual) } end
        local expected = decodeProperty(target, assertion.property, assertion.value)
        return { type = assertionType, path = assertion.path, property = assertion.property, passed = actual == expected, actual = encodeValue(actual), expected = encodeValue(expected) }
    elseif assertionType == "player_count_at_least" then
        local minimum = tonumber(assertion.value) or 1
        return { type = assertionType, passed = observation.playerCount >= minimum, actual = observation.playerCount, expected = minimum }
    end
    return { type = tostring(assertionType), passed = false, error = "Unsupported assertion type" }
end

local function setProperties(instance, properties)
    for key, value in pairs(properties or {}) do
        local ok, err = pcall(function() instance[key] = decodeProperty(instance, key, value) end)
        if not ok then return false, key .. ": " .. tostring(err) end
    end
    return true
end

local function confirmDestructive(command)
    isConfirming = true
    output.Text = "DESTRUCTIVE CHANGE REQUESTED\n\n" .. command.tool .. "\n" .. HttpService:JSONEncode(command.input) .. "\n\nClick the button within 20 seconds to approve. Otherwise it is denied."
    runButton.Text = "Approve destructive change"
    local decided, approved = false, false
    local connection
    connection = runButton.MouseButton1Click:Connect(function() approved = input.Text ~= "REJECT"; decided = true end)
    local started = os.clock()
    while not decided and os.clock() - started < 20 do task.wait(0.1) end
    connection:Disconnect()
    isConfirming = false
    runButton.Text = "Build with Agent"
    return approved
end

local function execute(command)
    if command.destructive and not confirmDestructive(command) then return { success = false, error = "User rejected destructive change" } end
    local p = command.input
    local mutationTools = {
        create_instance = true, set_properties = true, create_script = true,
        replace_script = true, patch_script = true, delete_instance = true,
        build_from_spec = true, apply_animation_asset = true, create_tween = true,
        create_keyframe_sequence = true, quarantine_toolbox_asset = true,
        approve_quarantined_asset = true
    }
    local recording = nil
    if mutationTools[command.tool] then
        local began, id = pcall(function()
            return ChangeHistoryService:TryBeginRecording("AI Agent: " .. command.tool)
        end)
        if began then recording = id end
    end
    local ok, result = pcall(function()
        if command.tool == "get_instance" then
            local target = resolvePath(p.path)
            if not target then error("Instance not found: " .. p.path) end
            return { success = true, data = instanceSummary(target, 2, true) }
        elseif command.tool == "find_instances" then
            local searchRoot = (p.root and resolvePath(p.root)) or game
            if not searchRoot then error("Search root not found: " .. tostring(p.root)) end
            local matches = {}
            local needle = string.lower(p.nameContains or "")
            local limit = math.clamp(tonumber(p.limit) or 50, 1, 200)
            for _, item in ipairs(searchRoot:GetDescendants()) do
                local nameMatches = needle == "" or string.find(string.lower(item.Name), needle, 1, true) ~= nil
                local classMatches = not p.className or p.className == "" or item:IsA(p.className)
                if nameMatches and classMatches then
                    table.insert(matches, instanceSummary(item, 0, false))
                    if #matches >= limit then break end
                end
            end
            return { success = true, data = { matches = matches, count = #matches, limited = #matches == limit } }
        elseif command.tool == "read_script" then
            local scriptObject = resolvePath(p.path)
            if not scriptObject or not scriptObject:IsA("LuaSourceContainer") then error("Script not found: " .. p.path) end
            return { success = true, data = { path = scriptObject:GetFullName(), className = scriptObject.ClassName, source = scriptObject.Source } }
        elseif command.tool == "create_instance" then
            local parent = resolvePath(p.parent)
            if not parent then error("Parent not found: " .. p.parent) end
            local item = Instance.new(p.className); item.Name = p.name
            local changed, err = setProperties(item, p.properties); if not changed then error(err) end
            item.Parent = parent
            return { success = true, message = "Created " .. item:GetFullName() }
        elseif command.tool == "set_properties" then
            local target = resolvePath(p.path); if not target then error("Instance not found") end
            local changed, err = setProperties(target, p.properties); if not changed then error(err) end
            return { success = true, message = "Updated " .. target:GetFullName() }
        elseif command.tool == "create_script" then
            if #p.source > 200000 then error("Script source exceeds 200,000 character safety limit") end
            local parent = resolvePath(p.parent); if not parent then error("Parent not found") end
            local scriptObject = Instance.new(p.className); scriptObject.Name = p.name; scriptObject.Source = p.source; scriptObject.Parent = parent
            return { success = true, message = "Created " .. scriptObject:GetFullName() }
        elseif command.tool == "replace_script" then
            if #p.source > 200000 then error("Script source exceeds 200,000 character safety limit") end
            local scriptObject = resolvePath(p.path); if not scriptObject or not scriptObject:IsA("LuaSourceContainer") then error("Script not found") end
            scriptObject.Source = p.source
            return { success = true, message = "Replaced " .. scriptObject:GetFullName() }
        elseif command.tool == "patch_script" then
            local scriptObject = resolvePath(p.path); if not scriptObject or not scriptObject:IsA("LuaSourceContainer") then error("Script not found") end
            local patched, count = replacePlain(scriptObject.Source, p.search, p.replacement, p.replaceAll == true)
            if not patched then error("Exact search text was not found; read the script again before patching") end
            if #patched > 200000 then error("Patched source exceeds 200,000 character safety limit") end
            scriptObject.Source = patched
            return { success = true, message = "Patched " .. scriptObject:GetFullName(), data = { replacements = count } }
        elseif command.tool == "delete_instance" then
            local target = resolvePath(p.path); if not target then error("Instance not found") end
            target:Destroy(); return { success = true, message = "Deleted " .. p.path }
        elseif command.tool == "build_from_spec" then
            if #(p.instances or {}) > 500 then error("Build exceeds the 500-instance command limit; split it into verified stages") end
            local created = 0
            for _, spec in ipairs(p.instances or {}) do
                local parent = resolvePath(spec.parent); if not parent then error("Parent not found: " .. tostring(spec.parent)) end
                local item = Instance.new(spec.className); item.Name = spec.name or spec.className
                local changed, err = setProperties(item, spec.properties); if not changed then error(err) end
                item.Parent = parent; created += 1
            end
            return { success = true, message = "Built " .. created .. " instances" }
        elseif command.tool == "apply_animation_asset" then
            local rig = resolvePath(p.rigPath); if not rig then error("Rig not found") end
            local numericId = tostring(p.animationId):gsub("rbxassetid://", "")
            if not numericId:match("^%d+$") then error("Animation ID must be numeric") end
            local animation = Instance.new("Animation"); animation.Name = "AgentAnimation"; animation.AnimationId = "rbxassetid://" .. numericId; animation.Parent = rig
            animation:SetAttribute("AgentLooped", p.looped == true)
            return { success = true, message = "Added animation asset to " .. rig:GetFullName(), data = { animationId = numericId, animationPath = animation:GetFullName() } }
        elseif command.tool == "create_keyframe_sequence" then
            local parent = resolvePath(p.parent); if not parent then error("Animation parent not found: " .. tostring(p.parent)) end
            if #(p.keyframes or {}) == 0 then error("At least one keyframe is required") end
            if #p.keyframes > 300 then error("Animation exceeds the 300-keyframe safety limit") end
            local sequence = Instance.new("KeyframeSequence")
            sequence.Name = p.name
            sequence.Loop = p.loop == true
            local priority = p.priority or "Action"
            if Enum.AnimationPriority[priority] then sequence.Priority = Enum.AnimationPriority[priority] end
            local poseCounter = { count = 0 }
            local duration = 0
            for index, frameSpec in ipairs(p.keyframes) do
                local frame = Instance.new("Keyframe")
                frame.Name = frameSpec.name or ("Keyframe" .. index)
                frame.Time = tonumber(frameSpec.time) or 0
                duration = math.max(duration, frame.Time)
                for _, poseSpec in ipairs(frameSpec.poses or {}) do createPose(poseSpec, poseCounter).Parent = frame end
                frame.Parent = sequence
            end
            sequence.Parent = parent
            return { success = true, message = "Created " .. sequence:GetFullName(), data = { keyframeCount = #p.keyframes, poseCount = poseCounter.count, duration = duration } }
        elseif command.tool == "preview_keyframe_sequence" then
            local sequence = resolvePath(p.keyframeSequencePath)
            if not sequence or not sequence:IsA("KeyframeSequence") then error("KeyframeSequence not found") end
            local registrationMode = "active"
            local registered, temporaryId = pcall(function()
                return KeyframeSequenceProvider:RegisterActiveKeyframeSequence(sequence)
            end)
            if not registered then
                registrationMode = "hash"
                temporaryId = KeyframeSequenceProvider:RegisterKeyframeSequence(sequence)
            end
            local played = false
            if p.rigPath and p.rigPath ~= "" then
                local rig = resolvePath(p.rigPath); if not rig then error("Preview rig not found") end
                local host = rig:FindFirstChildOfClass("Humanoid") or rig:FindFirstChildOfClass("AnimationController")
                if not host then error("Rig needs a Humanoid or AnimationController") end
                local animator = host:FindFirstChildOfClass("Animator") or Instance.new("Animator")
                animator.Parent = host
                local animation = Instance.new("Animation"); animation.AnimationId = temporaryId
                local loaded, track = pcall(function() return animator:LoadAnimation(animation) end)
                if not loaded and registrationMode == "active" then
                    registrationMode = "hash"
                    temporaryId = KeyframeSequenceProvider:RegisterKeyframeSequence(sequence)
                    animation.AnimationId = temporaryId
                    loaded, track = pcall(function() return animator:LoadAnimation(animation) end)
                end
                if not loaded then error("Animation preview could not load: " .. tostring(track)) end
                track.Looped = p.looped == true
                track:Play(0.1, 1, tonumber(p.speed) or 1)
                played = true
            end
            return { success = true, message = played and "Animation preview started" or "Temporary animation ID registered", data = { temporaryAnimationId = temporaryId, registrationMode = registrationMode, studioOnly = true, played = played } }
        elseif command.tool == "create_tween" then
            local target = resolvePath(p.path); if not target then error("Tween target not found: " .. p.path) end
            local parent = resolvePath(p.scriptParent or "ServerScriptService"); if not parent then error("Tween script parent not found") end
            local goalLines = {}
            for key, rawValue in pairs(p.goals or {}) do
                local decoded = decodeProperty(target, key, rawValue)
                table.insert(goalLines, string.format("    [%q] = %s,", key, toLuaLiteral(decoded)))
            end
            if #goalLines == 0 then error("Tween goals cannot be empty") end
            local source = table.concat({
                "local TweenService = game:GetService(\"TweenService\")",
                "local function resolve(path)",
                "    local current = game",
                "    for segment in string.gmatch(path, \"[^%.]+\") do",
                "        if segment ~= \"game\" then current = current and current:FindFirstChild(segment) end",
                "    end",
                "    return current",
                "end",
                string.format("local target = assert(resolve(%q), \"Tween target missing\")", p.path),
                string.format("local info = TweenInfo.new(%s, Enum.EasingStyle.%s, Enum.EasingDirection.%s, %d, %s)", tonumber(p.duration) or 1, p.easingStyle or "Quad", p.easingDirection or "Out", p.looping and -1 or 0, tostring(p.reverses == true)),
                "local goals = {",
                table.concat(goalLines, "\n"),
                "}",
                "TweenService:Create(target, info, goals):Play()"
            }, "\n")
            local scriptObject = Instance.new("Script"); scriptObject.Name = p.scriptName or (target.Name .. "Tween"); scriptObject.Source = source; scriptObject.Parent = parent
            return { success = true, message = "Created tween script " .. scriptObject:GetFullName(), data = { target = target:GetFullName() } }
        elseif command.tool == "capture_viewport" then
            local camera = workspace.CurrentCamera
            return { success = true, data = { cameraCFrame = encodeValue(camera.CFrame), fieldOfView = camera.FieldOfView, note = "Direct viewport pixels are not exposed to Studio plugins" } }
        elseif command.tool == "run_playtest" then
            if not RunService:IsRunning() then
                return { success = false, error = "Studio is not in Play mode. Ask the user to press Play, then call run_playtest again." }
            end
            local errorStart, messageStart = #runtimeErrors + 1, #runtimeMessages + 1
            local duration = math.clamp(tonumber(p.durationSeconds) or 3, 0.25, 15)
            task.wait(duration)
            local observation = runtimeObservation(errorStart, messageStart)
            local assertions, passed = {}, true
            for _, assertion in ipairs(p.assertions or {}) do
                local assertionResult = evaluateAssertion(assertion, observation)
                table.insert(assertions, assertionResult)
                if not assertionResult.passed then passed = false end
            end
            return {
                success = passed,
                message = passed and "Runtime observation passed" or "One or more runtime assertions failed",
                data = { durationSeconds = duration, observation = observation, assertions = assertions }
            }
        elseif command.tool == "get_runtime_observation" then
            local observation = runtimeObservation(1, 1)
            if p.clearAfterRead then runtimeErrors, runtimeMessages = {}, {} end
            return { success = true, data = observation }
        elseif command.tool == "validate_project" then
            local validationRoot = (p.root and resolvePath(p.root)) or game
            if not validationRoot then error("Validation root not found") end
            local issues = {}
            for _, item in ipairs(validationRoot:GetDescendants()) do
                if item:IsA("LuaSourceContainer") and item.Source:match("^%s*$") then
                    table.insert(issues, { severity = "warning", path = item:GetFullName(), message = "Script source is empty" })
                end
                if item:IsA("LocalScript") and item:IsDescendantOf(game:GetService("ServerScriptService")) then
                    table.insert(issues, { severity = "error", path = item:GetFullName(), message = "LocalScript cannot run in ServerScriptService" })
                end
                local siblingCount = 0
                if item.Parent then
                    for _, sibling in ipairs(item.Parent:GetChildren()) do if sibling.Name == item.Name then siblingCount += 1 end end
                end
                if siblingCount > 1 then
                    table.insert(issues, { severity = "warning", path = item:GetFullName(), message = "Duplicate sibling name" })
                end
            end
            local errors = 0
            for _, issue in ipairs(issues) do if issue.severity == "error" then errors += 1 end end
            return { success = errors == 0, message = errors == 0 and "Structural validation passed" or "Structural validation found errors", data = { issues = issues, errorCount = errors } }
        elseif command.tool == "upload_animation_asset" then
            local sequence = resolvePath(p.keyframeSequencePath)
            if not sequence or not sequence:IsA("KeyframeSequence") then error("KeyframeSequence not found") end
            sequence.Name = p.name or sequence.Name
            Selection:Set({ sequence })
            plugin:SaveSelectedToRoblox()
            return {
                success = true,
                message = "Roblox native upload window opened. Complete publishing in Studio, then provide the resulting animation asset ID.",
                data = { requiresUserCompletion = true, assetId = nil, selectedPath = sequence:GetFullName() }
            }
        elseif command.tool == "search_toolbox" then
            local query = tostring(p.query or "")
            if query == "" then error("Toolbox query cannot be empty") end
            local wrapped = InsertService:GetFreeModelsAsync(query, math.clamp(tonumber(p.page) or 0, 0, 20))
            local page = wrapped[1] or wrapped
            local results = {}
            for _, item in ipairs(page.Results or {}) do
                table.insert(results, {
                    assetId = item.AssetId, assetVersionId = item.AssetVersionId,
                    name = item.Name, creatorName = item.CreatorName,
                    creatorId = item.CreatorId, description = item.Description
                })
                if #results >= 30 then break end
            end
            return { success = true, data = { query = query, results = results, count = #results, provenance = "Roblox Creator Store" } }
        elseif command.tool == "quarantine_toolbox_asset" then
            local assetId = tonumber(p.assetId); if not assetId then error("assetId must be numeric") end
            pcall(function() AssetService.AllowInsertFreeAssets = true end)
            local loaded = AssetService:LoadAssetAsync(assetId)
            if not loaded then error("Roblox returned no model for asset " .. assetId) end
            local serverStorage = game:GetService("ServerStorage")
            local quarantine = serverStorage:FindFirstChild("AgentAssetQuarantine") or Instance.new("Folder")
            quarantine.Name = "AgentAssetQuarantine"; quarantine.Parent = serverStorage
            loaded.Name = "Asset_" .. assetId
            loaded:SetAttribute("AgentSource", "RobloxCreatorStore")
            loaded:SetAttribute("AgentAssetId", assetId)
            loaded:SetAttribute("AgentImportedAt", DateTime.now():ToIsoDate())
            loaded.Parent = quarantine
            local report = scanAssetScripts(loaded)
            local sandboxed = nil
            local sandboxReadable, sandboxValue = pcall(function() return loaded.Sandboxed end)
            if sandboxReadable then sandboxed = sandboxValue end
            return {
                success = true,
                message = "Asset loaded into quarantine; review the scan before approval",
                data = { quarantinePath = loaded:GetFullName(), assetId = assetId, scan = report, sandboxed = sandboxed }
            }
        elseif command.tool == "approve_quarantined_asset" then
            local asset = resolvePath(p.quarantinePath)
            local quarantine = game:GetService("ServerStorage"):FindFirstChild("AgentAssetQuarantine")
            if not asset or not quarantine or not asset:IsDescendantOf(quarantine) then error("Asset is not inside AgentAssetQuarantine") end
            local target = resolvePath(p.parent); if not target then error("Destination parent not found") end
            local report = scanAssetScripts(asset)
            if p.allowScripts == true and report.suspiciousCount > 0 then
                error("Approval blocked: suspicious scripts must be removed or reviewed before executable insertion")
            end
            local removedScripts = 0
            if p.allowScripts ~= true then
                for _, item in ipairs(asset:GetDescendants()) do
                    if item:IsA("LuaSourceContainer") then item:Destroy(); removedScripts += 1 end
                end
            end
            asset.Parent = target
            asset:SetAttribute("AgentApproved", true)
            asset:SetAttribute("AgentScriptsRemoved", removedScripts)
            return { success = true, message = "Approved asset inserted at " .. asset:GetFullName(), data = { path = asset:GetFullName(), removedScripts = removedScripts, provenance = { source = "RobloxCreatorStore", assetId = asset:GetAttribute("AgentAssetId") } } }
        elseif command.tool == "generate_external_asset" then
            return { success = false, error = "External generation runs on the backend and should not be routed to Studio" }
        end
        return { success = false, error = "Unsupported tool: " .. command.tool }
    end)
    local succeeded = ok and result and result.success == true
    if recording then
        pcall(function()
            ChangeHistoryService:FinishRecording(recording, succeeded and Enum.FinishRecordingOperation.Commit or Enum.FinishRecordingOperation.Cancel)
        end)
    end
    if not ok then return { success = false, error = tostring(result) } end
    return result
end

local activeTaskId = nil
local function heartbeat()
    local connected, err = request("POST", "/api/studio/connect", { sessionId = SESSION_ID, snapshot = snapshot() })
    status.Text = connected and "Connected • " .. SESSION_ID:sub(1, 8) or "Offline • " .. tostring(err)
    if not connected then return end
    local polled = request("GET", "/api/studio/commands/" .. SESSION_ID)
    if polled and polled.command then
        local result = execute(polled.command)
        request("POST", "/api/studio/results/" .. polled.command.id, result)
        output.Text = result.message or result.error or "Command complete"
    end
    if activeTaskId then
        local taskData = request("GET", "/api/agent/tasks/" .. activeTaskId)
        if taskData then
            status.Text = "Agent: " .. tostring(taskData.state or taskData.status)
            if taskData.status ~= "running" then
                output.Text = taskData.error or (taskData.result and taskData.result.message) or "Task finished"
                activeTaskId = nil; runButton.Active = true; runButton.Text = "Build with Agent"
            end
        end
    end
end

runButton.MouseButton1Click:Connect(function()
    if isConfirming or activeTaskId or input.Text == "" then return end
    local response, err = request("POST", "/api/agent/tasks", { sessionId = SESSION_ID, message = input.Text })
    if not response then output.Text = err; return end
    activeTaskId = response.taskId; runButton.Active = false; runButton.Text = "Agent working…"
end)

toggleButton.Click:Connect(function() widget.Enabled = not widget.Enabled end)
task.spawn(function() while true do heartbeat(); task.wait(1) end end)
