# PROJECT TREE

```txt
- .pio
  - libdeps
    - esp32
      - UDCP
        - README.md
        - library.properties
        - src
          - UDCP.cpp
          - UDCP.h
          - UDCPConfig.h
          - UDCPEvents.h
- data
  - css
    - app.css
  - index.html
  - js
    - app.js
    - client.js
    - components
      - about.js
      - dashboard.js
      - debugger.js
      - desktop.js
      - events.js
      - ide.js
      - messages.js
      - modules.js
      - profiler.js
      - rules.js
      - scripts.js
      - settings.js
      - shell.js
      - taskbar.js
      - taskman.js
      - terminal.js
      - window.js
    - utils
      - format.js
      - state.js
      - theme.js
    - vendor
      - htm.min.js
      - preact.min.js
      - signals.min.js
- platformio.ini
- src
  - API
    - Engine.h
    - PluginSDK.h
    - SerialConsole.h
  - Bridge
    - UDCPBridge.h
  - Core
    - Core.h
    - Error.h
    - Logger.cpp
    - Logger.h
    - ResourceQuota.h
  - Debug
    - Debugger.cpp
    - Debugger.h
    - Disassembler.h
    - Profiler.cpp
    - Profiler.h
  - Globals.cpp
  - Lang
    - Compiler.cpp
    - Compiler.h
    - Lexer.cpp
    - Lexer.h
    - Parser.cpp
    - Parser.h
  - Modules.cpp
  - Modules.h
  - Net
    - HttpClient.cpp
    - HttpClient.h
    - MqttClient.cpp
    - MqttClient.h
  - Runtime
    - EventBus.cpp
    - EventBus.h
    - MemoryMonitor.h
    - MessageBus.cpp
    - MessageBus.h
    - ModuleLoader.cpp
    - ModuleLoader.h
    - RuleEngine.cpp
    - RuleEngine.h
    - RuntimeIds.h
    - Scheduler.cpp
    - Scheduler.h
    - SnapshotManager.h
  - Security
    - AccessControl.h
    - ScriptSigner.h
  - Stdlib
    - MathLib.cpp
    - MathLib.h
    - StorageLib.cpp
    - StorageLib.h
    - StringLib.cpp
    - StringLib.h
    - TimeLib.cpp
    - TimeLib.h
  - Tools
    - CLI.h
  - VM
    - StackTrace.h
    - VM.cpp
    - VM.h
  - main.cpp
  - main_cli.cpp
```

### platformio.ini
```
[env:esp32]platform = espressif32board = esp32devframework = arduinomonitor_speed = 115200board_build.partitions = min_spiffs.csvboard_build.filesystem = spiffslib_deps =    bblanchon/ArduinoJson @ ^6.21.0    links2004/WebSockets @ ^2.4.0build_flags =    -std=gnu++17    -DCONFIG_ARDUINO_LOOP_STACK_SIZE=16384    -DCORE_DEBUG_LEVEL=2build_unflags =    -std=gnu++11
```

### src\main.cpp
```
#ifdef ARDUINO#include <Arduino.h>#include <WiFi.h>#include <SPIFFS.h>#include <UDCP.h>#include "API/Engine.h"#include "API/SerialConsole.h"#include "API/PluginSDK.h"#include "Bridge/UDCPBridge.h"#include "Modules.h"#include "Runtime/ModuleLoader.h"UDCP udcp;Engine engine;SerialConsole console(engine);UDCPBridge* bridge = nullptr;constexpr int LED_BUILTIN = 2;void serveFile(const String& path, const String& contentType) {    File file = SPIFFS.open(path, "r");    if (!file) {        udcp.httpSend(404, "text/plain", "Not Found: " + path);        return;    }    String content = file.readString();    file.close();    udcp.httpSend(200, contentType, content);}void setupRoutes() {    udcp.route("/", HTTP_GET, []() { serveFile("/index.html", "text/html"); });    udcp.route("/css/app.css", HTTP_GET, []() { serveFile("/css/app.css", "text/css"); });    const char* jsFiles[] = {        "/js/vendor/preact.min.js", "/js/vendor/htm.min.js",        "/js/vendor/signals.min.js", "/js/client.js",        "/js/utils/state.js", "/js/utils/format.js", "/js/utils/theme.js",        "/js/components/shell.js", "/js/components/window.js",        "/js/components/taskbar.js", "/js/components/desktop.js",        "/js/components/terminal.js", "/js/components/ide.js",        "/js/components/taskman.js", "/js/components/dashboard.js",        "/js/components/modules.js", "/js/components/debugger.js",        "/js/components/profiler.js", "/js/components/messages.js",        "/js/components/events.js", "/js/components/rules.js",        "/js/components/scripts.js", "/js/components/settings.js",        "/js/components/about.js", "/js/app.js"    };    for (const char* path : jsFiles) {        String p = path;        udcp.route(p, HTTP_GET, [p]() {            serveFile(p, "application/javascript");        });    }    udcp.routeNotFound([]() {        udcp.httpSend(404, "application/json", "{\"error\":\"not_found\"}");    });}void setup() {    Serial.begin(115200);    delay(1000);    Serial.println("\n=== EspDSL Web OS ===\n");    if (!SPIFFS.begin(true)) {        Serial.println("SPIFFS FAIL!");        return;    }    Serial.printf("SPIFFS: %dKB used / %dKB total\n",                  SPIFFS.usedBytes() / 1024,                  SPIFFS.totalBytes() / 1024);    registerBuiltinModules();    registerRuntimeModules();    PluginBuilder pb("hw");    pb.func("led", [](int c, VMValue* a) -> VMValue {        if (c > 0) {            pinMode(LED_BUILTIN, OUTPUT);            digitalWrite(LED_BUILTIN, a[0].toInt() ? HIGH : LOW);        }        return VMValue::Bool(true);    });    pb.func("adc", [](int c, VMValue* a) -> VMValue {        if (c > 0) return VMValue::Int(analogRead(a[0].toInt()));        return VMValue::Int(0);    });    pb.func("millis", [](int c, VMValue* a) -> VMValue {        return VMValue::Int((int32_t)millis());    });    pb.build();    engine.setPlatform({        []() -> uint32_t { return ESP.getFreeHeap(); },        []() -> uint32_t { return ESP.getHeapSize(); },        []() -> float { return 0.0f; },        []() -> uint32_t { return millis(); }    });    g_moduleLoader.setFileReader([](const std::string& path,                                    std::vector<uint8_t>& out) -> bool {        File f = SPIFFS.open(path.c_str(), "r");        if (!f) return false;        size_t size = f.size();        out.resize(size);        f.read(out.data(), size);        f.close();        return true;    });    g_moduleLoader.addSearchPath("/modules");    console.setOutput([](const std::string& s) {        Serial.print(s.c_str());    });    UDCPConfig cfg;    cfg.apSSID      = "EspDSL-WebOS";    cfg.apPassword  = "espdsl123";    cfg.httpEnabled = true;    cfg.httpPort    = 80;    cfg.wsEnabled   = true;    cfg.wsPort      = 8080;    cfg.udpEnabled  = false;    cfg.authToken   = "espdsl-token";    cfg.deviceId    = "espdsl-01";    bridge = new UDCPBridge(engine, console, udcp);    udcp.onPacket([](const UDCPPacket& pkt) {        String response = bridge->processPacket(pkt);        if (pkt.protocol == "WS") udcp.broadcast(response);        else if (pkt.protocol == "HTTP") udcp.httpSend(200, "application/json", response);    });    udcp.onClientConnect([](const UDCPClientInfo& info) {        Serial.printf("[WS] Client #%d: %s\n", info.id, info.ip.c_str());    });    udcp.begin(cfg);    setupRoutes();    Serial.println("\n=== Ready ===");    Serial.println("WiFi: EspDSL-WebOS / espdsl123");    Serial.println("Web:  http://192.168.4.1");    Serial.println("WS:   ws://192.168.4.1:8080");    Serial.println("Serial console active\n");}void loop() {    udcp.loop();    while (Serial.available()) {        String line = Serial.readStringUntil('\n');        line.trim();        if (line.length() > 0)            console.processLine(line.c_str());    }    if (engine.isRunning())        engine.tick(10);    static unsigned long lastBC = 0;    if (millis() - lastBC >= 2000 && udcp.getClientCount() > 0) {        lastBC = millis();        String s = "{\"type\":\"status_update\",\"uptime\":" +                   String(millis()) +                   ",\"running\":" + (engine.isRunning() ? "true" : "false") +                   ",\"tasks\":" + String(engine.taskCount()) +                   ",\"freeHeap\":" + String(ESP.getFreeHeap()) + "}";        udcp.broadcast(s);    }    delay(1);}#else#include "API/Engine.h"#include "API/PluginSDK.h"#include "API/SerialConsole.h"#include "Modules.h"#include "Core/Logger.h"#include "Core/Error.h"#include "Runtime/MessageBus.h"#include "Runtime/EventBus.h"#include "Runtime/RuleEngine.h"#include "Security/ScriptSigner.h"int gP = 0, gF = 0, gT = 0;bool runDSL(const char* title, const char* code, bool expectErr = false) {    gT++; std::cout << "\n── " << title << " ──\n";    try {        Engine eng;        auto r = eng.compile(code);        if (!r.ok) {            if (expectErr) { gP++; std::cout << "  ✓ Expected\n"; return true; }            std::cerr << "  ✗ " << r.error << "\n"; gF++; return false;        }        eng.run();        if (expectErr) { gF++; return false; }        std::cout << "  ✓ OK\n"; gP++; return true;    } catch (const std::exception& e) {        if (expectErr) { gP++; std::cout << "  ✓ Expected\n"; return true; }        std::cerr << "  ✗ " << e.what() << "\n"; gF++; return false;    }}int main() {    g_logger.setLevel(LogLevel::WARN);    registerBuiltinModules();    registerRuntimeModules();    std::cout << "=== EspDSL Tests ===\n";    runDSL("Arithmetic", "PROGRAM T SET x=10+5 PRINT x ENDPROGRAM");    runDSL("Recursion", "PROGRAM T FUNC f(n) IF n<=1 THEN RETURN 1 ENDIF RETURN n*f(n-1) ENDFUNC PRINT f(5) ENDPROGRAM");    runDSL("Arrays", "PROGRAM T SET a=[1,2,3] PRINT a PRINT LEN(a) ENDPROGRAM");    runDSL("WHILE", "PROGRAM T SET x=0 WHILE x<5 PRINT x SET x=x+1 ENDWHILE ENDPROGRAM");    runDSL("FOR", "PROGRAM T FOR i=1 TO 5 PRINT i ENDFOR ENDPROGRAM");    runDSL("BREAK", "PROGRAM T SET x=0 WHILE TRUE SET x=x+1 IF x==3 THEN BREAK ENDIF ENDWHILE PRINT x ENDPROGRAM");    runDSL("Ternary", "PROGRAM T SET r=10>5?1:0 PRINT r ENDPROGRAM");    runDSL("Modulo", "PROGRAM T PRINT 10%3 ENDPROGRAM");    runDSL("Logic", "PROGRAM T IF 5<10 AND 3>1 THEN PRINT 1 ENDIF ENDPROGRAM");    runDSL("Concat", "PROGRAM T PRINT CONCAT(\"a\",\"b\") ENDPROGRAM");    runDSL("Scope", "PROGRAM T SET x=1 FUNC g() SET x=2 RETURN x ENDFUNC PRINT g() PRINT x ENDPROGRAM");    runDSL("Tasks", "PROGRAM T TASK W PRINT 42 ENDTASK PRINT 0 ENDPROGRAM");    runDSL("Quota", "PROGRAM T LOOP SET x=1 ENDLOOP ENDPROGRAM", true);    runDSL("BREAK outside", "PROGRAM T BREAK ENDPROGRAM", true);    std::cout << "\n=== Results: " << gP << "/" << gT << " passed";    if (gF > 0) std::cout << " (" << gF << " FAILED)";    std::cout << " ===\n";    return gF > 0 ? 1 : 0;}#endif
```

### data\index.html
```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EspDSL Web OS</title>
    <link rel="stylesheet" href="css/app.css">
</head>
<body>
    <div id="app"></div>
    <script>
        window.COMPONENT_RENDERERS = {};
    </script>
    <!-- Vendor -->
    <script src="js/vendor/preact.min.js"></script>
    <script src="js/vendor/htm.min.js"></script>
    <script src="js/vendor/signals.min.js"></script>
    <!-- Core -->
    <script src="js/client.js"></script>
    <script src="js/utils/state.js"></script>
    <script src="js/utils/format.js"></script>
    <script src="js/utils/theme.js"></script>
    <!-- Components -->
    <script src="js/components/window.js"></script>
    <script src="js/components/taskbar.js"></script>
    <script src="js/components/desktop.js"></script>
    <script src="js/components/shell.js"></script>
    <script src="js/components/terminal.js"></script>
    <script src="js/components/ide.js"></script>
    <script src="js/components/taskman.js"></script>
    <script src="js/components/dashboard.js"></script>
    <script src="js/components/modules.js"></script>
    <script src="js/components/debugger.js"></script>
    <script src="js/components/profiler.js"></script>
    <script src="js/components/messages.js"></script>
    <script src="js/components/events.js"></script>
    <script src="js/components/rules.js"></script>
    <script src="js/components/scripts.js"></script>
    <script src="js/components/settings.js"></script>
    <script src="js/components/about.js"></script>
    <!-- App -->
    <script src="js/app.js"></script>
</body>
</html>
```

### src\Globals.cpp
```
#include "Core/Error.h"
#include "Core/Logger.h"
DiagnosticEngine g_diagnostics;
```

### src\Modules.cpp
```
#include "Modules.h"
#include "VM/VM.h"
#include "Stdlib/MathLib.h"
#include "Stdlib/StringLib.h"
#include "Stdlib/TimeLib.h"
#include "Stdlib/StorageLib.h"
#include "Net/HttpClient.h"
#include "Net/MqttClient.h"
#include "Runtime/MessageBus.h"
#include "Runtime/EventBus.h"
#include "Runtime/RuleEngine.h"
#include <iostream>
static VMValue gpio_write(int c, VMValue *a)
{
    if (c < 2)
        return VMValue::Bool(false);
    std::cout << "[HW] GPIO " << a[0].toInt() << " -> " << a[1].toInt() << "\n";
    return VMValue::Bool(true);
}
static VMValue gpio_read(int c, VMValue *a)
{
    if (c < 1)
        return VMValue::Int(0);
    std::cout << "[HW] GPIO READ " << a[0].toInt() << "\n";
    return VMValue::Int(1);
}
static VMValue gpio_mode(int c, VMValue *a)
{
    if (c < 2)
        return VMValue::Bool(false);
    std::cout << "[HW] GPIO MODE " << a[0].toInt() << "=" << a[1].toInt() << "\n";
    return VMValue::Bool(true);
}
static ModuleFuncEntry gpio_m[] = {{"write", gpio_write}, {"read", gpio_read}, {"mode", gpio_mode}};
static VMValue serial_print(int c, VMValue *a)
{
    for (int i = 0; i < c; i++)
    {
        std::cout << a[i].toString();
        if (i < c - 1)
            std::cout << " ";
    }
    std::cout << "\n";
    return VMValue::None();
}
static ModuleFuncEntry serial_m[] = {{"print", serial_print}};
static VMValue msg_send(int c, VMValue *a)
{
    if (c < 3)
        return VMValue::Bool(false);
    return VMValue::Bool(g_messageBus.send(INVALID_TASK, (TaskId)a[0].toInt(), (TopicId)a[1].toInt(), a[2]));
}
static VMValue msg_has(int c, VMValue *a)
{
    if (c < 1)
        return VMValue::Bool(false);
    return VMValue::Bool(g_messageBus.has((TaskId)a[0].toInt()));
}
static VMValue msg_count(int c, VMValue *a)
{
    if (c < 1)
        return VMValue::Int(0);
    return VMValue::Int(g_messageBus.count((TaskId)a[0].toInt()));
}
static ModuleFuncEntry msg_m[] = {{"send", msg_send}, {"has", msg_has}, {"count", msg_count}};
static VMValue evt_emit(int c, VMValue *a)
{
    if (c < 1)
        return VMValue::Bool(false);
    VMValue p = (c >= 2) ? a[1] : VMValue::None();
    return VMValue::Bool(g_eventBus.emit((EventId)a[0].toInt(), INVALID_TASK, p));
}
static VMValue evt_pending(int c, VMValue *a) { return VMValue::Int(g_eventBus.pending()); }
static ModuleFuncEntry evt_m[] = {{"emit", evt_emit}, {"pending", evt_pending}};
static VMValue rule_set(int c, VMValue *a)
{
    if (c < 2)
        return VMValue::Bool(false);
    g_ruleEngine.setMetric((uint8_t)a[0].toInt(), a[1].toFloat());
    return VMValue::Bool(true);
}
static VMValue rule_get(int c, VMValue *a)
{
    if (c < 1)
        return VMValue::Float(0);
    return VMValue::Float(g_ruleEngine.getMetric((uint8_t)a[0].toInt()));
}
static ModuleFuncEntry rule_m[] = {{"set", rule_set}, {"get", rule_get}};
int findModuleId(const std::string &name) { return g_moduleRegistry.findModule(name); }
int findFuncId(int m, const std::string &f) { return g_moduleRegistry.findFunc(m, f); }
void registerBuiltinModules()
{
    g_moduleRegistry.registerModule({"gpio", 1, gpio_m, 3});
    g_moduleRegistry.registerModule({"serial", 1, serial_m, 1});
    registerMathModule();
    registerStringModule();
    registerTimeModule();
    registerStorageModule();
    registerHttpModule();
    registerMqttModule();
}
void registerRuntimeModules()
{
    g_moduleRegistry.registerModule({"msg", 1, msg_m, 3});
    g_moduleRegistry.registerModule({"event", 1, evt_m, 2});
    g_moduleRegistry.registerModule({"rule", 1, rule_m, 2});
}
```

### src\main_cli.cpp
```
#include "Tools/CLI.h"
#include "Core/Logger.h"
#include "Core/Error.h"
int main(int argc, char **argv)
{
    g_logger.setLevel(LogLevel::WARN);
    CLITool cli;
    return cli.run(argc, argv);
}
```

### src\Modules.h
```
#ifndef ESPDSL_MODULES_H
#define ESPDSL_MODULES_H
void registerBuiltinModules();
void registerRuntimeModules();
#endif
```

### data\css\app.css
```
/* ============================================================
   EspDSL Web OS — Complete Stylesheet
   ============================================================ */
:root {
    --bg-desktop: #1a1a2e;
    --bg-taskbar: #16213e;
    --bg-window: #1e1e2e;
    --bg-titlebar: #2d2d44;
    --bg-input: #252540;
    --bg-panel: #1a1a30;
    --bg-hover: #2a2a4a;
    --bg-active: #3a3a5a;
    --bg-button: #3a3a5a;
    --bg-button-hover: #4a4a6a;
    --bg-success: #2d5a3d;
    --bg-error: #5a2d2d;
    --bg-warning: #5a4a2d;
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0b0;
    --text-muted: #606070;
    --text-accent: #7aa2f7;
    --text-success: #9ece6a;
    --text-error: #f7768e;
    --text-warning: #e0af68;
    --text-string: #9ece6a;
    --text-number: #ff9e64;
    --text-keyword: #bb9af7;
    --text-comment: #565f89;
    --border: #333355;
    --border-focus: #7aa2f7;
    --shadow: rgba(0,0,0,0.4);
    --font-mono: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
    --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --taskbar-height: 44px;
    --titlebar-height: 32px;
    --radius: 8px;
    --radius-sm: 4px;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: var(--font-ui);
    background: var(--bg-desktop);
    color: var(--text-primary);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
    user-select: none;
}
#app { height: 100vh; display: flex; flex-direction: column; }
/* ── Desktop ── */
.desktop {
    flex: 1;
    position: relative;
    overflow: hidden;
    background:
        radial-gradient(ellipse at 20% 50%, rgba(122,162,247,0.08) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(187,154,247,0.06) 0%, transparent 50%),
        var(--bg-desktop);
}
.desktop-icons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 16px;
    align-content: flex-start;
}
.desktop-icon {
    width: 80px;
    height: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background 0.15s;
    padding: 8px;
}
.desktop-icon:hover { background: rgba(255,255,255,0.08); }
.desktop-icon:active { background: rgba(255,255,255,0.12); }
.desktop-icon .icon { font-size: 28px; }
.desktop-icon .label { font-size: 11px; color: var(--text-secondary); text-align: center; line-height: 1.2; }
/* ── Taskbar ── */
.taskbar {
    height: var(--taskbar-height);
    background: var(--bg-taskbar);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 8px;
    gap: 4px;
    z-index: 1000;
}
.taskbar-start {
    padding: 4px 12px;
    background: var(--bg-button);
    border: none;
    color: var(--text-accent);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: bold;
    font-size: 13px;
}
.taskbar-start:hover { background: var(--bg-button-hover); }
.taskbar-items { display: flex; gap: 2px; flex: 1; overflow-x: auto; }
.taskbar-item {
    padding: 4px 12px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-secondary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
}
.taskbar-item:hover { background: var(--bg-hover); }
.taskbar-item.active { background: var(--bg-active); border-color: var(--border); color: var(--text-primary); }
.taskbar-clock {
    font-size: 12px;
    color: var(--text-secondary);
    padding: 0 8px;
    font-family: var(--font-mono);
}
.taskbar-status {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 11px;
    color: var(--text-muted);
    padding: 0 8px;
}
.status-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    display: inline-block;
}
.status-dot.connected { background: var(--text-success); }
.status-dot.disconnected { background: var(--text-error); }
/* ── Window ── */
.window {
    position: absolute;
    background: var(--bg-window);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 32px var(--shadow);
    display: flex;
    flex-direction: column;
    min-width: 320px;
    min-height: 200px;
    overflow: hidden;
}
.window.focused { border-color: var(--border-focus); box-shadow: 0 8px 40px rgba(122,162,247,0.15); }
.window.maximized { border-radius: 0; border: none; }
.window-titlebar {
    height: var(--titlebar-height);
    background: var(--bg-titlebar);
    display: flex;
    align-items: center;
    padding: 0 8px;
    gap: 8px;
    cursor: grab;
    flex-shrink: 0;
}
.window-titlebar:active { cursor: grabbing; }
.window-title { flex: 1; font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.window-controls { display: flex; gap: 4px; }
.window-btn {
    width: 20px; height: 20px;
    border: none; border-radius: 50%;
    cursor: pointer;
    font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    color: var(--text-primary);
    background: transparent;
}
.window-btn:hover { background: var(--bg-hover); }
.window-btn.close:hover { background: var(--text-error); }
.window-btn.minimize:hover { background: var(--text-warning); }
.window-btn.maximize:hover { background: var(--text-success); }
.window-content {
    flex: 1;
    overflow: auto;
    padding: 0;
}
.window-resize {
    position: absolute;
    right: 0; bottom: 0;
    width: 16px; height: 16px;
    cursor: nwse-resize;
}
/* ── Panels ── */
.panel {
    padding: 12px;
    height: 100%;
    overflow-y: auto;
}
.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
}
.panel-title { font-size: 14px; font-weight: 600; color: var(--text-accent); }
/* ── Toolbar ── */
.toolbar {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    background: var(--bg-panel);
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
}
.btn {
    padding: 4px 10px;
    background: var(--bg-button);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 12px;
    font-family: var(--font-ui);
    transition: background 0.1s;
    white-space: nowrap;
}
.btn:hover { background: var(--bg-button-hover); }
.btn:active { background: var(--bg-active); }
.btn.primary { background: #2d4a8a; border-color: #3d5a9a; }
.btn.primary:hover { background: #3d5a9a; }
.btn.danger { background: #5a2d2d; border-color: #6a3d3d; }
.btn.danger:hover { background: #6a3d3d; }
.btn.success { background: #2d5a3d; border-color: #3d6a4d; }
.btn.success:hover { background: #3d6a4d; }
.btn.small { padding: 2px 6px; font-size: 11px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-group { display: flex; gap: 2px; }
/* ── Tables ── */
.table-wrap { overflow-x: auto; }
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}
th {
    text-align: left;
    padding: 6px 8px;
    background: var(--bg-panel);
    color: var(--text-accent);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    position: sticky;
    top: 0;
}
td {
    padding: 5px 8px;
    border-bottom: 1px solid rgba(51,51,85,0.5);
    color: var(--text-primary);
}
tr:hover td { background: var(--bg-hover); }
/* ── Forms ── */
input, select, textarea {
    background: var(--bg-input);
    border: 1px solid var(--border);
    color: var(--text-primary);
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    font-size: 12px;
    font-family: var(--font-ui);
    outline: none;
}
input:focus, select:focus, textarea:focus { border-color: var(--border-focus); }
/* ── Terminal ── */
.terminal {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    background: #0a0a14;
    color: #c0c0d0;
    height: 100%;
    display: flex;
    flex-direction: column;
}
.terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    white-space: pre-wrap;
    word-break: break-all;
}
.terminal-input-line {
    display: flex;
    align-items: center;
    padding: 4px 8px;
    background: rgba(255,255,255,0.03);
    border-top: 1px solid var(--border);
}
.terminal-prompt { color: var(--text-accent); margin-right: 8px; font-weight: bold; }
.terminal-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 13px;
    outline: none;
}
.term-error { color: var(--text-error); }
.term-success { color: var(--text-success); }
.term-info { color: var(--text-accent); }
.term-warn { color: var(--text-warning); }
/* ── Code Editor ── */
.editor-container {
    height: 100%;
    display: flex;
    flex-direction: column;
}
.editor-area {
    flex: 1;
    position: relative;
    overflow: hidden;
}
.code-editor {
    width: 100%;
    height: 100%;
    background: #0d1117;
    color: #e0e0e0;
    font-family: var(--font-mono);
    font-size: 14px;
    line-height: 1.6;
    padding: 12px;
    border: none;
    resize: none;
    outline: none;
    tab-size: 4;
    white-space: pre;
    overflow: auto;
}
.editor-status {
    display: flex;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--bg-panel);
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--text-muted);
}
.editor-output {
    height: 150px;
    overflow-y: auto;
    padding: 8px;
    background: #0a0a14;
    font-family: var(--font-mono);
    font-size: 12px;
    border-top: 1px solid var(--border);
    white-space: pre-wrap;
}
/* ── Dashboard ── */
.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 12px;
    padding: 12px;
}
.dash-card {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
}
.dash-card-title {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}
.dash-value {
    font-size: 28px;
    font-weight: bold;
    color: var(--text-accent);
    font-family: var(--font-mono);
}
.dash-value.small { font-size: 18px; }
.dash-sub {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
}
.progress-bar {
    height: 6px;
    background: var(--bg-input);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 8px;
}
.progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s;
}
.progress-fill.green { background: var(--text-success); }
.progress-fill.blue { background: var(--text-accent); }
.progress-fill.red { background: var(--text-error); }
.progress-fill.yellow { background: var(--text-warning); }
.chart-container {
    width: 100%;
    height: 120px;
    position: relative;
}
/* ── Tags & Badges ── */
.tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 600;
}
.tag.running { background: var(--bg-success); color: var(--text-success); }
.tag.paused { background: var(--bg-warning); color: var(--text-warning); }
.tag.halted { background: var(--bg-error); color: var(--text-error); }
.tag.active { background: #2d4a3a; color: #6ace8a; }
.tag.inactive { background: #3a2d2d; color: #ce6a6a; }
/* ── Splits ── */
.split-h { display: flex; height: 100%; }
.split-v { display: flex; flex-direction: column; height: 100%; }
.split-left { width: 50%; border-right: 1px solid var(--border); }
.split-right { flex: 1; }
.split-top { flex: 1; border-bottom: 1px solid var(--border); }
.split-bottom { height: 200px; }
/* ── Tabs ── */
.tabs { display: flex; background: var(--bg-panel); border-bottom: 1px solid var(--border); }
.tab {
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    transition: all 0.1s;
}
.tab:hover { color: var(--text-primary); background: var(--bg-hover); }
.tab.active { color: var(--text-accent); border-bottom-color: var(--text-accent); }
/* ── Scrollbar ── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
/* ── Animations ── */
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.window { animation: fadeIn 0.15s ease-out; }
/* ── Context Menu ── */
.context-menu {
    position: fixed;
    background: var(--bg-window);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    box-shadow: 0 4px 16px var(--shadow);
    padding: 4px 0;
    z-index: 9999;
    min-width: 160px;
}
.context-item {
    padding: 6px 16px;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
}
.context-item:hover { background: var(--bg-hover); }
.context-sep { height: 1px; background: var(--border); margin: 4px 0; }
/* ── Modal ── */
.modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9000;
}
.modal {
    background: var(--bg-window);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    min-width: 300px;
    max-width: 500px;
}
.modal-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
/* ── Responsive ── */
@media (max-width: 768px) {
    .desktop-icons { padding: 8px; gap: 4px; }
    .desktop-icon { width: 64px; height: 64px; }
    .window { min-width: 280px; }
    .dashboard-grid { grid-template-columns: 1fr; }
}
```

### data\js\app.js
```
const COMPONENT_RENDERERS = window.COMPONENT_RENDERERS || {};
(async function init() {
    EspDSL.onConnect = () => {
        AppState.connected = true;
        AppState.notify();
        console.log('Connected to EspDSL');
    };
    EspDSL.onDisconnect = () => {
        AppState.connected = false;
        AppState.notify();
        console.log('Disconnected');
    };
    EspDSL.onStatusUpdate = (msg) => {
        AppState.updateEngineStatus({
            running: msg.running,
            uptime: msg.uptime,
            taskCount: msg.tasks,
            freeHeap: msg.freeHeap,
            lastTickUs: msg.lastTickUs
        });
    };
    AppState.subscribe(() => renderShell());
    renderShell();
    try {
        await EspDSL.connect(AppState.wsUrl, AppState.token);
        AppState.connected = true;
        const status = await EspDSL.deviceStatus();
        if (status.data) {
            AppState.updateEngineStatus({
                compiled: status.data.engineCompiled,
                running: status.data.engineRunning,
                uptime: status.data.engineUptime,
                freeHeap: status.data.freeHeap
            });
        }
    } catch (e) {
        console.log('Initial connection failed, running offline');
        AppState.connected = false;
    }
    AppState.notify();
    setInterval(() => {
        document.querySelectorAll('.taskbar-clock').forEach(el => { el.textContent = Format.clock(); });
    }, 30000);
})();
```

### data\js\client.js
```
const EspDSL = (() => {
    let ws = null;
    let seq = 0;
    let token = '';
    let pending = new Map();
    let onOutput = null;
    let onStatusUpdate = null;
    let onConnect = null;
    let onDisconnect = null;
    let connected = false;
    function connect(url, authToken = '') {
        token = authToken;
        return new Promise((resolve, reject) => {
            ws = new WebSocket(url);
            ws.onopen = () => {
                connected = true;
                if (onConnect) onConnect();
                resolve();
            };
            ws.onerror = (e) => reject(e);
            ws.onclose = () => {
                connected = false;
                if (onDisconnect) onDisconnect();
                setTimeout(() => {
                    if (!connected) connect(url, token).catch(() => {});
                }, 3000);
            };
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'status_update' && onStatusUpdate) { onStatusUpdate(msg); return; }
                    if (msg.type === 'output' && onOutput) { onOutput(msg.text); return; }
                    if (msg.action && pending.has(msg.action)) {
                        pending.get(msg.action)(msg);
                        pending.delete(msg.action);
                    }
                } catch (err) { console.error('Parse:', err); }
            };
        });
    }
    function send(action, value = {}) {
        return new Promise((resolve, reject) => {
            if (!ws || ws.readyState !== WebSocket.OPEN) { reject('Not connected'); return; }
            const timeout = setTimeout(() => { pending.delete(action); reject('Timeout'); }, 10000);
            pending.set(action, (msg) => { clearTimeout(timeout); resolve(msg); });
            ws.send(JSON.stringify({
                v: 1, msgId: 'msg-' + (++seq), ts: Date.now(),
                type: 'command', name: 'espdsl', seq, qos: 0,
                auth: { token },
                value: { action, ...value }
            }));
        });
    }
    return {
        connect, send,
        get connected() { return connected; },
        set onOutput(fn) { onOutput = fn; },
        set onStatusUpdate(fn) { onStatusUpdate = fn; },
        set onConnect(fn) { onConnect = fn; },
        set onDisconnect(fn) { onDisconnect = fn; },
        compile: (code) => send('compile', { code }),
        tokenize: (code) => send('tokenize', { code }),
        source: () => send('source'),
        disasm: () => send('disasm'),
        constants: () => send('constants'),
        functions: () => send('functions'),
        grammar: () => send('grammar'),
        run: (maxMs) => send('run', { maxMs }),
        tick: (ms = 10) => send('tick', { ms }),
        stop: () => send('stop'),
        reset: () => send('reset'),
        status: () => send('status'),
        tasks: () => send('tasks'),
        taskInfo: (id) => send('task_info', { id }),
        pauseTask: (id) => send('task_pause', { id }),
        resumeTask: (id) => send('task_resume', { id }),
        stopTask: (id) => send('task_stop', { id }),
        restartTask: (id) => send('task_restart', { id }),
        removeTask: (id) => send('task_remove', { id }),
        vars: (taskId) => send('vars', { taskId }),
        modules: () => send('modules'),
        moduleInfo: (name) => send('module_info', { name }),
        memory: () => send('memory'),
        cpu: () => send('cpu'),
        msgSend: (to, topic, value) => send('msg_send', { to, topic, value }),
        msgPeek: (taskId) => send('msg_peek', { taskId }),
        msgStats: () => send('msg_stats'),
        msgClear: (taskId = 255) => send('msg_clear', { taskId }),
        eventEmit: (eventId, value) => send('event_emit', { eventId, value }),
        eventLog: () => send('event_log'),
        eventStats: () => send('event_stats'),
        eventClear: () => send('event_clear'),
        rules: () => send('rules'),
        ruleEnable: (index, enabled) => send('rule_enable', { index, enabled }),
        metrics: () => send('metrics'),
        metricSet: (id, value) => send('metric_set', { id, value }),
        dbgEnable: () => send('dbg_enable'),
        dbgDisable: () => send('dbg_disable'),
        dbgBreakpoint: (address) => send('dbg_breakpoint', { address }),
        dbgClearBp: () => send('dbg_clear_bp'),
        dbgStep: () => send('dbg_step'),
        dbgContinue: () => send('dbg_continue'),
        profStart: () => send('prof_start'),
        profStop: () => send('prof_stop'),
        profReport: () => send('prof_report'),
        scriptSave: (name, code) => send('script_save', { name, code }),
        scriptLoad: (name) => send('script_load', { name }),
        scriptOpen: (name) => send('script_open', { name }),
        scriptDelete: (name) => send('script_delete', { name }),
        scripts: () => send('scripts'),
        deviceStatus: () => send('device_status'),
        deviceReboot: () => send('device_reboot'),
        console: (command) => send('console', { command }),
    };
})();
```

### src\API\PluginSDK.h
```
#ifndef ESPDSL_PLUGIN_SDK_H
#define ESPDSL_PLUGIN_SDK_H
#include "../VM/VM.h"
#include <functional>
#include <string>
#include <vector>
struct PluginSlot
{
    bool used = false;
    std::function<VMValue(int, VMValue *)> handler;
};
#define ESPDSL_TRAMPOLINE(N) \
    static VMValue _pt##N(int c, VMValue *a) { return g_pluginSlots[N].handler(c, a); }
static PluginSlot g_pluginSlots[32];
ESPDSL_TRAMPOLINE(0)
ESPDSL_TRAMPOLINE(1)
ESPDSL_TRAMPOLINE(2)
ESPDSL_TRAMPOLINE(3)
ESPDSL_TRAMPOLINE(4)
ESPDSL_TRAMPOLINE(5)
ESPDSL_TRAMPOLINE(6)
ESPDSL_TRAMPOLINE(7)
ESPDSL_TRAMPOLINE(8)
ESPDSL_TRAMPOLINE(9)
ESPDSL_TRAMPOLINE(10)
ESPDSL_TRAMPOLINE(11)
ESPDSL_TRAMPOLINE(12)
ESPDSL_TRAMPOLINE(13)
ESPDSL_TRAMPOLINE(14)
ESPDSL_TRAMPOLINE(15)
static ModuleFunction g_ptTable[] = {_pt0, _pt1, _pt2, _pt3, _pt4, _pt5, _pt6, _pt7, _pt8, _pt9, _pt10, _pt11, _pt12, _pt13, _pt14, _pt15};
static uint8_t g_nextPlugSlot = 0;
class PluginBuilder
{
    struct FuncDef
    {
        std::string name;
        uint8_t slot;
    };
    std::string name_;
    uint16_t abi_ = 1;
    std::vector<FuncDef> funcs_;
    static std::vector<std::string> &nameStore()
    {
        static std::vector<std::string> s;
        return s;
    }
    static std::vector<std::vector<ModuleFuncEntry>> &entryStore()
    {
        static std::vector<std::vector<ModuleFuncEntry>> s;
        return s;
    }
public:
    PluginBuilder(const std::string &name) : name_(name) {}
    PluginBuilder &version(uint16_t v)
    {
        abi_ = v;
        return *this;
    }
    PluginBuilder &func(const std::string &name, std::function<VMValue(int, VMValue *)> handler)
    {
        if (g_nextPlugSlot >= 16)
            return *this;
        uint8_t slot = g_nextPlugSlot++;
        g_pluginSlots[slot].used = true;
        g_pluginSlots[slot].handler = std::move(handler);
        funcs_.push_back({name, slot});
        return *this;
    }
    bool build()
    {
        if (funcs_.empty())
            return false;
        nameStore().push_back(name_);
        const char *modName = nameStore().back().c_str();
        std::vector<ModuleFuncEntry> entries;
        for (const auto &f : funcs_)
        {
            nameStore().push_back(f.name);
            entries.push_back({nameStore().back().c_str(), g_ptTable[f.slot]});
        }
        entryStore().push_back(std::move(entries));
        g_moduleRegistry.registerModule({modName, abi_, entryStore().back().data(), (uint8_t)entryStore().back().size()});
        return true;
    }
};
#endif
```

### src\API\Engine.h
```
#ifndef ESPDSL_ENGINE_H
#define ESPDSL_ENGINE_H
#include "../Core/Core.h"
#include "../VM/VM.h"
#include "../Runtime/Scheduler.h"
#include "../Runtime/RuntimeIds.h"
#include "../Runtime/MessageBus.h"
#include "../Runtime/EventBus.h"
#include "../Runtime/RuleEngine.h"
#include "../Runtime/ModuleLoader.h"
#include "../Debug/Debugger.h"
#include "../Debug/Profiler.h"
#include "../Lang/Lexer.h"
#include "../Lang/Parser.h"
#include "../Lang/Compiler.h"
#include "../Modules.h"
#include <functional>
#include <chrono>
struct CompileResult
{
    bool ok = false;
    std::string error;
    int errorLine = 0;
    uint32_t bytecodeSize = 0;
    uint32_t constantCount = 0;
    uint32_t functionCount = 0;
    uint32_t taskCount = 0;
};
struct TaskInfo
{
    TaskId id;
    char name[NAME_LEN];
    size_t ip;
    int sp, fp;
    VMStatus status;
    bool active, paused, halted;
    uint32_t totalInstructions, peakStack, arrayCount, runCount, errorCount;
    uint16_t entryPoint;
    uint8_t priority;
};
struct VarInfo
{
    uint8_t id;
    bool isLocal;
    std::string valueStr;
    std::string typeStr;
    ValueType type;
};
struct MemInfo
{
    uint32_t bytecodeSize, constantCount, taskCount, totalArrays, totalArrayElements, totalInstructions, estimatedRam, freeHeap, totalHeap;
    float cpuUsagePercent;
};
struct ModuleInfo
{
    int id;
    std::string name;
    uint16_t abiVersion;
    uint8_t methodCount;
    std::vector<std::string> methods;
    bool isBuiltin, isPlugin;
};
struct FunctionInfo
{
    std::string name;
    uint16_t entryPoint;
    uint8_t paramCount;
    std::vector<std::string> paramNames;
    bool isExported;
};
struct MessageInfo
{
    TaskId from, to;
    TopicId topic;
    std::string payloadStr;
    uint32_t timestamp;
    uint8_t priority;
};
struct EventInfo
{
    EventId id;
    TaskId source;
    std::string payloadStr;
    uint32_t timestamp;
};
struct RuleInfo
{
    uint8_t index;
    char name[NAME_LEN];
    bool enabled;
    uint8_t priority;
    uint32_t fireCount, cooldownMs;
    uint8_t conditionCount, actionCount;
};
struct MetricInfo
{
    uint8_t id;
    float value;
    bool valid;
};
struct GrammarInfo
{
    std::vector<std::string> keywords, builtinFunctions, types, operators;
    struct ModGrammar
    {
        std::string name;
        std::vector<std::string> methods;
    };
    std::vector<ModGrammar> modules;
};
struct ScriptStorage
{
    struct Entry
    {
        std::string name, source;
        uint32_t lastModified;
        bool autoRun;
    };
    std::vector<Entry> scripts;
};
using OutputCallback = std::function<void(const std::string &)>;
struct PlatformCallbacks
{
    std::function<uint32_t()> getFreeHeap = []() -> uint32_t
    { return 0; };
    std::function<uint32_t()> getTotalHeap = []() -> uint32_t
    { return 0; };
    std::function<float()> getCpuUsage = []() -> float
    { return 0; };
    std::function<uint32_t()> getUptimeMs = []() -> uint32_t
    { return 0; };
};
class Engine
{
    std::unique_ptr<VirtualMachine> vm_;
    std::unique_ptr<Scheduler> scheduler_;
    ProgramBinary program_;
    bool compiled_ = false, running_ = false;
    uint32_t tickMs_ = 0, lastTickDurationUs_ = 0;
    OutputCallback outputCallback_ = nullptr;
    std::string outputBuffer_;
    size_t maxOutputBuffer_ = 4096;
    PlatformCallbacks platform_;
    ScriptStorage scriptStore_;
    std::string lastSource_;
    struct PluginRec
    {
        std::string name;
        int moduleId;
        bool active;
    };
    std::vector<PluginRec> plugins_;
public:
    Engine() = default;
    void setPlatform(const PlatformCallbacks &p) { platform_ = p; }
    void setOutputCallback(OutputCallback cb) { outputCallback_ = cb; }
    std::string getOutputBuffer() const { return outputBuffer_; }
    void clearOutputBuffer() { outputBuffer_.clear(); }
    CompileResult compile(const std::string &source)
    {
        CompileResult r;
        try
        {
            lastSource_ = source;
            Lexer lex(source);
            auto tokens = lex.tokenize();
            Parser par(tokens);
            auto ast = par.parse();
            Compiler comp;
            program_ = comp.compile(ast.get());
            vm_ = std::make_unique<VirtualMachine>(program_.bytecode.data(), program_.bytecode.size(), program_.constants.data(), program_.constants.size());
            vm_->registerFuncSymbols(program_.functions, program_.tasks);
            auto vr = vm_->verify();
            if (!vr.ok)
            {
                r.error = vr.error;
                return r;
            }
            scheduler_ = std::make_unique<Scheduler>(vm_.get());
            for (const auto &t : program_.tasks)
                scheduler_->addTask(t.name.c_str(), t.entryPoint);
            scheduler_->addTask("__main__", 0);
            compiled_ = true;
            running_ = false;
            r.ok = true;
            r.bytecodeSize = (uint32_t)program_.bytecode.size();
            r.constantCount = (uint32_t)program_.constants.size();
            r.functionCount = (uint32_t)program_.functions.size();
            r.taskCount = (uint32_t)(program_.tasks.size() + 1);
        }
        catch (const std::exception &e)
        {
            r.error = e.what();
            auto pos = r.error.find(" L");
            if (pos != std::string::npos)
                try
                {
                    r.errorLine = std::stoi(r.error.substr(pos + 2));
                }
                catch (...)
                {
                }
        }
        return r;
    }
    CompileResult compileWithModules(const std::string &source)
    {
        auto r = compile(source);
        if (!r.ok)
            return r;
        if (!program_.imports.empty())
        {
            std::string err;
            if (!g_moduleLoader.resolveImports(program_, err))
            {
                r.ok = false;
                r.error = err;
                return r;
            }
            vm_ = std::make_unique<VirtualMachine>(program_.bytecode.data(), program_.bytecode.size(), program_.constants.data(), program_.constants.size());
            vm_->registerFuncSymbols(program_.functions, program_.tasks);
            auto vr = vm_->verify();
            if (!vr.ok)
            {
                r.ok = false;
                r.error = "After linking: " + vr.error;
                return r;
            }
            scheduler_ = std::make_unique<Scheduler>(vm_.get());
            for (const auto &t : program_.tasks)
                scheduler_->addTask(t.name.c_str(), t.entryPoint);
            scheduler_->addTask("__main__", 0);
            r.bytecodeSize = (uint32_t)program_.bytecode.size();
            r.constantCount = (uint32_t)program_.constants.size();
        }
        return r;
    }
    struct TokenInfo
    {
        std::string type, value;
        int line;
    };
    std::vector<TokenInfo> tokenize(const std::string &source)
    {
        std::vector<TokenInfo> result;
        try
        {
            Lexer lex(source);
            auto tokens = lex.tokenize();
            for (const auto &t : tokens)
            {
                if (t.type == TokenType::EOF_TOKEN)
                    break;
                std::string type;
                switch (t.type)
                {
                case TokenType::KEYWORD:
                    type = "keyword";
                    break;
                case TokenType::IDENTIFIER:
                    type = "identifier";
                    break;
                case TokenType::NUMBER:
                    type = "number";
                    break;
                case TokenType::STRING:
                    type = "string";
                    break;
                case TokenType::OPERATOR:
                    type = "operator";
                    break;
                default:
                    type = "symbol";
                    break;
                }
                result.push_back({type, t.value, t.line});
            }
        }
        catch (...)
        {
        }
        return result;
    }
    std::string getLastSource() const { return lastSource_; }
    bool tick(uint32_t deltaMs = 10)
    {
        if (!compiled_ || !scheduler_)
            return false;
        running_ = true;
        tickMs_ += deltaMs;
        auto start = std::chrono::steady_clock::now();
        scheduler_->tick(tickMs_);
        auto end = std::chrono::steady_clock::now();
        lastTickDurationUs_ = (uint32_t)std::chrono::duration_cast<std::chrono::microseconds>(end - start).count();
        if (scheduler_->allDone())
            running_ = false;
        return running_;
    }
    void run(uint32_t maxMs = 1000000)
    {
        uint32_t t = 0;
        while (tick(10) && t < maxMs)
            t += 10;
    }
    void stop()
    {
        running_ = false;
        if (scheduler_)
            for (TaskId i = 0; i < MAX_TASKS; i++)
            {
                auto *t = scheduler_->getTask(i);
                if (t && t->used && t->active)
                {
                    t->active = false;
                    t->halted = true;
                }
            }
    }
    void reset()
    {
        compiled_ = false;
        running_ = false;
        tickMs_ = 0;
        outputBuffer_.clear();
        vm_.reset();
        scheduler_.reset();
        program_ = ProgramBinary();
        lastSource_.clear();
    }
    bool isRunning() const { return running_; }
    bool isCompiled() const { return compiled_; }
    uint32_t uptime() const { return tickMs_; }
    uint32_t lastTickUs() const { return lastTickDurationUs_; }
    int taskCount() const
    {
        if (!scheduler_)
            return 0;
        int c = 0;
        for (TaskId i = 0; i < MAX_TASKS; i++)
        {
            auto *t = const_cast<Scheduler *>(scheduler_.get())->getTask(i);
            if (t && t->used)
                c++;
        }
        return c;
    }
    bool getTaskInfo(TaskId id, TaskInfo &out) const
    {
        if (!scheduler_)
            return false;
        auto *t = const_cast<Scheduler *>(scheduler_.get())->getTask(id);
        if (!t || !t->used)
            return false;
        out.id = t->id;
        rtCopyName(out.name, t->name);
        out.ip = t->ctx.ip;
        out.sp = t->ctx.sp;
        out.fp = t->ctx.fp;
        out.status = t->ctx.status;
        out.active = t->active;
        out.paused = t->paused;
        out.halted = t->halted;
        out.totalInstructions = t->ctx.usage.instructionsTotal;
        out.peakStack = t->ctx.usage.peakStackDepth;
        out.arrayCount = t->ctx.usage.arrayCount;
        out.runCount = t->runCount;
        out.errorCount = t->errorCount;
        out.priority = (uint8_t)t->priority;
        return true;
    }
    void listTasks(std::vector<TaskInfo> &out) const
    {
        out.clear();
        for (TaskId i = 0; i < MAX_TASKS; i++)
        {
            TaskInfo ti;
            if (getTaskInfo(i, ti))
                out.push_back(ti);
        }
    }
    bool pauseTask(TaskId id) { return scheduler_ ? scheduler_->pauseTask(id) : false; }
    bool resumeTask(TaskId id) { return scheduler_ ? scheduler_->resumeTask(id) : false; }
    bool stopTask(TaskId id)
    {
        if (!scheduler_)
            return false;
        auto *t = scheduler_->getTask(id);
        if (!t || !t->used)
            return false;
        t->active = false;
        t->halted = true;
        return true;
    }
    bool restartTask(TaskId id)
    {
        if (!scheduler_)
            return false;
        auto *t = scheduler_->getTask(id);
        if (!t || !t->used)
            return false;
        uint16_t entry = 0;
        for (const auto &pt : program_.tasks)
            if (rtNameEq(t->name, pt.name.c_str()))
            {
                entry = pt.entryPoint;
                break;
            }
        auto quota = t->ctx.quota;
        t->ctx.reset();
        t->ctx.quota = quota;
        t->ctx.ip = entry;
        t->active = true;
        t->halted = false;
        t->paused = false;
        t->runCount = 0;
        t->errorCount = 0;
        return true;
    }
    bool removeTask(TaskId id) { return scheduler_ ? scheduler_->removeTask(id) : false; }
    void getVariables(TaskId id, std::vector<VarInfo> &out) const
    {
        out.clear();
        if (!scheduler_)
            return;
        auto *t = const_cast<Scheduler *>(scheduler_.get())->getTask(id);
        if (!t || !t->used)
            return;
        for (int i = 0; i < VMContext::VAR_COUNT; i++)
            if (t->ctx.vars[i].type != ValueType::NONE)
                out.push_back({(uint8_t)i, false, t->ctx.vars[i].toString(), t->ctx.vars[i].typeStr(), t->ctx.vars[i].type});
        if (t->ctx.inFrame())
        {
            const auto &frame = t->ctx.frames[t->ctx.fp];
            for (int i = 0; i < frame.localCount && i < 32; i++)
                if (frame.locals[i].type != ValueType::NONE)
                    out.push_back({(uint8_t)i, true, frame.locals[i].toString(), frame.locals[i].typeStr(), frame.locals[i].type});
        }
    }
    MemInfo getMemoryInfo() const
    {
        MemInfo m{};
        if (!compiled_)
            return m;
        m.bytecodeSize = (uint32_t)program_.bytecode.size();
        m.constantCount = (uint32_t)program_.constants.size();
        m.taskCount = (uint32_t)program_.tasks.size();
        if (scheduler_)
            for (TaskId i = 0; i < MAX_TASKS; i++)
            {
                auto *t = const_cast<Scheduler *>(scheduler_.get())->getTask(i);
                if (t && t->used)
                {
                    m.totalArrays += t->ctx.usage.arrayCount;
                    m.totalArrayElements += t->ctx.usage.totalArrayElements;
                    m.totalInstructions += t->ctx.usage.instructionsTotal;
                }
            }
        m.estimatedRam = m.bytecodeSize + m.constantCount * sizeof(VMValue) + m.totalArrays * 64 + m.taskCount * sizeof(VMContext);
        m.freeHeap = platform_.getFreeHeap();
        m.totalHeap = platform_.getTotalHeap();
        m.cpuUsagePercent = platform_.getCpuUsage();
        return m;
    }
    struct CpuInfo
    {
        uint32_t lastTickUs, uptimeMs, totalInstructions, taskCount, freeHeap, totalHeap;
        float cpuPercent;
    };
    CpuInfo getCpuInfo() const
    {
        CpuInfo c{};
        c.lastTickUs = lastTickDurationUs_;
        c.uptimeMs = tickMs_;
        c.cpuPercent = platform_.getCpuUsage();
        c.freeHeap = platform_.getFreeHeap();
        c.totalHeap = platform_.getTotalHeap();
        c.taskCount = (uint32_t)taskCount();
        if (scheduler_)
            for (TaskId i = 0; i < MAX_TASKS; i++)
            {
                auto *t = const_cast<Scheduler *>(scheduler_.get())->getTask(i);
                if (t && t->used)
                    c.totalInstructions += t->ctx.usage.instructionsTotal;
            }
        return c;
    }
    void listModules(std::vector<ModuleInfo> &out) const
    {
        out.clear();
        for (size_t i = 0; i < g_moduleRegistry.count(); i++)
        {
            const auto &m = g_moduleRegistry.getModule((int)i);
            ModuleInfo mi;
            mi.id = (int)i;
            mi.name = m.name;
            mi.abiVersion = m.abiVersion;
            mi.methodCount = m.methodCount;
            mi.isBuiltin = true;
            mi.isPlugin = false;
            for (const auto &p : plugins_)
                if (p.name == mi.name)
                {
                    mi.isPlugin = true;
                    mi.isBuiltin = false;
                    break;
                }
            mi.methods.clear();
            for (int j = 0; j < m.methodCount; j++)
                mi.methods.push_back(m.methods[j].name);
            out.push_back(mi);
        }
    }
    int getModuleId(const std::string &name) const { return g_moduleRegistry.findModule(name); }
    bool getModuleInfo(int id, ModuleInfo &out) const
    {
        if (id < 0 || id >= (int)g_moduleRegistry.count())
            return false;
        const auto &m = g_moduleRegistry.getModule(id);
        out.id = id;
        out.name = m.name;
        out.abiVersion = m.abiVersion;
        out.methodCount = m.methodCount;
        out.isBuiltin = true;
        out.isPlugin = false;
        for (const auto &p : plugins_)
            if (p.name == out.name)
            {
                out.isPlugin = true;
                out.isBuiltin = false;
                break;
            }
        out.methods.clear();
        for (int j = 0; j < m.methodCount; j++)
            out.methods.push_back(m.methods[j].name);
        return true;
    }
    bool hasModule(const std::string &name) const { return g_moduleRegistry.hasModule(name); }
    bool unregisterModule(const std::string &name)
    {
        for (auto it = plugins_.begin(); it != plugins_.end(); ++it)
            if (it->name == name)
            {
                plugins_.erase(it);
                break;
            }
        return g_moduleRegistry.unregisterModule(name);
    }
    int moduleCount() const { return (int)g_moduleRegistry.count(); }
    void listFunctions(std::vector<FunctionInfo> &out) const
    {
        out.clear();
        for (const auto &f : program_.functions)
        {
            FunctionInfo fi;
            fi.name = f.name;
            fi.entryPoint = f.entryPoint;
            fi.paramCount = f.paramCount;
            fi.paramNames = f.paramNames;
            fi.isExported = false;
            for (const auto &e : program_.exports)
                if (e.name == f.name)
                {
                    fi.isExported = true;
                    break;
                }
            out.push_back(fi);
        }
    }
    bool sendMessage(TaskId to, TopicId topic, const VMValue &payload) { return g_messageBus.send(INVALID_TASK, to, topic, payload); }
    bool hasMessages(TaskId id) const { return g_messageBus.has(id); }
    uint8_t messageCount(TaskId id) const { return g_messageBus.count(id); }
    void peekMessages(TaskId id, std::vector<MessageInfo> &out) const
    {
        out.clear();
        std::vector<RtMessage> msgs;
        g_messageBus.peekAll(id, msgs);
        for (const auto &m : msgs)
            out.push_back({m.from, m.to, m.topic, m.payload.toString(), m.timestamp, m.priority});
    }
    void clearMessages(TaskId id) { g_messageBus.clear(id); }
    void clearAllMessages() { g_messageBus.clearAll(); }
    void broadcastMessage(TopicId topic, const VMValue &payload) { g_messageBus.broadcast(INVALID_TASK, topic, payload); }
    struct MsgBusStats
    {
        uint32_t sent, delivered, dropped;
    };
    MsgBusStats getMessageStats() const { return {g_messageBus.sent(), g_messageBus.delivered(), g_messageBus.dropped()}; }
    bool emitEvent(EventId id, const VMValue &payload) { return g_eventBus.emit(id, INVALID_TASK, payload); }
    uint8_t eventsPending() const { return g_eventBus.pending(); }
    uint8_t eventLogSize() const { return g_eventBus.logSize(); }
    void getEventLog(std::vector<EventInfo> &out) const
    {
        out.clear();
        std::vector<RtEvent> events;
        g_eventBus.getLog(events);
        for (const auto &e : events)
            out.push_back({e.id, e.source, e.payload.toString(), e.timestamp});
    }
    void clearEventLog() { g_eventBus.clearLog(); }
    void clearEventQueue() { g_eventBus.clearQueue(); }
    bool subscribeTaskToEvent(TaskId taskId, EventId eventId, TopicId deliverTopic) { return g_eventBus.subscribe(taskId, eventId, deliverTopic); }
    void unsubscribeTask(TaskId taskId) { g_eventBus.unsubscribeTask(taskId); }
    struct EvtBusStats
    {
        uint8_t pending, logSize, subscriptions, callbacks;
    };
    EvtBusStats getEventStats() const { return {g_eventBus.pending(), g_eventBus.logSize(), g_eventBus.subscriptionCount(), g_eventBus.callbackCount()}; }
    void setMetric(uint8_t id, float value) { g_ruleEngine.setMetric(id, value); }
    float getMetric(uint8_t id) const { return g_ruleEngine.getMetric(id); }
    bool isMetricValid(uint8_t id) const { return g_ruleEngine.isMetricValid(id); }
    void clearMetric(uint8_t id) { g_ruleEngine.clearMetric(id); }
    void clearAllMetrics() { g_ruleEngine.clearAllMetrics(); }
    uint8_t ruleCount() const { return g_ruleEngine.ruleCount(); }
    void listRules(std::vector<RuleInfo> &out) const
    {
        out.clear();
        std::vector<RuleEntry> entries;
        g_ruleEngine.listRules(entries);
        for (size_t i = 0; i < entries.size(); i++)
        {
            const RuleEntry &entry = entries[i];
            if (!entry.rule)
                continue;
            RuleInfo ri;
            ri.index = entry.index;
            rtCopyName(ri.name, entry.rule->name);
            ri.enabled = entry.rule->enabled;
            ri.priority = entry.rule->priority;
            ri.fireCount = entry.rule->fireCount;
            ri.cooldownMs = entry.rule->cooldownMs;
            ri.conditionCount = entry.rule->condCount;
            ri.actionCount = entry.rule->actionCount;
            out.push_back(ri);
        }
    }
    bool enableRule(uint8_t idx, bool en) { return g_ruleEngine.enableRule(idx, en); }
    bool removeRule(uint8_t idx) { return g_ruleEngine.removeRule(idx); }
    void listAllMetrics(std::vector<MetricInfo> &out) const
    {
        out.clear();
        std::vector<std::tuple<uint8_t, float, bool>> mets;
        g_ruleEngine.listAllMetrics(mets);
        for (size_t i = 0; i < mets.size(); i++)
        {
            MetricInfo mi;
            mi.id = std::get<0>(mets[i]);
            mi.value = std::get<1>(mets[i]);
            mi.valid = std::get<2>(mets[i]);
            out.push_back(mi);
        }
    }
    void attachDebugger(Debugger *d)
    {
        if (vm_)
            vm_->attachDebugger(d);
    }
    void attachProfiler(Profiler *p)
    {
        if (vm_)
            vm_->attachProfiler(p);
    }
    void addBreakpoint(uint16_t addr) { g_debugger.addBreakpoint(addr); }
    void removeBreakpoint(uint16_t addr) { g_debugger.removeBreakpoint(addr); }
    void clearBreakpoints() { g_debugger.clearBreakpoints(); }
    void debugStepIn() { g_debugger.stepIn(); }
    void debugStepOver(TaskId id)
    {
        if (scheduler_)
        {
            auto *t = scheduler_->getTask(id);
            if (t)
                g_debugger.stepOver((int8_t)t->ctx.fp);
        }
    }
    void debugStepOut(TaskId id)
    {
        if (scheduler_)
        {
            auto *t = scheduler_->getTask(id);
            if (t)
                g_debugger.stepOut((int8_t)t->ctx.fp);
        }
    }
    void debugContinue() { g_debugger.cont(); }
    void debugEnable()
    {
        g_debugger.enable();
        attachDebugger(&g_debugger);
    }
    void debugDisable() { g_debugger.disable(); }
    bool debugEnabled() const { return g_debugger.enabled(); }
    void profilerStart()
    {
        g_profiler.start();
        attachProfiler(&g_profiler);
    }
    void profilerStop() { g_profiler.stop(); }
    void profilerReset() { g_profiler.reset(); }
    bool profilerActive() const { return g_profiler.active(); }
    GrammarInfo getGrammar() const
    {
        GrammarInfo g;
        g.keywords = {"PROGRAM", "ENDPROGRAM", "TASK", "ENDTASK", "SET", "VAR", "WAIT", "YIELD", "CALL", "IF", "THEN", "ELSE", "ENDIF", "LOOP", "ENDLOOP", "WHILE", "ENDWHILE", "FOR", "TO", "STEP", "ENDFOR", "BREAK", "CONTINUE", "FUNC", "ENDFUNC", "RETURN", "PRINT", "IMPORT", "EXPORT", "AND", "OR", "NOT", "TRUE", "FALSE"};
        g.builtinFunctions = {"LEN", "TOINT", "TOFLOAT", "TOSTR", "CONCAT", "PUSH"};
        g.types = {"INT", "FLOAT", "BOOL", "STRING", "ARRAY", "NONE"};
        g.operators = {"+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "?", ":"};
        for (size_t i = 0; i < g_moduleRegistry.count(); i++)
        {
            const auto &m = g_moduleRegistry.getModule((int)i);
            GrammarInfo::ModGrammar mg;
            mg.name = m.name;
            for (int j = 0; j < m.methodCount; j++)
                mg.methods.push_back(m.methods[j].name);
            g.modules.push_back(mg);
        }
        for (const auto &f : program_.functions)
            g.builtinFunctions.push_back(f.name);
        return g;
    }
    bool saveScript(const std::string &name, const std::string &source, bool autoRun = false)
    {
        for (auto &s : scriptStore_.scripts)
            if (s.name == name)
            {
                s.source = source;
                s.lastModified = tickMs_;
                s.autoRun = autoRun;
                return true;
            }
        scriptStore_.scripts.push_back({name, source, tickMs_, autoRun});
        return true;
    }
    bool loadScript(const std::string &name, std::string &source) const
    {
        for (const auto &s : scriptStore_.scripts)
            if (s.name == name)
            {
                source = s.source;
                return true;
            }
        return false;
    }
    bool deleteScript(const std::string &name)
    {
        for (auto it = scriptStore_.scripts.begin(); it != scriptStore_.scripts.end(); ++it)
            if (it->name == name)
            {
                scriptStore_.scripts.erase(it);
                return true;
            }
        return false;
    }
    void listScripts(std::vector<ScriptStorage::Entry> &out) const { out = scriptStore_.scripts; }
    bool loadModule(const std::string &name) { return g_moduleLoader.loadBinary(name); }
    bool loadModuleSource(const std::string &name, const std::string &source) { return g_moduleLoader.loadSource(name, source); }
    std::vector<std::string> listLoadedModules() const { return g_moduleLoader.listLoaded(); }
    struct ConstantInfo
    {
        uint16_t id;
        std::string typeStr, valueStr;
    };
    void listConstants(std::vector<ConstantInfo> &out) const
    {
        out.clear();
        for (size_t i = 0; i < program_.constants.size(); i++)
            out.push_back({(uint16_t)i, program_.constants[i].typeStr(), program_.constants[i].toString()});
    }
    const std::vector<uint8_t> &getBytecode() const { return program_.bytecode; }
    VirtualMachine *rawVM() { return vm_.get(); }
    Scheduler *rawScheduler() { return scheduler_.get(); }
    const ProgramBinary &rawProgram() const { return program_; }
};
#endif
```

### src\API\SerialConsole.h
```
#ifndef ESPDSL_SERIAL_CONSOLE_H
#define ESPDSL_SERIAL_CONSOLE_H
#include "Engine.h"
#include "../Debug/Debugger.h"
#include "../Debug/Profiler.h"
#include "../Debug/Disassembler.h"
#include <string>
#include <sstream>
#include <functional>
class SerialConsole {
    Engine& engine_;
    bool echo_ = true;
    bool multilineMode_ = false;
    std::string multilineBuffer_;
    std::function<void(const std::string&)> output_;
    void out(const std::string& s) {
        if (output_) output_(s);
        else std::cout << s;
    }
    void outln(const std::string& s = "") {
        out(s + "\n");
    }
    static std::vector<std::string> split(const std::string& s) {
        std::vector<std::string> parts;
        std::istringstream iss(s);
        std::string w;
        while (iss >> w) parts.push_back(w);
        return parts;
    }
    static int toInt(const std::string& s, int def = 0) {
        try { return std::stoi(s); }
        catch (...) { return def; }
    }
    static std::string restOfLine(const std::string& line) {
        size_t pos = line.find(' ');
        return (pos != std::string::npos) ? line.substr(pos + 1) : "";
    }
public:
    SerialConsole(Engine& engine) : engine_(engine) {}
    void setOutput(std::function<void(const std::string&)> fn) {
        output_ = fn;
    }
    std::string processLine(const std::string& line) {
        std::string captured;
        auto prevOutput = output_;
        output_ = [prevOutput, &captured](const std::string& s) {
            captured += s;
            if (prevOutput) prevOutput(s);
            else std::cout << s;
        };
        if (multilineMode_) {
            if (line == "END") {
                multilineMode_ = false;
                auto r = engine_.compileWithModules(multilineBuffer_);
                if (r.ok)
                    outln("OK: " + std::to_string(r.bytecodeSize) + "B " +
                          std::to_string(r.taskCount) + " tasks");
                else
                    outln("ERROR L" + std::to_string(r.errorLine) + ": " + r.error);
                multilineBuffer_.clear();
            } else {
                multilineBuffer_ += line + "\n";
            }
            output_ = prevOutput;
            return captured;
        }
        auto parts = split(line);
        if (parts.empty()) {
            output_ = prevOutput;
            return "";
        }
        const std::string& cmd = parts[0];
        if (cmd == "help" || cmd == "?") {
            outln("=== EspDSL Console ===");
            outln("compile <code>");
            outln("load");
            outln("run");
            outln("tick [ms]");
            outln("stop");
            outln("reset");
            outln("status");
            outln("tasks");
            outln("task <id>");
            outln("vars <taskId>");
            outln("pause <id>");
            outln("resume <id>");
            outln("stop_task <id>");
            outln("restart <id>");
            outln("remove <id>");
            outln("modules");
            outln("mem");
            outln("cpu");
            outln("disasm");
            outln("consts");
            outln("funcs");
            outln("dbg on|off");
            outln("bp <addr>|clear");
            outln("step");
            outln("cont");
            outln("prof on|off|report|reset");
            outln("metric <id> <val>");
            outln("metrics");
            outln("rules");
            outln("msg <to> <topic> <val>");
            outln("peek_msg <taskId>");
            outln("msg_stats");
            outln("broadcast <topic> <val>");
            outln("event <id> [val]");
            outln("event_log");
            outln("event_stats");
            outln("save <name>");
            outln("scripts");
            outln("open <name>");
            outln("delete_script <name>");
            outln("load_mod <name>");
            outln("loaded_mods");
            outln("grammar");
            outln("tokens <code>");
            outln("echo on|off");
            outln("quit");
        }
        else if (cmd == "compile" || cmd == "c") {
            std::string code = restOfLine(line);
            if (code.empty()) outln("Usage: compile <code>");
            else {
                auto r = engine_.compileWithModules(code);
                if (r.ok)
                    outln("OK: " + std::to_string(r.bytecodeSize) + "B " +
                          std::to_string(r.taskCount) + " tasks");
                else
                    outln("ERROR L" + std::to_string(r.errorLine) + ": " + r.error);
            }
        }
        else if (cmd == "load") {
            multilineMode_ = true;
            multilineBuffer_.clear();
            outln("Enter code (END to finish):");
        }
        else if (cmd == "source") {
            auto src = engine_.getLastSource();
            outln(src.empty() ? "(no source)" : src);
        }
        else if (cmd == "run" || cmd == "r") {
            if (!engine_.isCompiled()) outln("Not compiled");
            else {
                engine_.run();
                outln("Done running=" + std::string(engine_.isRunning() ? "true" : "false"));
            }
        }
        else if (cmd == "tick" || cmd == "t") {
            uint32_t ms = (parts.size() > 1) ? (uint32_t)toInt(parts[1], 10) : 10;
            engine_.tick(ms);
            outln("Tick+" + std::to_string(ms) + "ms running=" +
                  std::string(engine_.isRunning() ? "true" : "false"));
        }
        else if (cmd == "stop") {
            engine_.stop();
            outln("Stopped");
        }
        else if (cmd == "reset") {
            engine_.reset();
            outln("Reset");
        }
        else if (cmd == "status" || cmd == "s") {
            outln("compiled=" + std::string(engine_.isCompiled() ? "true" : "false"));
            outln("running=" + std::string(engine_.isRunning() ? "true" : "false"));
            outln("uptime=" + std::to_string(engine_.uptime()) + "ms");
            outln("tasks=" + std::to_string(engine_.taskCount()));
        }
        else if (cmd == "tasks") {
            std::vector<TaskInfo> tasks;
            engine_.listTasks(tasks);
            if (tasks.empty()) outln("No tasks");
            for (size_t i = 0; i < tasks.size(); i++) {
                const TaskInfo& t = tasks[i];
                outln("id=" + std::to_string(t.id) + " " + t.name + " " +
                      statusToString(t.status) +
                      " instr=" + std::to_string(t.totalInstructions));
            }
        }
        else if (cmd == "task") {
            if (parts.size() < 2) outln("Usage: task <id>");
            else {
                TaskInfo t;
                if (engine_.getTaskInfo((TaskId)toInt(parts[1]), t)) {
                    outln("id=" + std::to_string(t.id));
                    outln("name=" + std::string(t.name));
                    outln("ip=" + std::to_string(t.ip));
                    outln("status=" + std::string(statusToString(t.status)));
                    outln("instructions=" + std::to_string(t.totalInstructions));
                } else outln("Not found");
            }
        }
        else if (cmd == "vars") {
            if (parts.size() < 2) outln("Usage: vars <taskId>");
            else {
                std::vector<VarInfo> vars;
                engine_.getVariables((TaskId)toInt(parts[1]), vars);
                if (vars.empty()) outln("No variables");
                for (size_t i = 0; i < vars.size(); i++) {
                    const VarInfo& v = vars[i];
                    outln(std::string(v.isLocal ? "  local" : "  global") +
                          " #" + std::to_string(v.id) +
                          " [" + v.typeStr + "] = " + v.valueStr);
                }
            }
        }
        else if (cmd == "pause") {
            if (parts.size() < 2) outln("Usage: pause <id>");
            else { engine_.pauseTask((TaskId)toInt(parts[1])); outln("OK"); }
        }
        else if (cmd == "resume") {
            if (parts.size() < 2) outln("Usage: resume <id>");
            else { engine_.resumeTask((TaskId)toInt(parts[1])); outln("OK"); }
        }
        else if (cmd == "stop_task") {
            if (parts.size() < 2) outln("Usage: stop_task <id>");
            else { engine_.stopTask((TaskId)toInt(parts[1])); outln("OK"); }
        }
        else if (cmd == "restart") {
            if (parts.size() < 2) outln("Usage: restart <id>");
            else { engine_.restartTask((TaskId)toInt(parts[1])); outln("OK"); }
        }
        else if (cmd == "remove") {
            if (parts.size() < 2) outln("Usage: remove <id>");
            else { engine_.removeTask((TaskId)toInt(parts[1])); outln("OK"); }
        }
        else if (cmd == "modules" || cmd == "mods") {
            std::vector<ModuleInfo> mods;
            engine_.listModules(mods);
            for (size_t i = 0; i < mods.size(); i++) {
                const ModuleInfo& m = mods[i];
                outln(m.name + " v" + std::to_string(m.abiVersion) +
                      " [" + std::to_string(m.methodCount) + "]");
            }
        }
        else if (cmd == "mem") {
            auto m = engine_.getMemoryInfo();
            outln("bytecode=" + std::to_string(m.bytecodeSize) + "B");
            outln("constants=" + std::to_string(m.constantCount));
            outln("arrays=" + std::to_string(m.totalArrays));
            outln("estimatedRAM=" + std::to_string(m.estimatedRam) + "B");
            if (m.freeHeap > 0) outln("freeHeap=" + std::to_string(m.freeHeap) + "B");
        }
        else if (cmd == "cpu") {
            auto c = engine_.getCpuInfo();
            outln("lastTickUs=" + std::to_string(c.lastTickUs));
            outln("uptimeMs=" + std::to_string(c.uptimeMs));
            outln("totalInstr=" + std::to_string(c.totalInstructions));
            outln("tasks=" + std::to_string(c.taskCount));
        }
        else if (cmd == "disasm" || cmd == "d") {
            if (!engine_.isCompiled()) outln("Not compiled");
            else {
                const auto& prog = engine_.rawProgram();
                Disassembler d(prog.bytecode.data(), prog.bytecode.size(),
                               prog.constants.data(), prog.constants.size());
                d.print();
            }
        }
        else if (cmd == "consts") {
            std::vector<Engine::ConstantInfo> consts;
            engine_.listConstants(consts);
            for (size_t i = 0; i < consts.size(); i++) {
                const auto& c = consts[i];
                outln("#" + std::to_string(c.id) + " [" + c.typeStr + "] " + c.valueStr);
            }
        }
        else if (cmd == "funcs") {
            std::vector<FunctionInfo> funcs;
            engine_.listFunctions(funcs);
            for (size_t i = 0; i < funcs.size(); i++) {
                const auto& f = funcs[i];
                outln(f.name + "(" + std::to_string(f.paramCount) + ") @" +
                      std::to_string(f.entryPoint) + (f.isExported ? " EXPORT" : ""));
            }
        }
        else if (cmd == "dbg") {
            if (parts.size() < 2) outln("Usage: dbg on|off");
            else if (parts[1] == "on") { engine_.debugEnable(); outln("Debugger ON"); }
            else { engine_.debugDisable(); outln("Debugger OFF"); }
        }
        else if (cmd == "bp") {
            if (parts.size() < 2) outln("Usage: bp <addr>|clear");
            else if (parts[1] == "clear") { engine_.clearBreakpoints(); outln("Cleared"); }
            else { engine_.addBreakpoint((uint16_t)toInt(parts[1])); outln("BP set"); }
        }
        else if (cmd == "step") {
            engine_.debugStepIn();
            engine_.tick(0);
            outln("Stepped");
        }
        else if (cmd == "cont") {
            engine_.debugContinue();
            engine_.tick(0);
            outln("Continued");
        }
        else if (cmd == "prof") {
            if (parts.size() < 2) outln("Usage: prof on|off|report|reset");
            else if (parts[1] == "on") { engine_.profilerStart(); outln("Profiler ON"); }
            else if (parts[1] == "off") { engine_.profilerStop(); outln("Profiler OFF"); }
            else if (parts[1] == "report") g_profiler.printReport();
            else if (parts[1] == "reset") { engine_.profilerReset(); outln("Reset"); }
        }
        else if (cmd == "metric") {
            if (parts.size() < 3) outln("Usage: metric <id> <val>");
            else { engine_.setMetric((uint8_t)toInt(parts[1]), std::stof(parts[2])); outln("OK"); }
        }
        else if (cmd == "metrics") {
            std::vector<MetricInfo> mets;
            engine_.listAllMetrics(mets);
            if (mets.empty()) outln("No metrics");
            for (size_t i = 0; i < mets.size(); i++) {
                const auto& m = mets[i];
                outln("  [" + std::to_string(m.id) + "] = " + std::to_string(m.value));
            }
        }
        else if (cmd == "rules") {
            std::vector<RuleInfo> rules;
            engine_.listRules(rules);
            if (rules.empty()) outln("No rules");
            for (size_t i = 0; i < rules.size(); i++) {
                const auto& r = rules[i];
                outln("  [" + std::to_string(r.index) + "] " + r.name +
                      " prio=" + std::to_string(r.priority) +
                      " fires=" + std::to_string(r.fireCount) +
                      (r.enabled ? "" : " DISABLED"));
            }
        }
        else if (cmd == "msg") {
            if (parts.size() < 4) outln("Usage: msg <to> <topic> <val>");
            else {
                engine_.sendMessage((TaskId)toInt(parts[1]),
                                    (TopicId)toInt(parts[2]),
                                    VMValue::Int(toInt(parts[3])));
                outln("Sent");
            }
        }
        else if (cmd == "peek_msg") {
            if (parts.size() < 2) outln("Usage: peek_msg <taskId>");
            else {
                std::vector<MessageInfo> msgs;
                engine_.peekMessages((TaskId)toInt(parts[1]), msgs);
                if (msgs.empty()) outln("No messages");
                for (size_t i = 0; i < msgs.size(); i++) {
                    const auto& m = msgs[i];
                    outln("  from=" + std::to_string(m.from) +
                          " topic=" + std::to_string(m.topic) +
                          " val=" + m.payloadStr);
                }
            }
        }
        else if (cmd == "msg_stats") {
            auto s = engine_.getMessageStats();
            outln("sent=" + std::to_string(s.sent) +
                  " delivered=" + std::to_string(s.delivered) +
                  " dropped=" + std::to_string(s.dropped));
        }
        else if (cmd == "broadcast") {
            if (parts.size() < 3) outln("Usage: broadcast <topic> <val>");
            else {
                engine_.broadcastMessage((TopicId)toInt(parts[1]), VMValue::Int(toInt(parts[2])));
                outln("Broadcast");
            }
        }
        else if (cmd == "event") {
            if (parts.size() < 2) outln("Usage: event <id> [val]");
            else {
                VMValue p = (parts.size() >= 3) ? VMValue::Int(toInt(parts[2])) : VMValue::None();
                engine_.emitEvent((EventId)toInt(parts[1]), p);
                outln("Emitted");
            }
        }
        else if (cmd == "event_log") {
            std::vector<EventInfo> events;
            engine_.getEventLog(events);
            if (events.empty()) outln("No events");
            for (size_t i = 0; i < events.size(); i++) {
                const auto& e = events[i];
                outln("  t=" + std::to_string(e.timestamp) +
                      " evt=" + std::to_string(e.id) +
                      " src=" + std::to_string(e.source) +
                      " val=" + e.payloadStr);
            }
        }
        else if (cmd == "event_stats") {
            auto s = engine_.getEventStats();
            outln("pending=" + std::to_string(s.pending) +
                  " log=" + std::to_string(s.logSize) +
                  " subs=" + std::to_string(s.subscriptions));
        }
        else if (cmd == "save") {
            if (parts.size() < 2) outln("Usage: save <name>");
            else {
                auto src = engine_.getLastSource();
                if (src.empty()) outln("No source");
                else { engine_.saveScript(parts[1], src); outln("Saved"); }
            }
        }
        else if (cmd == "scripts") {
            std::vector<ScriptStorage::Entry> scripts;
            engine_.listScripts(scripts);
            if (scripts.empty()) outln("No scripts");
            for (size_t i = 0; i < scripts.size(); i++) {
                outln("  " + scripts[i].name + " (" + std::to_string(scripts[i].source.size()) + " chars)");
            }
        }
        else if (cmd == "open") {
            if (parts.size() < 2) outln("Usage: open <name>");
            else {
                std::string src;
                if (engine_.loadScript(parts[1], src)) {
                    auto r = engine_.compileWithModules(src);
                    if (r.ok) outln("Loaded '" + parts[1] + "'");
                    else outln("Error: " + r.error);
                } else outln("Not found");
            }
        }
        else if (cmd == "delete_script") {
            if (parts.size() < 2) outln("Usage: delete_script <name>");
            else { engine_.deleteScript(parts[1]); outln("Deleted"); }
        }
        else if (cmd == "load_mod") {
            if (parts.size() < 2) outln("Usage: load_mod <name>");
            else {
                if (engine_.loadModule(parts[1])) outln("Loaded: " + parts[1]);
                else outln("Failed: " + parts[1]);
            }
        }
        else if (cmd == "loaded_mods") {
            std::vector<std::string> mods = engine_.listLoadedModules();
            if (mods.empty()) outln("None");
            for (size_t i = 0; i < mods.size(); i++) outln("  " + mods[i]);
        }
        else if (cmd == "grammar") {
            auto g = engine_.getGrammar();
            out("keywords: "); for (size_t i = 0; i < g.keywords.size(); i++) out(g.keywords[i] + " "); outln("");
            out("builtins: "); for (size_t i = 0; i < g.builtinFunctions.size(); i++) out(g.builtinFunctions[i] + " "); outln("");
            for (size_t i = 0; i < g.modules.size(); i++) {
                out("  " + g.modules[i].name + ": ");
                for (size_t j = 0; j < g.modules[i].methods.size(); j++) out(g.modules[i].methods[j] + " ");
                outln("");
            }
        }
        else if (cmd == "tokens") {
            std::string code = restOfLine(line);
            if (code.empty()) outln("Usage: tokens <code>");
            else {
                auto toks = engine_.tokenize(code);
                for (size_t i = 0; i < toks.size(); i++)
                    outln("  L" + std::to_string(toks[i].line) +
                          " [" + toks[i].type + "] " + toks[i].value);
            }
        }
        else if (cmd == "echo") {
            if (parts.size() >= 2) echo_ = (parts[1] == "on");
            outln("Echo " + std::string(echo_ ? "ON" : "OFF"));
        }
        else {
            outln("Unknown: " + cmd + " (type 'help')");
        }
        output_ = prevOutput;
        return captured;
    }
    void interactiveLoop() {
        out("EspDSL Console. Type 'help'.\n");
        std::string line;
        while (true) {
            if (echo_) out("> ");
            if (!std::getline(std::cin, line)) break;
            if (line == "quit" || line == "exit") break;
            processLine(line);
        }
    }
};
#endif
```

### src\Bridge\UDCPBridge.h
```
#ifndef ESPDSL_UDCP_BRIDGE_H
#define ESPDSL_UDCP_BRIDGE_H
#include "../API/Engine.h"
#include "../API/SerialConsole.h"
#ifdef ARDUINO
#include <UDCP.h>
#include <ArduinoJson.h>
class ResponseBuilder
{
    StaticJsonDocument<4096> doc;
    JsonObject root;
public:
    ResponseBuilder() { root = doc.to<JsonObject>(); }
    void ok(const String &action)
    {
        root["status"] = "ok";
        root["action"] = action;
    }
    void error(const String &action, const String &msg)
    {
        root["status"] = "error";
        root["action"] = action;
        root["error"] = msg;
    }
    JsonObject data()
    {
        if (!root.containsKey("data"))
            root.createNestedObject("data");
        return root["data"];
    }
    JsonArray dataArray(const char *key) { return data().createNestedArray(key); }
    String build()
    {
        String out;
        serializeJson(doc, out);
        return out;
    }
};
class UDCPBridge
{
    Engine &engine_;
    SerialConsole &console_;
    UDCP &udcp_;
public:
    UDCPBridge(Engine &engine, SerialConsole &console, UDCP &udcp) : engine_(engine), console_(console), udcp_(udcp) {}
    String processPacket(const UDCPPacket &pkt)
    {
        const String &action = pkt.action;
        if (action == "compile")
        {
            String code = pkt.value["code"] | "";
            if (code.isEmpty())
            {
                ResponseBuilder rb;
                rb.error("compile", "missing code");
                return rb.build();
            }
            auto r = engine_.compileWithModules(code.c_str());
            ResponseBuilder rb;
            if (r.ok)
            {
                rb.ok("compile");
                auto d = rb.data();
                d["bytecodeSize"] = r.bytecodeSize;
                d["constants"] = r.constantCount;
                d["functions"] = r.functionCount;
                d["tasks"] = r.taskCount;
            }
            else
            {
                rb.error("compile", r.error.c_str());
                rb.data()["line"] = r.errorLine;
            }
            return rb.build();
        }
        if (action == "run")
        {
            if (!engine_.isCompiled())
            {
                ResponseBuilder rb;
                rb.error("run", "not compiled");
                return rb.build();
            }
            engine_.run();
            ResponseBuilder rb;
            rb.ok("run");
            rb.data()["running"] = engine_.isRunning();
            return rb.build();
        }
        if (action == "tick")
        {
            uint32_t ms = pkt.value["ms"] | 10;
            engine_.tick(ms);
            ResponseBuilder rb;
            rb.ok("tick");
            rb.data()["running"] = engine_.isRunning();
            return rb.build();
        }
        if (action == "stop")
        {
            engine_.stop();
            ResponseBuilder rb;
            rb.ok("stop");
            return rb.build();
        }
        if (action == "reset")
        {
            engine_.reset();
            ResponseBuilder rb;
            rb.ok("reset");
            return rb.build();
        }
        if (action == "status")
        {
            ResponseBuilder rb;
            rb.ok("status");
            auto d = rb.data();
            d["compiled"] = engine_.isCompiled();
            d["running"] = engine_.isRunning();
            d["uptime"] = engine_.uptime();
            d["tasks"] = engine_.taskCount();
            return rb.build();
        }
        if (action == "tasks")
        {
            std::vector<TaskInfo> tasks;
            engine_.listTasks(tasks);
            ResponseBuilder rb;
            rb.ok("tasks");
            rb.data()["count"] = (int)tasks.size();
            auto arr = rb.dataArray("tasks");
            for (const auto &t : tasks)
            {
                auto obj = arr.createNestedObject();
                obj["id"] = t.id;
                obj["name"] = t.name;
                obj["status"] = statusToString(t.status);
                obj["active"] = t.active;
                obj["paused"] = t.paused;
                obj["halted"] = t.halted;
                obj["instructions"] = t.totalInstructions;
                obj["runs"] = t.runCount;
            }
            return rb.build();
        }
        if (action == "task_pause")
        {
            uint8_t id = pkt.value["id"] | 0;
            ResponseBuilder rb;
            engine_.pauseTask((TaskId)id) ? rb.ok("task_pause") : rb.error("task_pause", "failed");
            return rb.build();
        }
        if (action == "task_resume")
        {
            uint8_t id = pkt.value["id"] | 0;
            ResponseBuilder rb;
            engine_.resumeTask((TaskId)id) ? rb.ok("task_resume") : rb.error("task_resume", "failed");
            return rb.build();
        }
        if (action == "task_stop")
        {
            uint8_t id = pkt.value["id"] | 0;
            ResponseBuilder rb;
            engine_.stopTask((TaskId)id) ? rb.ok("task_stop") : rb.error("task_stop", "failed");
            return rb.build();
        }
        if (action == "task_restart")
        {
            uint8_t id = pkt.value["id"] | 0;
            ResponseBuilder rb;
            engine_.restartTask((TaskId)id) ? rb.ok("task_restart") : rb.error("task_restart", "failed");
            return rb.build();
        }
        if (action == "task_remove")
        {
            uint8_t id = pkt.value["id"] | 0;
            ResponseBuilder rb;
            engine_.removeTask((TaskId)id) ? rb.ok("task_remove") : rb.error("task_remove", "failed");
            return rb.build();
        }
        if (action == "vars")
        {
            uint8_t id = pkt.value["taskId"] | 0;
            std::vector<VarInfo> vars;
            engine_.getVariables((TaskId)id, vars);
            ResponseBuilder rb;
            rb.ok("vars");
            auto arr = rb.dataArray("variables");
            for (const auto &v : vars)
            {
                auto obj = arr.createNestedObject();
                obj["id"] = v.id;
                obj["local"] = v.isLocal;
                obj["type"] = v.typeStr;
                obj["value"] = v.valueStr;
            }
            return rb.build();
        }
        if (action == "modules")
        {
            std::vector<ModuleInfo> mods;
            engine_.listModules(mods);
            ResponseBuilder rb;
            rb.ok("modules");
            auto arr = rb.dataArray("modules");
            for (const auto &m : mods)
            {
                auto obj = arr.createNestedObject();
                obj["name"] = m.name;
                obj["version"] = m.abiVersion;
                obj["methods"] = m.methodCount;
                obj["plugin"] = m.isPlugin;
            }
            return rb.build();
        }
        if (action == "memory")
        {
            auto m = engine_.getMemoryInfo();
            ResponseBuilder rb;
            rb.ok("memory");
            auto d = rb.data();
            d["bytecodeSize"] = m.bytecodeSize;
            d["constants"] = m.constantCount;
            d["arrays"] = m.totalArrays;
            d["estimatedRam"] = m.estimatedRam;
            d["freeHeap"] = m.freeHeap;
            d["totalHeap"] = m.totalHeap;
            return rb.build();
        }
        if (action == "cpu")
        {
            auto c = engine_.getCpuInfo();
            ResponseBuilder rb;
            rb.ok("cpu");
            auto d = rb.data();
            d["lastTickUs"] = c.lastTickUs;
            d["uptimeMs"] = c.uptimeMs;
            d["totalInstructions"] = c.totalInstructions;
            d["taskCount"] = c.taskCount;
            d["freeHeap"] = c.freeHeap;
            return rb.build();
        }
        if (action == "grammar")
        {
            auto g = engine_.getGrammar();
            ResponseBuilder rb;
            rb.ok("grammar");
            auto d = rb.data();
            auto kw = d.createNestedArray("keywords");
            for (const auto &k : g.keywords)
                kw.add(k);
            auto mods = d.createNestedArray("modules");
            for (const auto &m : g.modules)
            {
                auto obj = mods.createNestedObject();
                obj["name"] = m.name;
                auto meths = obj.createNestedArray("methods");
                for (const auto &me : m.methods)
                    meths.add(me);
            }
            return rb.build();
        }
        if (action == "tokenize")
        {
            String code = pkt.value["code"] | "";
            auto tokens = engine_.tokenize(code.c_str());
            ResponseBuilder rb;
            rb.ok("tokenize");
            auto arr = rb.dataArray("tokens");
            for (const auto &t : tokens)
            {
                auto obj = arr.createNestedObject();
                obj["type"] = t.type;
                obj["value"] = t.value;
                obj["line"] = t.line;
            }
            return rb.build();
        }
        if (action == "device_status")
        {
            ResponseBuilder rb;
            rb.ok("device_status");
            auto d = rb.data();
            d["deviceId"] = udcp_.getDeviceId();
            d["uptime"] = udcp_.getUptime();
            d["freeHeap"] = udcp_.getFreeHeap();
            d["clients"] = udcp_.getClientCount();
            d["engineCompiled"] = engine_.isCompiled();
            d["engineRunning"] = engine_.isRunning();
            d["engineUptime"] = engine_.uptime();
            return rb.build();
        }
        if (action == "console")
        {
            String cmd = pkt.value["command"] | "";
            std::string response = console_.processLine(cmd.c_str());
            ResponseBuilder rb;
            rb.ok("console");
            rb.data()["output"] = response;
            return rb.build();
        }
        if (action == "rules")
        {
            std::vector<RuleEntry> entries;
            g_ruleEngine.listRules(entries);
            ResponseBuilder rb;
            rb.ok("rules");
            rb.data()["count"] = (int)entries.size();
            auto arr = rb.dataArray("rules");
            for (size_t i = 0; i < entries.size(); i++)
            {
                const RuleEntry &e = entries[i];
                if (!e.rule)
                    continue;
                auto obj = arr.createNestedObject();
                obj["index"] = e.index;
                obj["name"] = e.rule->name;
                obj["enabled"] = e.rule->enabled;
                obj["priority"] = (int)e.rule->priority;
                obj["fires"] = e.rule->fireCount;
                obj["conditions"] = (int)e.rule->condCount;
                obj["actions"] = (int)e.rule->actionCount;
            }
            return rb.build();
        }
        ResponseBuilder rb;
        rb.error("unknown", ("Unknown action: " + action).c_str());
        return rb.build();
    }
};
#endif // ARDUINO
#endif
```

### src\Core\Core.h
```
#ifndef ESPDSL_CORE_H
#define ESPDSL_CORE_H
#include <stdint.h>
#include <stddef.h>
#include <string>
#include <deque>
#include <vector>
#include <cmath>
#include <cstring>
#include <memory>
#include <iostream>
#include <map>
#include <fstream>
#include "ResourceQuota.h"
enum class VMStatus : uint8_t
{
    OK,
    YIELD,
    WAIT,
    HALT,
    BREAKPOINT,
    SLICE_END,
    ERR_STACK_OVERFLOW,
    ERR_STACK_UNDERFLOW,
    ERR_INVALID_OPCODE,
    ERR_INVALID_MODULE,
    ERR_INVALID_FUNC,
    ERR_INVALID_ARG,
    ERR_DIV_BY_ZERO,
    ERR_TYPE_MISMATCH,
    ERR_OUT_OF_BOUNDS,
    ERR_CONST_OUT_OF_BOUNDS,
    ERR_VAR_OUT_OF_BOUNDS,
    ERR_TOO_MANY_ARGS,
    ERR_INVALID_JUMP,
    ERR_CALL_STACK_OVERFLOW,
    ERR_CALL_STACK_UNDERFLOW,
    ERR_INDEX_OUT_OF_BOUNDS,
    ERR_NOT_ARRAY,
    ERR_QUOTA_EXCEEDED,
    ERR_MEMORY_LIMIT,
    ERR_CPU_LIMIT,
    ERR_UNRESOLVED_IMPORT,
    ERR_MODULE_NOT_FOUND,
    ERR_NOT_STRING,
    ERR_BREAK_OUTSIDE_LOOP,
    ERR_VERIFICATION_FAILED,
    ERR_STACK_DEPTH
};
inline const char *statusToString(VMStatus s)
{
    switch (s)
    {
    case VMStatus::OK:
        return "OK";
    case VMStatus::YIELD:
        return "YIELD";
    case VMStatus::WAIT:
        return "WAIT";
    case VMStatus::HALT:
        return "HALT";
    case VMStatus::BREAKPOINT:
        return "BREAKPOINT";
    case VMStatus::SLICE_END:
        return "SLICE_END";
    case VMStatus::ERR_STACK_OVERFLOW:
        return "StackOvf";
    case VMStatus::ERR_STACK_UNDERFLOW:
        return "StackUdf";
    case VMStatus::ERR_INVALID_OPCODE:
        return "BadOp";
    case VMStatus::ERR_INVALID_MODULE:
        return "BadMod";
    case VMStatus::ERR_INVALID_FUNC:
        return "BadFunc";
    case VMStatus::ERR_INVALID_ARG:
        return "BadArg";
    case VMStatus::ERR_DIV_BY_ZERO:
        return "Div0";
    case VMStatus::ERR_TYPE_MISMATCH:
        return "TypeErr";
    case VMStatus::ERR_OUT_OF_BOUNDS:
        return "OOB";
    case VMStatus::ERR_CONST_OUT_OF_BOUNDS:
        return "ConstOOB";
    case VMStatus::ERR_VAR_OUT_OF_BOUNDS:
        return "VarOOB";
    case VMStatus::ERR_TOO_MANY_ARGS:
        return "TooManyArgs";
    case VMStatus::ERR_INVALID_JUMP:
        return "BadJmp";
    case VMStatus::ERR_CALL_STACK_OVERFLOW:
        return "CallOvf";
    case VMStatus::ERR_CALL_STACK_UNDERFLOW:
        return "CallUdf";
    case VMStatus::ERR_INDEX_OUT_OF_BOUNDS:
        return "IdxOOB";
    case VMStatus::ERR_NOT_ARRAY:
        return "NotArr";
    case VMStatus::ERR_QUOTA_EXCEEDED:
        return "Quota";
    case VMStatus::ERR_MEMORY_LIMIT:
        return "MemLim";
    case VMStatus::ERR_CPU_LIMIT:
        return "CPULim";
    case VMStatus::ERR_UNRESOLVED_IMPORT:
        return "Unresolved";
    case VMStatus::ERR_MODULE_NOT_FOUND:
        return "ModNotFound";
    case VMStatus::ERR_NOT_STRING:
        return "NotStr";
    case VMStatus::ERR_BREAK_OUTSIDE_LOOP:
        return "BreakOutside";
    case VMStatus::ERR_VERIFICATION_FAILED:
        return "VerifyFail";
    case VMStatus::ERR_STACK_DEPTH:
        return "StackDepth";
    }
    return "?";
}
inline bool isError(VMStatus s) { return (uint8_t)s >= (uint8_t)VMStatus::ERR_STACK_OVERFLOW; }
enum class ValueType : uint8_t
{
    INT,
    FLOAT,
    BOOL,
    STRING,
    NONE,
    ARRAY
};
class StringArena
{
    std::deque<std::string> storage;
public:
    const char *intern(const std::string &s)
    {
        for (const auto &str : storage)
            if (str == s)
                return str.c_str();
        storage.push_back(s);
        return storage.back().c_str();
    }
    void clear() { storage.clear(); }
    size_t size() const { return storage.size(); }
    std::vector<std::string> getAll() const { return {storage.begin(), storage.end()}; }
    void loadFrom(const std::vector<std::string> &v)
    {
        storage.clear();
        for (auto &s : v)
            storage.push_back(s);
    }
};
struct VMArray;
struct VMValue
{
    ValueType type;
    union
    {
        int32_t i;
        float f;
        bool b;
        const char *s;
        VMArray *arr;
    } data;
    static VMValue Int(int32_t v)
    {
        VMValue r;
        r.type = ValueType::INT;
        r.data.i = v;
        return r;
    }
    static VMValue Float(float v)
    {
        VMValue r;
        r.type = ValueType::FLOAT;
        r.data.f = v;
        return r;
    }
    static VMValue Bool(bool v)
    {
        VMValue r;
        r.type = ValueType::BOOL;
        r.data.b = v;
        return r;
    }
    static VMValue Str(const char *v)
    {
        VMValue r;
        r.type = ValueType::STRING;
        r.data.s = v;
        return r;
    }
    static VMValue Arr(VMArray *v)
    {
        VMValue r;
        r.type = ValueType::ARRAY;
        r.data.arr = v;
        return r;
    }
    static VMValue None()
    {
        VMValue r;
        r.type = ValueType::NONE;
        r.data.i = 0;
        return r;
    }
    bool isNumber() const { return type == ValueType::INT || type == ValueType::FLOAT; }
    bool isTruthy() const
    {
        switch (type)
        {
        case ValueType::INT:
            return data.i != 0;
        case ValueType::FLOAT:
            return data.f != 0.0f;
        case ValueType::BOOL:
            return data.b;
        case ValueType::STRING:
            return data.s && data.s[0];
        case ValueType::ARRAY:
            return data.arr != nullptr;
        case ValueType::NONE:
            return false;
        }
        return false;
    }
    float toFloat() const
    {
        switch (type)
        {
        case ValueType::INT:
            return (float)data.i;
        case ValueType::FLOAT:
            return data.f;
        case ValueType::BOOL:
            return data.b ? 1.0f : 0.0f;
        default:
            return 0.0f;
        }
    }
    int32_t toInt() const
    {
        switch (type)
        {
        case ValueType::INT:
            return data.i;
        case ValueType::FLOAT:
            return (int32_t)data.f;
        case ValueType::BOOL:
            return data.b ? 1 : 0;
        default:
            return 0;
        }
    }
    std::string toString() const;
    std::string typeStr() const
    {
        switch (type)
        {
        case ValueType::INT:
            return "INT";
        case ValueType::FLOAT:
            return "FLOAT";
        case ValueType::BOOL:
            return "BOOL";
        case ValueType::STRING:
            return "STRING";
        case ValueType::ARRAY:
            return "ARRAY";
        case ValueType::NONE:
            return "NONE";
        }
        return "?";
    }
};
struct VMArray
{
    std::vector<VMValue> elements;
    VMValue get(int32_t i) const { return (i >= 0 && i < (int32_t)elements.size()) ? elements[i] : VMValue::None(); }
    bool set(int32_t i, VMValue v)
    {
        if (i < 0 || i >= (int32_t)elements.size())
            return false;
        elements[i] = v;
        return true;
    }
    void push(VMValue v) { elements.push_back(v); }
    int32_t length() const { return (int32_t)elements.size(); }
};
inline std::string VMValue::toString() const
{
    switch (type)
    {
    case ValueType::INT:
        return std::to_string(data.i);
    case ValueType::FLOAT:
        return std::to_string(data.f);
    case ValueType::BOOL:
        return data.b ? "true" : "false";
    case ValueType::STRING:
        return data.s ? std::string(data.s) : "";
    case ValueType::ARRAY:
    {
        if (!data.arr)
            return "[]";
        std::string r = "[";
        for (int i = 0; i < data.arr->length(); i++)
        {
            if (i)
                r += ",";
            r += data.arr->elements[i].toString();
        }
        return r + "]";
    }
    case ValueType::NONE:
        return "none";
    }
    return "?";
}
inline bool floatEqual(float a, float b, float eps = 0.0001f) { return std::fabs(a - b) < eps; }
inline bool timeReached(uint32_t now, uint32_t target) { return (int32_t)(now - target) >= 0; }
enum OpCode : uint8_t
{
    OP_NOP = 0x00,
    OP_PUSH_CONST = 0x01,
    OP_STORE = 0x02,
    OP_LOAD = 0x03,
    OP_CALL = 0x04,
    OP_CALL_VOID = 0x05,
    OP_ADD = 0x10,
    OP_SUB = 0x11,
    OP_MUL = 0x12,
    OP_DIV = 0x13,
    OP_MOD = 0x14,
    OP_CMP_EQ = 0x20,
    OP_CMP_NE = 0x21,
    OP_CMP_LT = 0x22,
    OP_CMP_GT = 0x23,
    OP_CMP_LTE = 0x24,
    OP_CMP_GTE = 0x25,
    OP_AND = 0x26,
    OP_OR = 0x27,
    OP_NOT = 0x28,
    OP_JMP = 0x30,
    OP_JZ = 0x31,
    OP_JNZ = 0x32,
    OP_POP = 0x40,
    OP_DUP = 0x41,
    OP_MAKE_ARRAY = 0x42,
    OP_INDEX_GET = 0x43,
    OP_INDEX_SET = 0x44,
    OP_LENGTH = 0x45,
    OP_FUNC_CALL = 0x46,
    OP_RETURN = 0x47,
    OP_RETURN_NONE = 0x48,
    OP_STORE_LOCAL = 0x49,
    OP_LOAD_LOCAL = 0x4A,
    OP_ARRAY_PUSH = 0x4B,
    OP_STR_CONCAT = 0x4C,
    OP_CAST_INT = 0x4D,
    OP_CAST_FLOAT = 0x4E,
    OP_CAST_STR = 0x4F,
    OP_WAIT = 0x50,
    OP_WAIT_DYN = 0x51,
    OP_YIELD = 0x52,
    OP_HALT = 0xFF
};
struct CallFrame
{
    size_t returnAddr;
    int stackBase;
    uint8_t localCount;
    VMValue locals[32];
};
enum class SymbolType : uint8_t
{
    FUNCTION,
    VARIABLE,
    CONSTANT
};
struct ExportSymbol
{
    std::string name;
    SymbolType type;
    uint16_t address;
    uint8_t paramCount;
};
struct ImportRequest
{
    std::string moduleName;
    std::string symbolName;
    size_t patchAddress;
};
struct TaskEntry
{
    std::string name;
    uint16_t entryPoint;
};
struct FuncEntry
{
    std::string name;
    uint16_t entryPoint;
    uint8_t paramCount;
    std::vector<std::string> paramNames;
};
struct ProgramBinary
{
    std::string name;
    std::vector<uint8_t> bytecode;
    std::vector<VMValue> constants;
    std::vector<TaskEntry> tasks;
    std::vector<FuncEntry> functions;
    std::vector<ExportSymbol> exports;
    std::vector<ImportRequest> imports;
    std::shared_ptr<StringArena> arena;
    ProgramBinary() : arena(std::make_shared<StringArena>()) {}
    const ExportSymbol *findExport(const std::string &n) const
    {
        for (const auto &e : exports)
            if (e.name == n)
                return &e;
        return nullptr;
    }
};
struct VMSnapshot
{
    std::vector<VMValue> stack;
    int sp;
    std::vector<VMValue> vars;
    struct FrameSnap
    {
        size_t retAddr;
        int stackBase;
        uint8_t localCnt;
        std::vector<VMValue> locals;
    };
    std::vector<FrameSnap> frames;
    int fp;
    size_t ip;
    VMStatus status;
    uint32_t waitUntil;
    struct ArrSnap
    {
        std::vector<VMValue> elements;
    };
    std::vector<ArrSnap> arrays;
    std::vector<std::string> strings;
};
#endif
```

### src\Core\Logger.cpp
```
#include "Logger.h"
Logger g_logger;
```

### src\Core\Logger.h
```
#ifndef ESPDSL_LOGGER_H
#define ESPDSL_LOGGER_H
#include <string>
#include <vector>
#include <functional>
#include <iostream>
enum class LogLevel : uint8_t
{
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    NONE = 5
};
struct LogRecord
{
    LogLevel level;
    std::string category;
    std::string message;
};
using LogSink = std::function<void(const LogRecord &)>;
class Logger
{
    LogLevel minLevel_ = LogLevel::INFO;
    std::vector<LogSink> sinks_;
public:
    void setLevel(LogLevel l) { minLevel_ = l; }
    void addSink(LogSink s) { sinks_.push_back(s); }
    void addConsoleSink()
    {
        addSink([](const LogRecord &r)
                { const char* l[]={"TRC","DBG","INF","WRN","ERR"}; std::cout<<"["<<l[(int)r.level]<<"]["<<r.category<<"] "<<r.message<<"\n"; });
    }
    void log(LogLevel level, const std::string &cat, const std::string &msg)
    {
        if (level < minLevel_)
            return;
        LogRecord r{level, cat, msg};
        for (auto &s : sinks_)
            s(r);
    }
    void trace(const std::string &c, const std::string &m) { log(LogLevel::TRACE, c, m); }
    void debug(const std::string &c, const std::string &m) { log(LogLevel::DEBUG, c, m); }
    void info(const std::string &c, const std::string &m) { log(LogLevel::INFO, c, m); }
    void warn(const std::string &c, const std::string &m) { log(LogLevel::WARN, c, m); }
    void error(const std::string &c, const std::string &m) { log(LogLevel::ERROR, c, m); }
};
extern Logger g_logger;
#define LOG_TRACE(c, m) g_logger.trace(c, m)
#define LOG_DEBUG(c, m) g_logger.debug(c, m)
#define LOG_INFO(c, m) g_logger.info(c, m)
#define LOG_WARN(c, m) g_logger.warn(c, m)
#define LOG_ERROR(c, m) g_logger.error(c, m)
#endif
```

### src\Core\Error.h
```
#ifndef ESPDSL_ERROR_H
#define ESPDSL_ERROR_H
#include <string>
#include <vector>
#include <iostream>
enum class Severity
{
    INFO,
    WARNING,
    ERROR,
    FATAL
};
struct SourceLocation
{
    std::string file;
    int line = 0;
    int col = 0;
    std::string format() const
    {
        std::string s;
        if (!file.empty())
            s += file + ":";
        s += std::to_string(line);
        return s;
    }
};
struct Diagnostic
{
    Severity severity;
    std::string message;
    SourceLocation loc;
    std::string hint;
    std::string format() const
    {
        const char *sv[] = {"INFO", "WARN", "ERROR", "FATAL"};
        std::string s = "[";
        s += sv[(int)severity];
        s += "] ";
        if (loc.line > 0)
            s += loc.format() + " ";
        s += message;
        if (!hint.empty())
            s += "\n  Hint: " + hint;
        return s;
    }
};
class DiagnosticEngine
{
    std::vector<Diagnostic> diags;
    int errors_ = 0, warnings_ = 0;
public:
    void emit(Severity s, const std::string &msg, SourceLocation loc = {}, const std::string &hint = "")
    {
        diags.push_back({s, msg, loc, hint});
        if (s == Severity::ERROR || s == Severity::FATAL)
            errors_++;
        if (s == Severity::WARNING)
            warnings_++;
    }
    void error(const std::string &m, SourceLocation l = {}, const std::string &h = "") { emit(Severity::ERROR, m, l, h); }
    void warning(const std::string &m, SourceLocation l = {}, const std::string &h = "") { emit(Severity::WARNING, m, l, h); }
    bool hasErrors() const { return errors_ > 0; }
    int errorCount() const { return errors_; }
    void printAll() const
    {
        for (const auto &d : diags)
            std::cout << d.format() << "\n";
    }
    void clear()
    {
        diags.clear();
        errors_ = warnings_ = 0;
    }
};
extern DiagnosticEngine g_diagnostics;
#endif
```

### src\Core\ResourceQuota.h
```
#ifndef ESPDSL_RESOURCE_QUOTA_H
#define ESPDSL_RESOURCE_QUOTA_H
#include <stdint.h>
#include <string>
struct ResourceQuota
{
    uint32_t maxInstructionsPerTick = 200000;
    uint32_t maxInstructionsTotal = 0;
    uint32_t maxStackDepth = 64;
    uint32_t maxCallDepth = 32;
    uint32_t maxVariables = 128;
    uint32_t maxArrayElements = 1024;
    uint32_t maxArrayCount = 32;
    uint32_t maxCallArgs = 8;
    uint32_t maxLocalVars = 32;
};
struct ResourceUsage
{
    uint32_t instructionsThisTick = 0;
    uint32_t instructionsTotal = 0;
    uint32_t peakStackDepth = 0;
    uint32_t peakCallDepth = 0;
    uint32_t arrayCount = 0;
    uint32_t totalArrayElements = 0;
    std::string report() const
    {
        return "tick=" + std::to_string(instructionsThisTick) + " total=" + std::to_string(instructionsTotal) + " peakStack=" + std::to_string(peakStackDepth) + " arrays=" + std::to_string(arrayCount);
    }
};
struct QuotaProfiles
{
    static ResourceQuota standard() { return {}; }
    static ResourceQuota strict()
    {
        ResourceQuota q;
        q.maxInstructionsPerTick = 10000;
        q.maxStackDepth = 32;
        q.maxCallDepth = 8;
        q.maxArrayCount = 8;
        return q;
    }
    static ResourceQuota esp8266()
    {
        ResourceQuota q;
        q.maxInstructionsPerTick = 5000;
        q.maxStackDepth = 16;
        q.maxCallDepth = 8;
        q.maxVariables = 32;
        q.maxArrayElements = 64;
        q.maxArrayCount = 4;
        return q;
    }
    static ResourceQuota esp32()
    {
        ResourceQuota q;
        q.maxInstructionsPerTick = 100000;
        return q;
    }
};
#endif
```

### src\Debug\Debugger.cpp
```
#include "Debugger.h"Debugger g_debugger;
```

### src\Debug\Debugger.h
```
#ifndef ESPDSL_DEBUGGER_H
#define ESPDSL_DEBUGGER_H
#include "../Core/Core.h"
#include "../Runtime/RuntimeIds.h"
#include <iostream>
enum class DebugStepMode : uint8_t
{
    NONE,
    CONTINUE,
    STEP_IN,
    STEP_OVER,
    STEP_OUT
};
struct DebugBreakpoint
{
    bool used = false;
    bool enabled = true;
    uint16_t address = 0;
    uint16_t hitCount = 0;
};
struct DebugExecLog
{
    uint16_t ip = 0;
    uint8_t opcode = 0;
    int8_t sp = -1;
    int8_t fp = -1;
};
class Debugger
{
    bool enabled_ = false;
    DebugStepMode stepMode = DebugStepMode::NONE;
    int8_t stepBaseFp = -1;
    DebugBreakpoint breakpoints[MAX_BREAKPOINTS];
    DebugExecLog execLog[MAX_EXEC_LOG];
    uint16_t execHead = 0, execCount = 0;
public:
    void enable() { enabled_ = true; }
    void disable()
    {
        enabled_ = false;
        stepMode = DebugStepMode::NONE;
    }
    bool enabled() const { return enabled_; }
    bool addBreakpoint(uint16_t addr)
    {
        for (auto &b : breakpoints)
            if (!b.used)
            {
                b.used = true;
                b.enabled = true;
                b.address = addr;
                b.hitCount = 0;
                return true;
            }
        return false;
    }
    void removeBreakpoint(uint16_t addr)
    {
        for (auto &b : breakpoints)
            if (b.used && b.address == addr)
                b.used = false;
    }
    void clearBreakpoints()
    {
        for (auto &b : breakpoints)
            b.used = false;
    }
    void stepIn() { stepMode = DebugStepMode::STEP_IN; }
    void stepOver(int8_t fp)
    {
        stepMode = DebugStepMode::STEP_OVER;
        stepBaseFp = fp;
    }
    void stepOut(int8_t fp)
    {
        stepMode = DebugStepMode::STEP_OUT;
        stepBaseFp = fp;
    }
    void cont() { stepMode = DebugStepMode::CONTINUE; }
    bool shouldBreak(uint16_t ip, int8_t fp)
    {
        if (!enabled_)
            return false;
        for (auto &b : breakpoints)
            if (b.used && b.enabled && b.address == ip)
            {
                b.hitCount++;
                stepMode = DebugStepMode::NONE;
                return true;
            }
        switch (stepMode)
        {
        case DebugStepMode::STEP_IN:
            stepMode = DebugStepMode::NONE;
            return true;
        case DebugStepMode::STEP_OVER:
            if (fp <= stepBaseFp)
            {
                stepMode = DebugStepMode::NONE;
                return true;
            }
            break;
        case DebugStepMode::STEP_OUT:
            if (fp < stepBaseFp)
            {
                stepMode = DebugStepMode::NONE;
                return true;
            }
            break;
        default:
            break;
        }
        return false;
    }
    void logExec(uint16_t ip, uint8_t opcode, int8_t sp, int8_t fp)
    {
        uint16_t idx = (uint16_t)((execHead + execCount) % MAX_EXEC_LOG);
        if (execCount < MAX_EXEC_LOG)
        {
            execLog[idx] = {ip, opcode, sp, fp};
            execCount++;
        }
        else
        {
            execLog[execHead] = {ip, opcode, sp, fp};
            execHead = (uint16_t)((execHead + 1) % MAX_EXEC_LOG);
        }
    }
    template <typename Ctx>
    void checkWatches(const Ctx &) {}
    template <typename Ctx>
    void printState(const Ctx &ctx) const
    {
        std::cout << "=== Debug ===\nIP=" << ctx.ip << " SP=" << ctx.sp << " FP=" << ctx.fp << " " << statusToString(ctx.status) << "\nStack:";
        for (int i = 0; i <= ctx.sp && i < 12; i++)
            std::cout << " " << ctx.stack[i].toString();
        std::cout << "\nGlobals:\n";
        for (int i = 0; i < Ctx::VAR_COUNT; i++)
            if (ctx.vars[i].type != ValueType::NONE)
                std::cout << "  g" << i << "=" << ctx.vars[i].toString() << "\n";
        if (ctx.inFrame())
        {
            std::cout << "Locals:\n";
            for (int i = 0; i < ctx.frames[ctx.fp].localCount; i++)
                std::cout << "  l" << i << "=" << ctx.frames[ctx.fp].locals[i].toString() << "\n";
        }
    }
    void printLog(uint16_t last = 16) const
    {
        std::cout << "=== Exec Log ===\n";
        uint16_t start = (execCount > last) ? (execCount - last) : 0;
        for (uint16_t i = start; i < execCount; i++)
        {
            uint16_t idx = (uint16_t)((execHead + i) % MAX_EXEC_LOG);
            std::cout << "  ip=" << execLog[idx].ip << " op=0x" << std::hex << (int)execLog[idx].opcode << std::dec << " sp=" << (int)execLog[idx].sp << " fp=" << (int)execLog[idx].fp << "\n";
        }
    }
};
extern Debugger g_debugger;
#endif
```

