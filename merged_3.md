### src\Stdlib\StorageLib.cpp
```
#include "StorageLib.h"#include "../VM/VM.h"#include "../Stdlib/StringLib.h"#include <map>#include <fstream>static std::map<std::string, VMValue> kvStore;static VMValue kv_set(int c, VMValue *a){    if (c < 2 || a[0].type != ValueType::STRING)        return VMValue::Bool(false);    kvStore[a[0].data.s] = a[1];    return VMValue::Bool(true);}static VMValue kv_get(int c, VMValue *a){    if (c < 1 || a[0].type != ValueType::STRING)        return VMValue::None();    auto it = kvStore.find(a[0].data.s);    if (it != kvStore.end())        return it->second;    return (c >= 2) ? a[1] : VMValue::None();}static VMValue kv_has(int c, VMValue *a){    if (c < 1 || a[0].type != ValueType::STRING)        return VMValue::Bool(false);    return VMValue::Bool(kvStore.count(a[0].data.s) > 0);}static VMValue kv_remove(int c, VMValue *a){    if (c < 1 || a[0].type != ValueType::STRING)        return VMValue::Bool(false);    return VMValue::Bool(kvStore.erase(a[0].data.s) > 0);}static VMValue kv_count(int, VMValue *){    return VMValue::Int((int32_t)kvStore.size());}static VMValue kv_save(int, VMValue *){    std::ofstream f("espdsl_kv.dat");    if (!f)        return VMValue::Bool(false);    for (std::map<std::string, VMValue>::iterator it = kvStore.begin(); it != kvStore.end(); ++it)    {        if (it->second.type == ValueType::INT)            f << "I:" << it->first << "=" << it->second.data.i << "\n";        else if (it->second.type == ValueType::BOOL)            f << "B:" << it->first << "=" << (it->second.data.b ? 1 : 0) << "\n";        else if (it->second.type == ValueType::STRING)            f << "S:" << it->first << "=" << (it->second.data.s ? it->second.data.s : "") << "\n";    }    return VMValue::Bool(true);}static ModuleFuncEntry kv_m[] = {    {"set", kv_set},    {"get", kv_get},    {"has", kv_has},    {"remove", kv_remove},    {"count", kv_count},    {"save", kv_save}};void registerStorageModule(){    g_moduleRegistry.registerModule({"storage", 1, kv_m, 6});}
```

### src\Stdlib\StorageLib.h
```
#ifndef ESPDSL_STORAGELIB_H
#define ESPDSL_STORAGELIB_H
void registerStorageModule();
#endif
```

### src\Stdlib\StringLib.h
```
#ifndef ESPDSL_STRINGLIB_H
#define ESPDSL_STRINGLIB_H
#include "../Core/Core.h"
extern StringArena g_runtimeArena;
void registerStringModule();
#endif
```

### src\Stdlib\StringLib.cpp
```
#include "StringLib.h"#include "../VM/VM.h"#include <algorithm>#include <string>StringArena g_runtimeArena;static VMValue s_length(int c, VMValue *a){    return (c < 1 || a[0].type != ValueType::STRING)               ? VMValue::Int(0)               : VMValue::Int((int32_t)strlen(a[0].data.s));}static VMValue s_upper(int c, VMValue *a){    if (c < 1 || a[0].type != ValueType::STRING)        return VMValue::Str("");    std::string s = a[0].data.s;    std::transform(s.begin(), s.end(), s.begin(), ::toupper);    return VMValue::Str(g_runtimeArena.intern(s));}static VMValue s_lower(int c, VMValue *a){    if (c < 1 || a[0].type != ValueType::STRING)        return VMValue::Str("");    std::string s = a[0].data.s;    std::transform(s.begin(), s.end(), s.begin(), ::tolower);    return VMValue::Str(g_runtimeArena.intern(s));}static VMValue s_substr(int c, VMValue *a){    if (c < 2 || a[0].type != ValueType::STRING)        return VMValue::Str("");    std::string s = a[0].data.s;    int st = a[1].toInt();    int ln = (c >= 3) ? a[2].toInt() : (int)s.size() - st;    if (st < 0 || st >= (int)s.size())        return VMValue::Str("");    return VMValue::Str(g_runtimeArena.intern(s.substr(st, ln)));}static VMValue s_find(int c, VMValue *a){    if (c < 2 || a[0].type != ValueType::STRING || a[1].type != ValueType::STRING)        return VMValue::Int(-1);    std::string s = a[0].data.s;    auto p = s.find(a[1].data.s);    return VMValue::Int(p == std::string::npos ? -1 : (int32_t)p);}static VMValue s_contains(int c, VMValue *a){    if (c < 2 || a[0].type != ValueType::STRING || a[1].type != ValueType::STRING)        return VMValue::Bool(false);    return VMValue::Bool(std::string(a[0].data.s).find(a[1].data.s) != std::string::npos);}static VMValue s_trim(int c, VMValue *a){    if (c < 1 || a[0].type != ValueType::STRING)        return VMValue::Str("");    std::string s = a[0].data.s;    size_t st = s.find_first_not_of(" \t\n\r");    if (st == std::string::npos)        return VMValue::Str(g_runtimeArena.intern(""));    size_t en = s.find_last_not_of(" \t\n\r");    return VMValue::Str(g_runtimeArena.intern(s.substr(st, en - st + 1)));}static VMValue s_replace(int c, VMValue *a){    if (c < 3 || a[0].type != ValueType::STRING)        return VMValue::Str("");    std::string s = a[0].data.s;    std::string from = a[1].toString();    std::string to = a[2].toString();    size_t pos = 0;    while ((pos = s.find(from, pos)) != std::string::npos)    {        s.replace(pos, from.length(), to);        pos += to.length();    }    return VMValue::Str(g_runtimeArena.intern(s));}static VMValue s_repeat(int c, VMValue *a){    if (c < 2 || a[0].type != ValueType::STRING)        return VMValue::Str("");    std::string s = a[0].data.s;    std::string r;    int n = a[1].toInt();    for (int i = 0; i < n && r.size() < 10000; i++)        r += s;    return VMValue::Str(g_runtimeArena.intern(r));}static ModuleFuncEntry str_m[] = {    {"length", s_length},    {"upper", s_upper},    {"lower", s_lower},    {"substr", s_substr},    {"find", s_find},    {"contains", s_contains},    {"trim", s_trim},    {"replace", s_replace},    {"repeat", s_repeat}};void registerStringModule(){    g_moduleRegistry.registerModule({"str", 1, str_m, 9});}
```

### src\Stdlib\TimeLib.cpp
```
#include "TimeLib.h"#include "../VM/VM.h"#include <chrono>#include <ctime>static uint32_t startMs = 0;static VMValue t_millis(int, VMValue *){    using namespace std::chrono;    uint32_t now = (uint32_t)duration_cast<milliseconds>(                       steady_clock::now().time_since_epoch())                       .count();    if (!startMs)        startMs = now;    return VMValue::Int((int32_t)(now - startMs));}static VMValue t_seconds(int, VMValue *){    using namespace std::chrono;    uint32_t now = (uint32_t)duration_cast<milliseconds>(                       steady_clock::now().time_since_epoch())                       .count();    if (!startMs)        startMs = now;    return VMValue::Int((int32_t)((now - startMs) / 1000));}static VMValue t_hour(int, VMValue *){    time_t t = time(0);    return VMValue::Int(localtime(&t)->tm_hour);}static VMValue t_minute(int, VMValue *){    time_t t = time(0);    return VMValue::Int(localtime(&t)->tm_min);}static ModuleFuncEntry time_m[] = {    {"millis", t_millis},    {"seconds", t_seconds},    {"hour", t_hour},    {"minute", t_minute}};void registerTimeModule(){    g_moduleRegistry.registerModule({"time", 1, time_m, 4});}
```

### src\Stdlib\TimeLib.h
```
#ifndef ESPDSL_TIMELIB_H
#define ESPDSL_TIMELIB_H
void registerTimeModule();
#endif
```

### src\Tools\CLI.h
```
#ifndef ESPDSL_CLI_H
#define ESPDSL_CLI_H
#include "../Lang/Lexer.h"
#include "../Lang/Parser.h"
#include "../Lang/Compiler.h"
#include "../VM/VM.h"
#include "../Runtime/Scheduler.h"
#include "../Modules.h"
#include "../Debug/Disassembler.h"
#include <fstream>
class CLITool {
    static std::string readFile(const std::string& path) {
        std::ifstream f(path);
        if (!f) throw std::runtime_error("Cannot open: " + path);
        return std::string(std::istreambuf_iterator<char>(f), std::istreambuf_iterator<char>());
    }
    static ProgramBinary compileSource(const std::string& src) {
        Lexer lex(src);
        Parser par(lex.tokenize());
        std::unique_ptr<ASTNode> ast = par.parse();
        Compiler comp;
        return comp.compile(ast.get());
    }
public:
    int run(int argc, char** argv) {
        if (argc < 3) {
            printUsage(argv[0]);
            return 1;
        }
        std::string cmd = argv[1];
        std::string file = argv[2];
        registerBuiltinModules();
        registerRuntimeModules();
        try {
            if (cmd == "run" || cmd == "r") {
                ProgramBinary prog = compileSource(readFile(file));
                VirtualMachine vm(prog.bytecode.data(), prog.bytecode.size(),
                                  prog.constants.data(), prog.constants.size());
                vm.registerFuncSymbols(prog.functions, prog.tasks);
                VerifyResult vr = vm.verify();
                if (!vr.ok) {
                    std::cerr << "Verify: " << vr.error << "\n";
                    return 1;
                }
                Scheduler sched(&vm);
                for (size_t i = 0; i < prog.tasks.size(); i++)
                    sched.addTask(prog.tasks[i].name.c_str(), prog.tasks[i].entryPoint);
                sched.addTask("__main__", 0);
                uint32_t time = 0;
                while (!sched.allDone() && time < 1000000) {
                    sched.tick(time);
                    time += 10;
                }
                return 0;
            }
            if (cmd == "disasm" || cmd == "d") {
                ProgramBinary prog = compileSource(readFile(file));
                Disassembler d(prog.bytecode.data(), prog.bytecode.size(),
                               prog.constants.data(), prog.constants.size());
                d.print();
                return 0;
            }
            if (cmd == "verify" || cmd == "v") {
                ProgramBinary prog = compileSource(readFile(file));
                VirtualMachine vm(prog.bytecode.data(), prog.bytecode.size(),
                                  prog.constants.data(), prog.constants.size());
                VerifyResult vr = vm.verify();
                std::cout << (vr.ok ? "OK" : "FAIL: " + vr.error) << "\n";
                return vr.ok ? 0 : 1;
            }
        } catch (const std::exception& e) {
            std::cerr << "Error: " << e.what() << "\n";
            return 1;
        }
        printUsage(argv[0]);
        return 1;
    }
    static void printUsage(const char* p) {
        std::cout << "espdsl <command> <file.dsl>\n";
        std::cout << "  run    Run script\n";
        std::cout << "  disasm Disassemble bytecode\n";
        std::cout << "  verify Verify bytecode\n";
    }
};
#endif
```

### src\VM\StackTrace.h
```
#ifndef ESPDSL_STACK_TRACE_H
#define ESPDSL_STACK_TRACE_H
#include "../Core/Core.h"
#include <string>
#include <vector>
struct StackFrameInfo
{
    std::string functionName;
    size_t ip;
    int localCount;
};
struct StackTrace
{
    std::vector<StackFrameInfo> frames;
    std::string errorMessage;
    size_t crashIp = 0;
    int crashSp = -1;
    bool empty() const { return frames.empty() && errorMessage.empty(); }
    std::string format() const
    {
        std::string s = "=== CRASH ===\nError: " + errorMessage + "\nIP: " + std::to_string(crashIp) + " SP: " + std::to_string(crashSp) + "\n";
        for (int i = (int)frames.size() - 1; i >= 0; i--)
            s += "  #" + std::to_string(i) + " " + frames[i].functionName + " @ip=" + std::to_string(frames[i].ip) + "\n";
        return s;
    }
};
class StackTraceBuilder
{
    struct FuncSym
    {
        std::string name;
        size_t start;
        size_t end;
    };
    std::vector<FuncSym> syms;
public:
    void registerFunction(const std::string &name, size_t start, size_t end) { syms.push_back({name, start, end}); }
    std::string resolve(size_t ip) const
    {
        for (const auto &s : syms)
            if (ip >= s.start && ip < s.end)
                return s.name;
        return "<unknown@" + std::to_string(ip) + ">";
    }
    template <typename Ctx>
    StackTrace capture(const Ctx &ctx, const std::string &err) const
    {
        StackTrace t;
        t.errorMessage = err;
        t.crashIp = ctx.ip;
        t.crashSp = ctx.sp;
        t.frames.push_back({"__main__", 0, 0});
        for (int i = 0; i <= ctx.fp; i++)
        {
            StackFrameInfo fi;
            fi.ip = ctx.frames[i].returnAddr;
            fi.localCount = ctx.frames[i].localCount;
            fi.functionName = resolve(fi.ip > 0 ? fi.ip - 1 : 0);
            t.frames.push_back(fi);
        }
        return t;
    }
};
#endif
```

### src\VM\VM.cpp
```
#include "VM.h"
#include "../Debug/Debugger.h"
#include "../Debug/Profiler.h"
#include "../Core/Logger.h"
#include <cstring>
#include <cmath>
ModuleRegistry g_moduleRegistry;
extern StringArena g_runtimeArena;
VMSnapshot VMContext::saveSnapshot(std::shared_ptr<StringArena> arena) const
{
    VMSnapshot snap;
    snap.sp = sp;
    snap.stack.assign(stack, stack + (sp >= 0 ? sp + 1 : 0));
    snap.vars.assign(vars, vars + VAR_COUNT);
    snap.fp = fp;
    for (int i = 0; i <= fp; i++)
    {
        VMSnapshot::FrameSnap fs;
        fs.retAddr = frames[i].returnAddr;
        fs.stackBase = frames[i].stackBase;
        fs.localCnt = frames[i].localCount;
        fs.locals.assign(frames[i].locals, frames[i].locals + 32);
        snap.frames.push_back(fs);
    }
    snap.ip = ip;
    snap.status = status;
    snap.waitUntil = waitUntil;
    for (const auto &a : arrays)
    {
        VMSnapshot::ArrSnap as;
        as.elements = a->elements;
        snap.arrays.push_back(as);
    }
    if (arena)
        snap.strings = arena->getAll();
    return snap;
}
void VMContext::loadSnapshot(const VMSnapshot &snap, std::shared_ptr<StringArena> arena)
{
    reset();
    sp = snap.sp;
    for (int i = 0; i < (int)snap.stack.size() && i < STACK_SIZE; i++)
        stack[i] = snap.stack[i];
    for (int i = 0; i < VAR_COUNT && i < (int)snap.vars.size(); i++)
        vars[i] = snap.vars[i];
    fp = snap.fp;
    for (int i = 0; i < (int)snap.frames.size() && i < MAX_CALL_DEPTH; i++)
    {
        frames[i].returnAddr = snap.frames[i].retAddr;
        frames[i].stackBase = snap.frames[i].stackBase;
        frames[i].localCount = snap.frames[i].localCnt;
        for (int j = 0; j < 32 && j < (int)snap.frames[i].locals.size(); j++)
            frames[i].locals[j] = snap.frames[i].locals[j];
    }
    ip = snap.ip;
    status = snap.status;
    waitUntil = snap.waitUntil;
    arrays.clear();
    for (size_t i = 0; i < snap.arrays.size(); i++)
    {
        arrays.push_back(std::unique_ptr<VMArray>(new VMArray()));
        arrays.back()->elements = snap.arrays[i].elements;
    }
    if (arena)
        arena->loadFrom(snap.strings);
}
VerifyResult BytecodeVerifier::verify(const uint8_t *code, size_t len, size_t constCount)
{
    VerifyResult r;
    size_t ip = 0;
    while (ip < len)
    {
        size_t start = ip;
        uint8_t op = code[ip++];
        switch (op)
        {
        case OP_NOP:
        case OP_ADD:
        case OP_SUB:
        case OP_MUL:
        case OP_DIV:
        case OP_MOD:
        case OP_CMP_EQ:
        case OP_CMP_NE:
        case OP_CMP_LT:
        case OP_CMP_GT:
        case OP_CMP_LTE:
        case OP_CMP_GTE:
        case OP_AND:
        case OP_OR:
        case OP_NOT:
        case OP_POP:
        case OP_DUP:
        case OP_YIELD:
        case OP_WAIT_DYN:
        case OP_HALT:
        case OP_RETURN:
        case OP_RETURN_NONE:
        case OP_INDEX_GET:
        case OP_INDEX_SET:
        case OP_LENGTH:
        case OP_ARRAY_PUSH:
        case OP_STR_CONCAT:
        case OP_CAST_INT:
        case OP_CAST_FLOAT:
        case OP_CAST_STR:
            break;
        case OP_PUSH_CONST:
            if (ip + 1 >= len)
            {
                r.ok = false;
                r.error = "PUSH truncated";
                r.errorPos = start;
                return r;
            }
            {
                uint16_t id = code[ip] | (code[ip + 1] << 8);
                if (id >= constCount)
                {
                    r.ok = false;
                    r.error = "Const OOB #" + std::to_string(id);
                    r.errorPos = start;
                    return r;
                }
            }
            ip += 2;
            break;
        case OP_STORE:
        case OP_LOAD:
        case OP_STORE_LOCAL:
        case OP_LOAD_LOCAL:
            if (ip >= len)
            {
                r.ok = false;
                r.error = "Var truncated";
                r.errorPos = start;
                return r;
            }
            ip++;
            break;
        case OP_MAKE_ARRAY:
            if (ip >= len)
            {
                r.ok = false;
                r.error = "MKARR truncated";
                r.errorPos = start;
                return r;
            }
            ip++;
            break;
        case OP_CALL:
        case OP_CALL_VOID:
            if (ip + 2 >= len)
            {
                r.ok = false;
                r.error = "CALL truncated";
                r.errorPos = start;
                return r;
            }
            {
                uint8_t m = code[ip], f = code[ip + 1], a = code[ip + 2];
                if (m >= g_moduleRegistry.count())
                {
                    r.ok = false;
                    r.error = "Mod OOB";
                    r.errorPos = start;
                    return r;
                }
                if (f >= g_moduleRegistry.getModule(m).methodCount)
                {
                    r.ok = false;
                    r.error = "Func OOB";
                    r.errorPos = start;
                    return r;
                }
                if (a > 8)
                {
                    r.ok = false;
                    r.error = "Args>8";
                    r.errorPos = start;
                    return r;
                }
            }
            ip += 3;
            break;
        case OP_FUNC_CALL:
            if (ip + 2 >= len)
            {
                r.ok = false;
                r.error = "FCALL truncated";
                r.errorPos = start;
                return r;
            }
            {
                uint16_t t = code[ip] | (code[ip + 1] << 8);
                if (t >= len && t != 0xFFFF)
                {
                    r.ok = false;
                    r.error = "FCALL OOB";
                    r.errorPos = start;
                    return r;
                }
            }
            ip += 3;
            break;
        case OP_JMP:
        case OP_JZ:
        case OP_JNZ:
        case OP_WAIT:
            if (ip + 1 >= len)
            {
                r.ok = false;
                r.error = "Jump truncated";
                r.errorPos = start;
                return r;
            }
            if (op != OP_WAIT)
            {
                uint16_t t = code[ip] | (code[ip + 1] << 8);
                if (t >= len)
                {
                    r.ok = false;
                    r.error = "Jump OOB " + std::to_string(t);
                    r.errorPos = start;
                    return r;
                }
            }
            ip += 2;
            break;
        default:
            r.ok = false;
            r.error = "Unknown op 0x" + std::to_string(op);
            r.errorPos = start;
            return r;
        }
    }
    return r;
}
void VirtualMachine::registerFuncSymbols(const std::vector<FuncEntry> &funcs, const std::vector<TaskEntry> &tasks)
{
    for (const auto &f : funcs)
    {
        size_t end = codeLen;
        for (const auto &f2 : funcs)
            if (f2.entryPoint > f.entryPoint && f2.entryPoint < end)
                end = f2.entryPoint;
        traceBuilder.registerFunction(f.name, f.entryPoint, end);
        if (profiler_)
            profiler_->registerFunction(f.entryPoint, f.name.c_str());
    }
    for (const auto &t : tasks)
    {
        size_t end = codeLen;
        for (const auto &t2 : tasks)
            if (t2.entryPoint > t.entryPoint && t2.entryPoint < end)
                end = t2.entryPoint;
        traceBuilder.registerFunction("task:" + t.name, t.entryPoint, end);
    }
}
uint16_t VirtualMachine::readU16(VMContext &ctx)
{
    if (ctx.ip + 1 >= codeLen)
    {
        ctx.status = VMStatus::ERR_OUT_OF_BOUNDS;
        return 0;
    }
    uint8_t lo = code[ctx.ip++], hi = code[ctx.ip++];
    return lo | (hi << 8);
}
VMValue VirtualMachine::doArith(VMContext &ctx, VMValue a, VMValue b, char op)
{
    if (!a.isNumber() || !b.isNumber())
    {
        ctx.status = VMStatus::ERR_TYPE_MISMATCH;
        return VMValue::None();
    }
    if (a.type == ValueType::INT && b.type == ValueType::INT)
    {
        switch (op)
        {
        case '+':
            return VMValue::Int(a.data.i + b.data.i);
        case '-':
            return VMValue::Int(a.data.i - b.data.i);
        case '*':
            return VMValue::Int(a.data.i * b.data.i);
        case '/':
            if (b.data.i == 0)
            {
                ctx.status = VMStatus::ERR_DIV_BY_ZERO;
                return VMValue::None();
            }
            return VMValue::Int(a.data.i / b.data.i);
        case '%':
            if (b.data.i == 0)
            {
                ctx.status = VMStatus::ERR_DIV_BY_ZERO;
                return VMValue::None();
            }
            return VMValue::Int(a.data.i % b.data.i);
        }
    }
    float fa = a.toFloat(), fb = b.toFloat();
    switch (op)
    {
    case '+':
        return VMValue::Float(fa + fb);
    case '-':
        return VMValue::Float(fa - fb);
    case '*':
        return VMValue::Float(fa * fb);
    case '/':
        if (fb == 0)
        {
            ctx.status = VMStatus::ERR_DIV_BY_ZERO;
            return VMValue::None();
        }
        return VMValue::Float(fa / fb);
    case '%':
        if (fb == 0)
        {
            ctx.status = VMStatus::ERR_DIV_BY_ZERO;
            return VMValue::None();
        }
        return VMValue::Float(std::fmod(fa, fb));
    }
    return VMValue::None();
}
VMValue VirtualMachine::doCompare(VMContext &ctx, VMValue a, VMValue b, uint8_t op)
{
    if (op == OP_CMP_EQ || op == OP_CMP_NE)
    {
        bool eq = false;
        if (a.type == b.type)
        {
            switch (a.type)
            {
            case ValueType::INT:
                eq = (a.data.i == b.data.i);
                break;
            case ValueType::FLOAT:
                eq = floatEqual(a.data.f, b.data.f);
                break;
            case ValueType::BOOL:
                eq = (a.data.b == b.data.b);
                break;
            case ValueType::STRING:
                eq = (a.data.s && b.data.s) ? strcmp(a.data.s, b.data.s) == 0 : (a.data.s == b.data.s);
                break;
            case ValueType::NONE:
                eq = true;
                break;
            default:
                break;
            }
        }
        else if (a.isNumber() && b.isNumber())
            eq = floatEqual(a.toFloat(), b.toFloat());
        return VMValue::Bool(op == OP_CMP_EQ ? eq : !eq);
    }
    if (!a.isNumber() || !b.isNumber())
    {
        ctx.status = VMStatus::ERR_TYPE_MISMATCH;
        return VMValue::None();
    }
    float fa = a.toFloat(), fb = b.toFloat();
    switch (op)
    {
    case OP_CMP_LT:
        return VMValue::Bool(fa < fb);
    case OP_CMP_GT:
        return VMValue::Bool(fa > fb);
    case OP_CMP_LTE:
        return VMValue::Bool(fa <= fb || floatEqual(fa, fb));
    case OP_CMP_GTE:
        return VMValue::Bool(fa >= fb || floatEqual(fa, fb));
    }
    return VMValue::Bool(false);
}
VMStatus VirtualMachine::executeSlice(VMContext &ctx, uint32_t currentTime, uint32_t budget)
{
    ctx.status = VMStatus::OK;
    if (ctx.waitUntil > 0 && !timeReached(currentTime, ctx.waitUntil))
    {
        ctx.status = VMStatus::WAIT;
        return ctx.status;
    }
    ctx.waitUntil = 0;
    ctx.usage.instructionsThisTick = 0;
    while (ctx.ip < codeLen && ctx.status == VMStatus::OK)
    {
        if (ctx.usage.instructionsThisTick >= budget)
            return VMStatus::SLICE_END;
        if (debugger_ && debugger_->enabled())
        {
            if (debugger_->shouldBreak((uint16_t)ctx.ip, (int8_t)ctx.fp))
            {
                ctx.status = VMStatus::BREAKPOINT;
                return ctx.status;
            }
        }
        if (!ctx.checkBudget())
            break;
        uint16_t ipBefore = (uint16_t)ctx.ip;
        uint8_t op = code[ctx.ip++];
        if (debugger_)
            debugger_->logExec(ipBefore, op, (int8_t)ctx.sp, (int8_t)ctx.fp);
        if (profiler_ && profiler_->active())
            profiler_->onOpcode(op);
        switch (op)
        {
        case OP_NOP:
            break;
        case OP_PUSH_CONST:
        {
            uint16_t id = readU16(ctx);
            if (ctx.status != VMStatus::OK)
                break;
            if (id >= constCount)
            {
                ctx.status = VMStatus::ERR_CONST_OUT_OF_BOUNDS;
                break;
            }
            ctx.push(constants[id]);
            break;
        }
        case OP_STORE:
        {
            uint8_t id = code[ctx.ip++];
            ctx.vars[id] = ctx.pop();
            break;
        }
        case OP_LOAD:
        {
            uint8_t id = code[ctx.ip++];
            ctx.push(ctx.vars[id]);
            break;
        }
        case OP_STORE_LOCAL:
        {
            uint8_t id = code[ctx.ip++];
            if (!ctx.inFrame())
            {
                ctx.status = VMStatus::ERR_CALL_STACK_UNDERFLOW;
                break;
            }
            ctx.currentFrame().locals[id] = ctx.pop();
            break;
        }
        case OP_LOAD_LOCAL:
        {
            uint8_t id = code[ctx.ip++];
            if (!ctx.inFrame())
            {
                ctx.status = VMStatus::ERR_CALL_STACK_UNDERFLOW;
                break;
            }
            ctx.push(ctx.currentFrame().locals[id]);
            break;
        }
        case OP_ADD:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(doArith(ctx, a, b, '+'));
            break;
        }
        case OP_SUB:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(doArith(ctx, a, b, '-'));
            break;
        }
        case OP_MUL:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(doArith(ctx, a, b, '*'));
            break;
        }
        case OP_DIV:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(doArith(ctx, a, b, '/'));
            break;
        }
        case OP_MOD:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(doArith(ctx, a, b, '%'));
            break;
        }
        case OP_CMP_EQ:
        case OP_CMP_NE:
        case OP_CMP_LT:
        case OP_CMP_GT:
        case OP_CMP_LTE:
        case OP_CMP_GTE:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(doCompare(ctx, a, b, op));
            break;
        }
        case OP_AND:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(VMValue::Bool(a.isTruthy() && b.isTruthy()));
            break;
        }
        case OP_OR:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(VMValue::Bool(a.isTruthy() || b.isTruthy()));
            break;
        }
        case OP_NOT:
        {
            VMValue a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(VMValue::Bool(!a.isTruthy()));
            break;
        }
        case OP_JMP:
        {
            uint16_t t = readU16(ctx);
            if (ctx.status == VMStatus::OK)
            {
                if (t >= codeLen)
                {
                    ctx.status = VMStatus::ERR_INVALID_JUMP;
                    break;
                }
                ctx.ip = t;
            }
            break;
        }
        case OP_JZ:
        {
            uint16_t t = readU16(ctx);
            if (ctx.status != VMStatus::OK)
                break;
            VMValue c = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (!c.isTruthy())
            {
                if (t >= codeLen)
                {
                    ctx.status = VMStatus::ERR_INVALID_JUMP;
                    break;
                }
                ctx.ip = t;
            }
            break;
        }
        case OP_JNZ:
        {
            uint16_t t = readU16(ctx);
            if (ctx.status != VMStatus::OK)
                break;
            VMValue c = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (c.isTruthy())
            {
                if (t >= codeLen)
                {
                    ctx.status = VMStatus::ERR_INVALID_JUMP;
                    break;
                }
                ctx.ip = t;
            }
            break;
        }
        case OP_POP:
            ctx.pop();
            break;
        case OP_DUP:
        {
            VMValue v = ctx.peekStack();
            ctx.push(v);
            break;
        }
        case OP_MAKE_ARRAY:
        {
            uint8_t cnt = code[ctx.ip++];
            VMArray *arr = ctx.allocArray();
            if (!arr)
                break;
            VMValue tmp[64];
            for (int i = cnt - 1; i >= 0; i--)
            {
                tmp[i] = ctx.pop();
                if (ctx.status != VMStatus::OK)
                    break;
            }
            if (ctx.status != VMStatus::OK)
                break;
            for (uint8_t i = 0; i < cnt; i++)
                arr->push(tmp[i]);
            ctx.push(VMValue::Arr(arr));
            break;
        }
        case OP_INDEX_GET:
        {
            VMValue idx = ctx.pop();
            VMValue arr = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (arr.type != ValueType::ARRAY || !arr.data.arr)
            {
                ctx.status = VMStatus::ERR_NOT_ARRAY;
                break;
            }
            int32_t i = idx.toInt();
            if (i < 0 || i >= arr.data.arr->length())
            {
                ctx.status = VMStatus::ERR_INDEX_OUT_OF_BOUNDS;
                break;
            }
            ctx.push(arr.data.arr->get(i));
            break;
        }
        case OP_INDEX_SET:
        {
            VMValue val = ctx.pop();
            VMValue idx = ctx.pop();
            VMValue arr = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (arr.type != ValueType::ARRAY || !arr.data.arr)
            {
                ctx.status = VMStatus::ERR_NOT_ARRAY;
                break;
            }
            if (!arr.data.arr->set(idx.toInt(), val))
            {
                ctx.status = VMStatus::ERR_INDEX_OUT_OF_BOUNDS;
                break;
            }
            break;
        }
        case OP_LENGTH:
        {
            VMValue arr = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (arr.type != ValueType::ARRAY || !arr.data.arr)
            {
                ctx.status = VMStatus::ERR_NOT_ARRAY;
                break;
            }
            ctx.push(VMValue::Int(arr.data.arr->length()));
            break;
        }
        case OP_ARRAY_PUSH:
        {
            VMValue val = ctx.pop();
            VMValue arr = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (arr.type != ValueType::ARRAY || !arr.data.arr)
            {
                ctx.status = VMStatus::ERR_NOT_ARRAY;
                break;
            }
            arr.data.arr->push(val);
            break;
        }
        case OP_STR_CONCAT:
        {
            VMValue b = ctx.pop(), a = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            ctx.push(VMValue::Str(g_runtimeArena.intern(a.toString() + b.toString())));
            break;
        }
        case OP_CAST_INT:
        {
            VMValue a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(VMValue::Int(a.toInt()));
            break;
        }
        case OP_CAST_FLOAT:
        {
            VMValue a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(VMValue::Float(a.toFloat()));
            break;
        }
        case OP_CAST_STR:
        {
            VMValue a = ctx.pop();
            if (ctx.status == VMStatus::OK)
                ctx.push(VMValue::Str(g_runtimeArena.intern(a.toString())));
            break;
        }
        case OP_FUNC_CALL:
        {
            uint16_t target = readU16(ctx);
            if (ctx.status != VMStatus::OK)
                break;
            uint8_t ac = code[ctx.ip++];
            if (target >= codeLen)
            {
                ctx.status = VMStatus::ERR_INVALID_JUMP;
                break;
            }
            if (!ctx.pushFrame(ctx.ip, ac))
                break;
            if (profiler_ && profiler_->active())
                profiler_->onFuncEnter(target, ctx.usage.instructionsTotal);
            VMValue args[32];
            for (int i = ac - 1; i >= 0; i--)
            {
                args[i] = ctx.pop();
                if (ctx.status != VMStatus::OK)
                    break;
            }
            if (ctx.status != VMStatus::OK)
                break;
            for (int i = 0; i < ac; i++)
                ctx.currentFrame().locals[i] = args[i];
            ctx.currentFrame().localCount = ac;
            ctx.ip = target;
            break;
        }
        case OP_RETURN:
        {
            VMValue rv = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            if (!ctx.inFrame())
            {
                ctx.status = VMStatus::ERR_CALL_STACK_UNDERFLOW;
                break;
            }
            size_t ra = ctx.currentFrame().returnAddr;
            ctx.popFrame();
            if (profiler_ && profiler_->active())
                profiler_->onFuncExit(ctx.usage.instructionsTotal);
            ctx.ip = ra;
            ctx.push(rv);
            break;
        }
        case OP_RETURN_NONE:
        {
            if (!ctx.inFrame())
            {
                ctx.status = VMStatus::ERR_CALL_STACK_UNDERFLOW;
                break;
            }
            size_t ra = ctx.currentFrame().returnAddr;
            ctx.popFrame();
            if (profiler_ && profiler_->active())
                profiler_->onFuncExit(ctx.usage.instructionsTotal);
            ctx.ip = ra;
            ctx.push(VMValue::None());
            break;
        }
        case OP_CALL:
        case OP_CALL_VOID:
        {
            uint8_t modId = code[ctx.ip++], funcId = code[ctx.ip++], ac = code[ctx.ip++];
            if (ac > 8)
            {
                ctx.status = VMStatus::ERR_TOO_MANY_ARGS;
                break;
            }
            if (modId >= g_moduleRegistry.count())
            {
                ctx.status = VMStatus::ERR_INVALID_MODULE;
                break;
            }
            const auto &mod = g_moduleRegistry.getModule(modId);
            if (funcId >= mod.methodCount)
            {
                ctx.status = VMStatus::ERR_INVALID_FUNC;
                break;
            }
            VMValue args[8];
            for (int i = ac - 1; i >= 0; i--)
            {
                args[i] = ctx.pop();
                if (ctx.status != VMStatus::OK)
                    break;
            }
            if (ctx.status != VMStatus::OK)
                break;
            VMValue res = mod.methods[funcId].func(ac, args);
            if (op == OP_CALL)
                ctx.push(res);
            break;
        }
        case OP_WAIT:
        {
            uint16_t ms = readU16(ctx);
            if (ctx.status != VMStatus::OK)
                break;
            ctx.waitUntil = currentTime + ms;
            return VMStatus::WAIT;
        }
        case OP_WAIT_DYN:
        {
            VMValue ms = ctx.pop();
            if (ctx.status != VMStatus::OK)
                break;
            ctx.waitUntil = currentTime + (uint32_t)ms.toInt();
            return VMStatus::WAIT;
        }
        case OP_YIELD:
            return VMStatus::YIELD;
        case OP_HALT:
            return VMStatus::HALT;
        default:
            ctx.status = VMStatus::ERR_INVALID_OPCODE;
            break;
        }
        if (debugger_ && debugger_->enabled())
            debugger_->checkWatches(ctx);
    }
    if (isError(ctx.status))
    {
        ctx.lastTrace = traceBuilder.capture<VMContext>(ctx, statusToString(ctx.status));
        LOG_ERROR("VM", "Crash ip=" + std::to_string(ctx.ip) + ": " + statusToString(ctx.status));
    }
    if (ctx.status == VMStatus::OK)
        return VMStatus::HALT;
    return ctx.status;
}
bool ModuleLinker::link(ProgramBinary &main, const std::map<std::string, ProgramBinary> &modules, std::string &error)
{
    for (auto &imp : main.imports)
    {
        auto it = modules.find(imp.moduleName);
        if (it == modules.end())
        {
            error = "Module '" + imp.moduleName + "' not found";
            return false;
        }
        const auto *sym = it->second.findExport(imp.symbolName);
        if (!sym)
        {
            error = "Symbol '" + imp.symbolName + "' not exported from '" + imp.moduleName + "'";
            return false;
        }
        uint16_t addr = sym->address;
        if (imp.patchAddress + 1 < main.bytecode.size())
        {
            main.bytecode[imp.patchAddress] = addr & 0xFF;
            main.bytecode[imp.patchAddress + 1] = (addr >> 8) & 0xFF;
        }
    }
    return true;
}
```

### src\VM\VM.h
```
#ifndef ESPDSL_VM_H
#define ESPDSL_VM_H
#include "../Core/Core.h"
#include "StackTrace.h"
#include <vector>
#include <string>
#include <memory>
#if __cplusplus < 201402L
namespace std {
    template<typename T, typename... Args>
    std::unique_ptr<T> make_unique(Args&&... args) {
        return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
    }
}
#endif
class Debugger;
class Profiler;
typedef VMValue (*ModuleFunction)(int argCount, VMValue *args);
struct ModuleFuncEntry
{
    const char *name;
    ModuleFunction func;
};
struct ModuleEntry
{
    const char *name;
    uint16_t abiVersion;
    ModuleFuncEntry *methods;
    uint8_t methodCount;
    int findMethod(const std::string &n) const
    {
        for (int i = 0; i < methodCount; i++)
            if (std::string(methods[i].name) == n)
                return i;
        return -1;
    }
};
class ModuleRegistry
{
    std::vector<ModuleEntry> modules;
public:
    void registerModule(ModuleEntry m) { modules.push_back(m); }
    size_t count() const { return modules.size(); }
    int findModule(const std::string &name) const
    {
        for (size_t i = 0; i < modules.size(); i++)
            if (std::string(modules[i].name) == name)
                return (int)i;
        return -1;
    }
    int findFunc(int m, const std::string &f) const
    {
        if (m < 0 || m >= (int)modules.size())
            return -1;
        return modules[m].findMethod(f);
    }
    const ModuleEntry &getModule(int id) const { return modules[id]; }
    bool unregisterModule(const std::string &name)
    {
        for (auto it = modules.begin(); it != modules.end(); ++it)
            if (std::string(it->name) == name)
            {
                modules.erase(it);
                return true;
            }
        return false;
    }
    bool hasModule(const std::string &name) const { return findModule(name) >= 0; }
    void clear() { modules.clear(); }
};
extern ModuleRegistry g_moduleRegistry;
struct VMContext
{
    static const int STACK_SIZE = 64;
    static const int VAR_COUNT = 128;
    static const int MAX_CALL_DEPTH = 32;
    VMValue stack[STACK_SIZE];
    int sp = -1;
    VMValue vars[VAR_COUNT];
    CallFrame frames[MAX_CALL_DEPTH];
    int fp = -1;
    size_t ip = 0;
    VMStatus status = VMStatus::OK;
    uint32_t waitUntil = 0;
    ResourceQuota quota;
    ResourceUsage usage;
    std::vector<std::unique_ptr<VMArray>> arrays;
    StackTrace lastTrace;
    VMContext() { reset(); }
    VMContext(const ResourceQuota &q) : quota(q) { reset(); }
    void reset()
    {
        sp = -1;
        fp = -1;
        ip = 0;
        status = VMStatus::OK;
        waitUntil = 0;
        usage = ResourceUsage{};
        for (int i = 0; i < VAR_COUNT; i++)
            vars[i] = VMValue::None();
        arrays.clear();
        lastTrace = StackTrace{};
    }
    bool push(VMValue v)
    {
        if (sp >= (int)quota.maxStackDepth - 1)
        {
            status = VMStatus::ERR_STACK_OVERFLOW;
            return false;
        }
        stack[++sp] = v;
        if ((uint32_t)(sp + 1) > usage.peakStackDepth)
            usage.peakStackDepth = sp + 1;
        return true;
    }
    VMValue pop()
    {
        if (sp < 0)
        {
            status = VMStatus::ERR_STACK_UNDERFLOW;
            return VMValue::None();
        }
        return stack[sp--];
    }
    VMValue peekStack() const { return sp < 0 ? VMValue::None() : stack[sp]; }
    bool pushFrame(size_t retAddr, int argCount)
    {
        if (fp >= (int)quota.maxCallDepth - 1)
        {
            status = VMStatus::ERR_CALL_STACK_OVERFLOW;
            return false;
        }
        fp++;
        if ((uint32_t)(fp + 1) > usage.peakCallDepth)
            usage.peakCallDepth = fp + 1;
        frames[fp].returnAddr = retAddr;
        frames[fp].stackBase = sp - argCount;
        frames[fp].localCount = 0;
        for (int i = 0; i < 32; i++)
            frames[fp].locals[i] = VMValue::None();
        return true;
    }
    bool popFrame()
    {
        if (fp < 0)
        {
            status = VMStatus::ERR_CALL_STACK_UNDERFLOW;
            return false;
        }
        fp--;
        return true;
    }
    bool inFrame() const { return fp >= 0; }
    CallFrame &currentFrame() { return frames[fp]; }
    VMArray *allocArray()
    {
        if (usage.arrayCount >= quota.maxArrayCount)
        {
            status = VMStatus::ERR_MEMORY_LIMIT;
            return nullptr;
        }
        arrays.push_back(std::make_unique<VMArray>());
        usage.arrayCount++;
        return arrays.back().get();
    }
    bool checkBudget()
    {
        usage.instructionsThisTick++;
        usage.instructionsTotal++;
        if (usage.instructionsThisTick > quota.maxInstructionsPerTick)
        {
            status = VMStatus::ERR_QUOTA_EXCEEDED;
            return false;
        }
        return true;
    }
    VMSnapshot saveSnapshot(std::shared_ptr<StringArena> arena) const;
    void loadSnapshot(const VMSnapshot &snap, std::shared_ptr<StringArena> arena);
};
struct VerifyResult
{
    bool ok = true;
    std::string error;
    size_t errorPos = 0;
};
class BytecodeVerifier
{
public:
    static VerifyResult verify(const uint8_t *code, size_t len, size_t constCount);
};
class VirtualMachine
{
    const uint8_t *code;
    const VMValue *constants;
    size_t codeLen;
    size_t constCount;
    StackTraceBuilder traceBuilder;
    Debugger *debugger_ = nullptr;
    Profiler *profiler_ = nullptr;
    uint16_t readU16(VMContext &ctx);
    VMValue doArith(VMContext &ctx, VMValue a, VMValue b, char op);
    VMValue doCompare(VMContext &ctx, VMValue a, VMValue b, uint8_t op);
public:
    VirtualMachine(const uint8_t *bc, size_t size, const VMValue *consts, size_t numConsts) : code(bc), codeLen(size), constants(consts), constCount(numConsts) {}
    size_t getCodeSize() const { return codeLen; }
    void attachDebugger(Debugger *d) { debugger_ = d; }
    void attachProfiler(Profiler *p) { profiler_ = p; }
    void registerFuncSymbols(const std::vector<FuncEntry> &funcs, const std::vector<TaskEntry> &tasks);
    VerifyResult verify() { return BytecodeVerifier::verify(code, codeLen, constCount); }
    VMStatus executeSlice(VMContext &ctx, uint32_t currentTime, uint32_t budget);
    VMStatus execute(VMContext &ctx, uint32_t currentTime = 0) { return executeSlice(ctx, currentTime, ctx.quota.maxInstructionsPerTick); }
};
class ModuleLinker
{
public:
    static bool link(ProgramBinary &main, const std::map<std::string, ProgramBinary> &modules, std::string &error);
};
#endif
```

### data\js\components\about.js
```
COMPONENT_RENDERERS.about = function(container) {
    container.innerHTML = `
        <div class="panel" style="text-align:center;padding-top:40px">
            <div style="font-size:48px;margin-bottom:16px">⚡</div>
            <h2 style="color:var(--text-accent);margin-bottom:8px">EspDSL Web OS</h2>
            <p style="color:var(--text-secondary);margin-bottom:24px">
                Embedded Scriptable DSL Runtime<br>
                for ESP32 / ESP8266
            </p>
            <div style="font-size:12px;color:var(--text-muted);line-height:1.8">
                <p>35 Opcodes • 75+ Native Functions • 13 Modules</p>
                <p>VM • Compiler • Scheduler • MessageBus • EventBus</p>
                <p>RuleEngine • Debugger • Profiler</p>
                <p style="margin-top:16px">Connected via UDCP Protocol</p>
            </div>
        </div>
    `;
};
```

### data\js\components\dashboard.js
```
COMPONENT_RENDERERS.dashboard = function(container) {
    container.innerHTML = '<div class="dashboard-grid" id="dash-grid"></div>';
    const grid = container.querySelector('#dash-grid');
    async function refresh() {
        try {
            const [mem, cpu] = await Promise.all([EspDSL.memory(), EspDSL.cpu()]);
            const m = mem.data || {};
            const c = cpu.data || {};
            const heapPct = m.totalHeap > 0 ? ((m.totalHeap - m.freeHeap) / m.totalHeap * 100) : 0;
            const heapColor = heapPct > 80 ? 'red' : heapPct > 60 ? 'yellow' : 'green';
            grid.innerHTML = `
                <div class="dash-card">
                    <div class="dash-card-title">CPU</div>
                    <div class="dash-value">${Format.us(c.lastTickUs || 0)}</div>
                    <div class="dash-sub">per tick</div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">Heap</div>
                    <div class="dash-value">${Format.bytes(m.freeHeap || 0)}</div>
                    <div class="dash-sub">free of ${Format.bytes(m.totalHeap || 0)}</div>
                    <div class="progress-bar"><div class="progress-fill ${heapColor}" style="width:${heapPct}%"></div></div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">Uptime</div>
                    <div class="dash-value">${Format.time(c.uptimeMs || 0)}</div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">Tasks</div>
                    <div class="dash-value">${c.taskCount || 0}</div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">Instructions</div>
                    <div class="dash-value small">${Format.number(c.totalInstructions || 0)}</div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">Bytecode</div>
                    <div class="dash-value small">${Format.bytes(m.bytecodeSize || 0)}</div>
                    <div class="dash-sub">${m.constants || 0} consts, ${m.arrays || 0} arrays</div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">RAM Usage</div>
                    <div class="dash-value small">${Format.bytes(m.estimatedRam || 0)}</div>
                    <div class="dash-sub">estimated script RAM</div>
                </div>
                <div class="dash-card">
                    <div class="dash-card-title">CPU %</div>
                    <div class="dash-value">${Format.percent(c.cpuPercent || 0)}</div>
                </div>
            `;
        } catch (e) { grid.innerHTML = '<div class="dash-card">Connection error</div>'; }
    }
    refresh();
    const timer = setInterval(refresh, 2000);
    container._cleanup = () => clearInterval(timer);
};
```

### data\js\components\ide.js
```
COMPONENT_RENDERERS.ide = function(container) {
    container.innerHTML = `
        <div class="editor-container">
            <div class="toolbar">
                <button class="btn primary" id="ide-run">▶ Run</button>
                <button class="btn" id="ide-compile">⚙ Compile</button>
                <button class="btn" id="ide-stop">⏹ Stop</button>
                <button class="btn" id="ide-reset">↺ Reset</button>
                <div style="flex:1"></div>
                <button class="btn" id="ide-save">💾 Save</button>
                <button class="btn" id="ide-load">📂 Open</button>
                <button class="btn" id="ide-disasm">📋 Disasm</button>
            </div>
            <div class="editor-area">
                <textarea class="code-editor" id="ide-code" spellcheck="false">PROGRAM Demo
    FUNC fib(n)
        IF n <= 1 THEN RETURN n ENDIF
        RETURN fib(n - 1) + fib(n - 2)
    ENDFUNC
    FOR i = 0 TO 7
        PRINT fib(i)
    ENDFOR
ENDPROGRAM</textarea>
            </div>
            <div class="editor-status">
                <span id="ide-status">Ready</span>
                <span id="ide-cursor">Ln 1, Col 1</span>
            </div>
            <div class="editor-output" id="ide-output"></div>
        </div>
    `;
    const code = container.querySelector('#ide-code');
    const output = container.querySelector('#ide-output');
    const status = container.querySelector('#ide-status');
    const cursor = container.querySelector('#ide-cursor');
    function log(text, color = '') {
        const line = document.createElement('div');
        if (color) line.style.color = `var(--text-${color})`;
        line.textContent = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
    EspDSL.onOutput = (text) => log(text);
    code.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = code.selectionStart;
            code.value = code.value.substring(0, start) + '    ' + code.value.substring(code.selectionEnd);
            code.selectionStart = code.selectionEnd = start + 4;
        }
    });
    code.addEventListener('input', updateCursor);
    code.addEventListener('click', updateCursor);
    code.addEventListener('keyup', updateCursor);
    function updateCursor() {
        const val = code.value.substring(0, code.selectionStart);
        const lines = val.split('\n');
        cursor.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
    }
    container.querySelector('#ide-compile').onclick = async () => {
        status.textContent = 'Compiling...';
        output.innerHTML = '';
        try {
            const r = await EspDSL.compile(code.value);
            if (r.status === 'ok') {
                log(`✓ Compiled: ${r.data.bytecodeSize}B, ${r.data.functions} funcs, ${r.data.tasks} tasks`, 'success');
                status.textContent = 'Compiled';
            } else {
                log('✗ ' + r.error, 'error');
                status.textContent = 'Error';
            }
        } catch (e) { log('Connection error', 'error'); status.textContent = 'Error'; }
    };
    container.querySelector('#ide-run').onclick = async () => {
        status.textContent = 'Compiling...';
        output.innerHTML = '';
        try {
            const r = await EspDSL.compile(code.value);
            if (r.status !== 'ok') { log('Compile: ' + r.error, 'error'); status.textContent = 'Error'; return; }
            log(`Compiled ${r.data.bytecodeSize}B`, 'success');
            status.textContent = 'Running...';
            const run = await EspDSL.run();
            if (run.data && run.data.output) log(run.data.output);
            status.textContent = run.data && run.data.running ? 'Running' : 'Done';
        } catch (e) { log('Error: ' + e, 'error'); status.textContent = 'Error'; }
    };
    container.querySelector('#ide-stop').onclick = async () => {
        await EspDSL.stop();
        status.textContent = 'Stopped';
        log('Stopped', 'warning');
    };
    container.querySelector('#ide-reset').onclick = async () => {
        await EspDSL.reset();
        status.textContent = 'Reset';
        output.innerHTML = '';
        log('Engine reset', 'info');
    };
    container.querySelector('#ide-save').onclick = async () => {
        const name = prompt('Script name:', 'my_script');
        if (!name) return;
        await EspDSL.scriptSave(name, code.value);
        log('Saved: ' + name, 'success');
    };
    container.querySelector('#ide-load').onclick = async () => {
        const list = await EspDSL.scripts();
        if (!list.data || !list.data.scripts || list.data.scripts.length === 0) { log('No saved scripts', 'warning'); return; }
        const names = list.data.scripts.map(s => s.name);
        const name = prompt('Open script:\n' + names.join('\n'));
        if (!name) return;
        const r = await EspDSL.scriptLoad(name);
        if (r.status === 'ok') { code.value = r.data.code; log('Loaded: ' + name, 'success'); }
        else log('Not found: ' + name, 'error');
    };
    container.querySelector('#ide-disasm').onclick = async () => {
        const r = await EspDSL.disasm();
        if (r.data && r.data.output) { output.innerHTML = ''; log(r.data.output); }
    };
};
```

### data\js\components\desktop.js
```
const APPS = [
    { id: 'ide', title: 'Code Editor', icon: '📝', component: 'ide', w: 900, h: 600 },
    { id: 'terminal', title: 'Terminal', icon: '💻', component: 'terminal', w: 700, h: 450 },
    { id: 'taskman', title: 'Task Manager', icon: '📊', component: 'taskman', w: 750, h: 500 },
    { id: 'dashboard', title: 'Dashboard', icon: '📈', component: 'dashboard', w: 850, h: 550 },
    { id: 'modules', title: 'Modules', icon: '🧩', component: 'modules', w: 650, h: 450 },
    { id: 'debugger', title: 'Debugger', icon: '🔍', component: 'debugger', w: 750, h: 500 },
    { id: 'profiler', title: 'Profiler', icon: '⏱️', component: 'profiler', w: 700, h: 450 },
    { id: 'messages', title: 'Messages', icon: '✉️', component: 'messages', w: 650, h: 400 },
    { id: 'events', title: 'Events', icon: '⚡', component: 'events', w: 650, h: 400 },
    { id: 'rules', title: 'Rules', icon: '⚙️', component: 'rules', w: 700, h: 450 },
    { id: 'scripts', title: 'Scripts', icon: '📁', component: 'scripts', w: 500, h: 400 },
    { id: 'settings', title: 'Settings', icon: '🔧', component: 'settings', w: 450, h: 350 },
];
function renderDesktop(container) {
    container.innerHTML = '';
    container.className = 'desktop';
    const icons = document.createElement('div');
    icons.className = 'desktop-icons';
    APPS.forEach(app => {
        const icon = document.createElement('div');
        icon.className = 'desktop-icon';
        icon.innerHTML = `<span class="icon">${app.icon}</span><span class="label">${app.title}</span>`;
        icon.ondblclick = () => {
            AppState.openWindow(app.id, app.title, app.icon, app.component, {});
            const w = AppState.windows.find(w => w.id === app.id);
            if (w && !w.maximized) { w.width = app.w || 700; w.height = app.h || 500; }
        };
        icons.appendChild(icon);
    });
    container.appendChild(icons);
    AppState.windows.forEach(w => {
        if (w.minimized) return;
        const { el, content } = createWindow(w);
        if (w.id === AppState.activeWindowId) el.classList.add('focused');
        container.appendChild(el);
        const renderer = COMPONENT_RENDERERS[w.component];
        if (renderer) renderer(content, w);
        else content.innerHTML = '<div class="panel"><p>Component: ' + w.component + '</p></div>';
    });
}
```

### data\js\components\debugger.js
```
COMPONENT_RENDERERS.debugger = function(container) {
    container.innerHTML = `
        <div class="split-v" style="height:100%">
            <div class="toolbar">
                <button class="btn" onclick="dbgCmd('enable')">🔍 Enable</button>
                <button class="btn" onclick="dbgCmd('disable')">Off</button>
                <span style="width:1px;background:var(--border);margin:0 4px"></span>
                <button class="btn primary" onclick="dbgCmd('step')">Step</button>
                <button class="btn" onclick="dbgCmd('continue')">Continue</button>
                <div style="flex:1"></div>
                <input id="dbg-bp-addr" type="number" placeholder="Address" style="width:80px">
                <button class="btn small" onclick="dbgAddBp()">+BP</button>
                <button class="btn small danger" onclick="dbgCmd('clearBp')">Clear</button>
            </div>
            <div class="split-h" style="flex:1">
                <div class="split-left" style="overflow-y:auto;padding:8px">
                    <h4 style="color:var(--text-accent);margin-bottom:8px">Variables</h4>
                    <div id="dbg-vars">Select a task to inspect</div>
                </div>
                <div class="split-right" style="overflow-y:auto;padding:8px">
                    <h4 style="color:var(--text-accent);margin-bottom:8px">State</h4>
                    <div id="dbg-state">Enable debugger to see state</div>
                </div>
            </div>
        </div>
    `;
    window.dbgCmd = async (cmd) => {
        if (cmd === 'enable') await EspDSL.dbgEnable();
        else if (cmd === 'disable') await EspDSL.dbgDisable();
        else if (cmd === 'step') { const r = await EspDSL.dbgStep(); dbgShowStatus(r); }
        else if (cmd === 'continue') { const r = await EspDSL.dbgContinue(); dbgShowStatus(r); }
        else if (cmd === 'clearBp') await EspDSL.dbgClearBp();
    };
    window.dbgAddBp = async () => {
        const addr = parseInt(container.querySelector('#dbg-bp-addr').value);
        if (!isNaN(addr)) await EspDSL.dbgBreakpoint(addr);
    };
    async function dbgShowStatus(r) {
        const state = container.querySelector('#dbg-state');
        if (r && r.data) {
            state.innerHTML = `<pre style="font-size:12px">${JSON.stringify(r.data, null, 2)}</pre>`;
        }
        const vars = await EspDSL.vars(0);
        const vdiv = container.querySelector('#dbg-vars');
        if (vars.data && vars.data.variables) {
            let html = '<table><tr><th>Scope</th><th>ID</th><th>Type</th><th>Value</th></tr>';
            vars.data.variables.forEach(v => {
                html += `<tr><td>${v.local?'local':'global'}</td><td>#${v.id}</td><td>${v.type}</td><td style="font-family:var(--font-mono)">${v.value}</td></tr>`;
            });
            html += '</table>';
            vdiv.innerHTML = html;
        }
    }
};
```

### data\js\components\events.js
```
COMPONENT_RENDERERS.events = function(container) {
    container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column">
            <div class="toolbar">
                <button class="btn" onclick="evtRefresh()">↻ Log</button>
                <button class="btn" onclick="evtShowStats()">Stats</button>
                <button class="btn danger small" onclick="evtClear()">Clear</button>
                <div style="flex:1"></div>
                <input id="evt-id" type="number" placeholder="Event ID" style="width:80px">
                <input id="evt-val" type="number" placeholder="Value" style="width:60px">
                <button class="btn small primary" onclick="evtEmit()">Emit</button>
            </div>
            <div class="panel" id="evt-content" style="flex:1"><p>Click Log to view events</p></div>
        </div>
    `;
    window.evtRefresh = async () => {
        const r = await EspDSL.eventLog();
        const c = container.querySelector('#evt-content');
        if (!r.data || !r.data.events || r.data.events.length === 0) { c.innerHTML = '<p>No events</p>'; return; }
        let html = '<table><tr><th>ID</th><th>Source</th><th>Value</th><th>Time</th></tr>';
        r.data.events.forEach(e => { html += `<tr><td>${e.id}</td><td>${e.source}</td><td>${e.value}</td><td>${e.time}</td></tr>`; });
        c.innerHTML = html + '</table>';
    };
    window.evtShowStats = async () => {
        const r = await EspDSL.eventStats();
        const c = container.querySelector('#evt-content');
        if (r.data) c.innerHTML = `<div class="panel"><p>Pending: ${r.data.pending}</p><p>Log: ${r.data.logSize}</p><p>Subs: ${r.data.subscriptions}</p><p>Callbacks: ${r.data.callbacks}</p></div>`;
    };
    window.evtClear = async () => { await EspDSL.eventClear(); evtRefresh(); };
    window.evtEmit = async () => {
        const id = parseInt(container.querySelector('#evt-id').value) || 0;
        const val = parseInt(container.querySelector('#evt-val').value) || 0;
        await EspDSL.eventEmit(id, val);
    };
};
```

### data\js\components\messages.js
```
COMPONENT_RENDERERS.messages = function(container) {
    container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column">
            <div class="toolbar">
                <label style="font-size:12px;color:var(--text-secondary)">Task ID:</label>
                <input id="msg-tid" type="number" value="0" style="width:50px">
                <button class="btn" onclick="msgRefresh()">↻ Peek</button>
                <button class="btn" onclick="msgShowStats()">Stats</button>
                <button class="btn danger small" onclick="msgClear()">Clear</button>
                <div style="flex:1"></div>
                <label style="font-size:12px">Send:</label>
                <input id="msg-to" type="number" placeholder="To" style="width:40px">
                <input id="msg-topic" type="number" placeholder="Topic" style="width:50px">
                <input id="msg-val" type="number" placeholder="Value" style="width:60px">
                <button class="btn small primary" onclick="msgSend()">Send</button>
            </div>
            <div class="panel" id="msg-content" style="flex:1"><p>Click Peek to view messages</p></div>
        </div>
    `;
    window.msgRefresh = async () => {
        const tid = parseInt(container.querySelector('#msg-tid').value) || 0;
        const r = await EspDSL.msgPeek(tid);
        const c = container.querySelector('#msg-content');
        if (!r.data || !r.data.messages || r.data.messages.length === 0) { c.innerHTML = '<p>No messages</p>'; return; }
        let html = '<table><tr><th>From</th><th>Topic</th><th>Value</th><th>Time</th><th>Prio</th></tr>';
        r.data.messages.forEach(m => {
            html += `<tr><td>${m.from}</td><td>${m.topic}</td><td>${m.value}</td><td>${m.time}</td><td>${m.priority}</td></tr>`;
        });
        c.innerHTML = html + '</table>';
    };
    window.msgShowStats = async () => {
        const r = await EspDSL.msgStats();
        const c = container.querySelector('#msg-content');
        if (r.data) c.innerHTML = `<div class="panel"><p>Sent: ${r.data.sent}</p><p>Delivered: ${r.data.delivered}</p><p>Dropped: ${r.data.dropped}</p></div>`;
    };
    window.msgClear = async () => {
        const tid = parseInt(container.querySelector('#msg-tid').value);
        await EspDSL.msgClear(tid);
        msgRefresh();
    };
    window.msgSend = async () => {
        const to = parseInt(container.querySelector('#msg-to').value) || 0;
        const topic = parseInt(container.querySelector('#msg-topic').value) || 0;
        const val = parseInt(container.querySelector('#msg-val').value) || 0;
        await EspDSL.msgSend(to, topic, val);
    };
};
```

### data\js\components\modules.js
```
COMPONENT_RENDERERS.modules = function(container) {
    container.innerHTML = '<div class="panel" id="mod-content"><p>Loading...</p></div>';
    async function refresh() {
        const r = await EspDSL.modules();
        const c = container.querySelector('#mod-content');
        if (!r.data || !r.data.modules) { c.innerHTML = '<p>No data</p>'; return; }
        let html = '<div class="panel-header"><span class="panel-title">Modules (' + r.data.count + ')</span><button class="btn small" onclick="modRefresh()">↻</button></div>';
        html += '<table><tr><th>Name</th><th>Version</th><th>Methods</th><th>Type</th></tr>';
        r.data.modules.forEach(m => {
            html += `<tr>
                <td><strong>${m.name}</strong></td>
                <td>v${m.version}</td>
                <td style="font-family:var(--font-mono);font-size:11px">${m.methods.join(', ')}</td>
                <td><span class="tag ${m.plugin ? 'active' : ''}">${m.plugin ? 'Plugin' : 'Builtin'}</span></td>
            </tr>`;
        });
        html += '</table>';
        c.innerHTML = html;
    }
    window.modRefresh = refresh;
    refresh();
};
```

### data\js\components\rules.js
```
COMPONENT_RENDERERS.rules = function(container) {
    container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column">
            <div class="toolbar">
                <button class="btn" onclick="ruleRefresh()">↻ Rules</button>
                <button class="btn" onclick="metricRefresh()">📊 Metrics</button>
                <div style="flex:1"></div>
                <input id="rule-mid" type="number" placeholder="Metric ID" style="width:80px">
                <input id="rule-mval" type="number" placeholder="Value" step="0.1" style="width:70px">
                <button class="btn small primary" onclick="metricSet()">Set</button>
            </div>
            <div class="panel" id="rule-content" style="flex:1"><p>Click Rules or Metrics</p></div>
        </div>
    `;
    window.ruleRefresh = async () => {
        const r = await EspDSL.rules();
        const c = container.querySelector('#rule-content');
        if (!r.data || !r.data.rules || r.data.rules.length === 0) { c.innerHTML = '<p>No rules</p>'; return; }
        let html = '<table><tr><th>Idx</th><th>Name</th><th>Status</th><th>Prio</th><th>Fires</th><th>Conds</th><th>Acts</th><th>Action</th></tr>';
        r.data.rules.forEach(ru => {
            html += `<tr><td>${ru.index}</td><td>${ru.name}</td><td><span class="tag ${ru.enabled?'active':'inactive'}">${ru.enabled?'ON':'OFF'}</span></td>
                <td>${ru.priority}</td><td>${ru.fires}</td><td>${ru.conditions}</td><td>${ru.actions}</td>
                <td><button class="btn small" onclick="ruleToggle(${ru.index},${!ru.enabled})">${ru.enabled?'Disable':'Enable'}</button></td></tr>`;
        });
        c.innerHTML = html + '</table>';
    };
    window.metricRefresh = async () => {
        const r = await EspDSL.metrics();
        const c = container.querySelector('#rule-content');
        if (!r.data || !r.data.metrics || r.data.metrics.length === 0) { c.innerHTML = '<p>No metrics</p>'; return; }
        let html = '<table><tr><th>ID</th><th>Value</th><th>Valid</th></tr>';
        r.data.metrics.forEach(m => { html += `<tr><td>${m.id}</td><td>${m.value}</td><td>${m.valid?'✓':'✗'}</td></tr>`; });
        c.innerHTML = html + '</table>';
    };
    window.ruleToggle = async (idx, enabled) => { await EspDSL.ruleEnable(idx, enabled); ruleRefresh(); };
    window.metricSet = async () => {
        const id = parseInt(container.querySelector('#rule-mid').value) || 0;
        const val = parseFloat(container.querySelector('#rule-mval').value) || 0;
        await EspDSL.metricSet(id, val);
    };
};
```

### data\js\components\settings.js
```
COMPONENT_RENDERERS.settings = function(container) {
    container.innerHTML = `
        <div class="panel">
            <div class="panel-header"><span class="panel-title">Settings</span></div>
            <h4 style="margin:12px 0 8px;color:var(--text-accent)">Connection</h4>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <label style="font-size:12px;width:60px">WS URL:</label>
                <input id="set-ws" value="${AppState.wsUrl}" style="flex:1">
            </div>
            <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
                <label style="font-size:12px;width:60px">Token:</label>
                <input id="set-token" value="${AppState.token}" style="flex:1">
            </div>
            <button class="btn primary" onclick="settConnect()">Connect</button>
            <button class="btn danger" onclick="settReboot()">Reboot Device</button>
            <h4 style="margin:16px 0 8px;color:var(--text-accent)">Device</h4>
            <div id="set-device" style="font-size:12px;color:var(--text-secondary)">Not connected</div>
            <button class="btn small" onclick="settDevStatus()" style="margin-top:8px">Refresh Status</button>
        </div>
    `;
    window.settConnect = async () => {
        AppState.wsUrl = container.querySelector('#set-ws').value;
        AppState.token = container.querySelector('#set-token').value;
        try {
            await EspDSL.connect(AppState.wsUrl, AppState.token);
            AppState.connected = true;
            AppState.notify();
        } catch (e) { alert('Connection failed: ' + e); }
    };
    window.settReboot = async () => {
        if (confirm('Reboot device?')) await EspDSL.deviceReboot();
    };
    window.settDevStatus = async () => {
        const r = await EspDSL.deviceStatus();
        const d = container.querySelector('#set-device');
        if (r.data) {
            d.innerHTML = Object.entries(r.data).map(([k, v]) => `<div>${k}: <strong>${v}</strong></div>`).join('');
        }
    };
};
```

### data\js\components\scripts.js
```
COMPONENT_RENDERERS.scripts = function(container) {
    container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column">
            <div class="toolbar">
                <button class="btn" onclick="scrRefresh()">↻ Refresh</button>
            </div>
            <div class="panel" id="scr-content" style="flex:1"><p>Loading...</p></div>
        </div>
    `;
    window.scrRefresh = async () => {
        const r = await EspDSL.scripts();
        const c = container.querySelector('#scr-content');
        if (!r.data || !r.data.scripts || r.data.scripts.length === 0) { c.innerHTML = '<p>No saved scripts</p>'; return; }
        let html = '<table><tr><th>Name</th><th>Size</th><th>AutoRun</th><th>Actions</th></tr>';
        r.data.scripts.forEach(s => {
            html += `<tr><td><strong>${s.name}</strong></td><td>${s.size} chars</td><td>${s.autoRun?'✓':''}</td>
                <td><div class="btn-group">
                    <button class="btn small primary" onclick="scrOpen('${s.name}')">Open</button>
                    <button class="btn small danger" onclick="scrDel('${s.name}')">✕</button>
                </div></td></tr>`;
        });
        c.innerHTML = html + '</table>';
    };
    window.scrOpen = async (name) => {
        const r = await EspDSL.scriptOpen(name);
        if (r.status === 'ok') {
            AppState.openWindow('ide', 'Code Editor', '📝', 'ide');
        }
    };
    window.scrDel = async (name) => {
        if (confirm('Delete "' + name + '"?')) { await EspDSL.scriptDelete(name); scrRefresh(); }
    };
    scrRefresh();
};
```

### data\js\components\profiler.js
```
COMPONENT_RENDERERS.profiler = function(container) {
    container.innerHTML = `
        <div style="height:100%;display:flex;flex-direction:column">
            <div class="toolbar">
                <button class="btn success" onclick="profCmd('start')">▶ Start</button>
                <button class="btn" onclick="profCmd('stop')">⏹ Stop</button>
                <button class="btn" onclick="profCmd('report')">📊 Report</button>
                <button class="btn danger" onclick="profCmd('reset')">↺ Reset</button>
            </div>
            <div class="panel" id="prof-output" style="flex:1;font-family:var(--font-mono);font-size:12px;white-space:pre-wrap">
                Click "Start" to begin profiling, then "Report" to see results.
            </div>
        </div>
    `;
    window.profCmd = async (cmd) => {
        const out = container.querySelector('#prof-output');
        if (cmd === 'start') { await EspDSL.profStart(); out.textContent = 'Profiler started...'; }
        else if (cmd === 'stop') { await EspDSL.profStop(); out.textContent = 'Profiler stopped.'; }
        else if (cmd === 'reset') { await EspDSL.profReset(); out.textContent = 'Profiler reset.'; }
        else if (cmd === 'report') {
            const r = await EspDSL.profReport();
            out.textContent = r.data ? r.data.output : 'No data';
        }
    };
};
```

### data\js\components\shell.js
```
function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';
    const desktop = document.createElement('div');
    renderDesktop(desktop);
    app.appendChild(desktop);
    const taskbar = document.createElement('div');
    renderTaskbar(taskbar);
    app.appendChild(taskbar);
}
```

### data\js\components\taskbar.js
```
function renderTaskbar(container) {
    container.innerHTML = '';
    container.className = 'taskbar';
    const start = document.createElement('button');
    start.className = 'taskbar-start';
    start.textContent = '⚡ EspDSL';
    start.onclick = () => AppState.openWindow('about', 'About EspDSL', 'ℹ️', 'about');
    container.appendChild(start);
    const items = document.createElement('div');
    items.className = 'taskbar-items';
    AppState.windows.forEach(w => {
        const item = document.createElement('button');
        item.className = 'taskbar-item' + (w.id === AppState.activeWindowId && !w.minimized ? ' active' : '');
        item.textContent = (w.icon || '') + ' ' + w.title;
        item.onclick = () => {
            if (w.minimized) { w.minimized = false; AppState.focusWindow(w.id); AppState.notify(); }
            else if (w.id === AppState.activeWindowId) { AppState.minimizeWindow(w.id); }
            else { AppState.focusWindow(w.id); }
        };
        items.appendChild(item);
    });
    container.appendChild(items);
    const status = document.createElement('div');
    status.className = 'taskbar-status';
    const dot = document.createElement('span');
    dot.className = 'status-dot ' + (AppState.connected ? 'connected' : 'disconnected');
    status.appendChild(dot);
    const st = AppState.engineStatus;
    if (st.running) {
        const r = document.createElement('span');
        r.textContent = '▶ ' + st.taskCount + 'T';
        r.style.color = 'var(--text-success)';
        status.appendChild(r);
    }
    if (st.freeHeap > 0) {
        const h = document.createElement('span');
        h.textContent = Format.bytes(st.freeHeap);
        status.appendChild(h);
    }
    container.appendChild(status);
    const clock = document.createElement('div');
    clock.className = 'taskbar-clock';
    clock.textContent = Format.clock();
    container.appendChild(clock);
}
```

### data\js\components\terminal.js
```
COMPONENT_RENDERERS.terminal = function(container) {
    container.innerHTML = `
        <div class="terminal">
            <div class="terminal-output" id="term-output"></div>
            <div class="terminal-input-line">
                <span class="terminal-prompt">❯</span>
                <input class="terminal-input" id="term-input" placeholder="Type command..." autofocus>
            </div>
        </div>
    `;
    const output = container.querySelector('#term-output');
    const input = container.querySelector('#term-input');
    const history = [];
    let histIdx = -1;
    function appendOutput(text, cls = '') {
        const line = document.createElement('div');
        if (cls) line.className = cls;
        line.textContent = text;
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
    appendOutput('EspDSL Console. Type "help" for commands.', 'term-info');
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            if (!cmd) return;
            history.unshift(cmd);
            histIdx = -1;
            appendOutput('❯ ' + cmd, 'term-info');
            input.value = '';
            try {
                const resp = await EspDSL.console(cmd);
                if (resp.data && resp.data.output) {
                    resp.data.output.split('\n').forEach(line => {
                        if (line.trim()) appendOutput(line);
                    });
                }
                if (resp.status === 'error') appendOutput('Error: ' + resp.error, 'term-error');
            } catch (err) {
                appendOutput('Connection error: ' + err, 'term-error');
            }
        }
        if (e.key === 'ArrowUp') { histIdx = Math.min(histIdx + 1, history.length - 1); if (histIdx >= 0) input.value = history[histIdx]; e.preventDefault(); }
        if (e.key === 'ArrowDown') { histIdx = Math.max(histIdx - 1, -1); input.value = histIdx >= 0 ? history[histIdx] : ''; e.preventDefault(); }
    });
    input.focus();
};
```

### data\js\components\taskman.js
```
COMPONENT_RENDERERS.taskman = function(container) {
    container.innerHTML = `
        <div class="panel" style="padding:0">
            <div class="toolbar">
                <button class="btn" id="tm-refresh">↻ Refresh</button>
                <button class="btn" id="tm-auto">▶ Auto</button>
                <div style="flex:1"></div>
                <span id="tm-count" style="font-size:12px;color:var(--text-muted)"></span>
            </div>
            <div class="table-wrap" id="tm-table" style="padding:0"></div>
        </div>
    `;
    let autoTimer = null;
    async function refresh() {
        try {
            const r = await EspDSL.tasks();
            const table = container.querySelector('#tm-table');
            const count = container.querySelector('#tm-count');
            if (!r.data || !r.data.tasks) { table.innerHTML = '<p style="padding:12px">No data</p>'; return; }
            const tasks = r.data.tasks;
            count.textContent = tasks.length + ' task(s)';
            let html = '<table><tr><th>ID</th><th>Name</th><th>Status</th><th>IP</th><th>Prio</th><th>Instructions</th><th>Runs</th><th>Actions</th></tr>';
            tasks.forEach(t => {
                const st = t.halted ? 'halted' : (t.paused ? 'paused' : (t.active ? 'running' : 'halted'));
                html += `<tr>
                    <td>${t.id}</td>
                    <td><strong>${t.name}</strong></td>
                    <td><span class="tag ${st}">${t.status}</span></td>
                    <td style="font-family:var(--font-mono)">${t.ip}</td>
                    <td>${t.priority}</td>
                    <td style="font-family:var(--font-mono)">${Format.number(t.instructions)}</td>
                    <td>${t.runs}</td>
                    <td>
                        <div class="btn-group">
                            ${t.paused ? `<button class="btn small success" onclick="tmAction('resume',${t.id})">▶</button>` : `<button class="btn small" onclick="tmAction('pause',${t.id})">⏸</button>`}
                            <button class="btn small" onclick="tmAction('restart',${t.id})">↺</button>
                            <button class="btn small danger" onclick="tmAction('stop',${t.id})">⏹</button>
                            <button class="btn small danger" onclick="tmAction('remove',${t.id})">✕</button>
                        </div>
                    </td>
                </tr>`;
            });
            html += '</table>';
            table.innerHTML = html;
        } catch (e) { console.error(e); }
    }
    window.tmAction = async (action, id) => {
        if (action === 'pause') await EspDSL.pauseTask(id);
        else if (action === 'resume') await EspDSL.resumeTask(id);
        else if (action === 'restart') await EspDSL.restartTask(id);
        else if (action === 'stop') await EspDSL.stopTask(id);
        else if (action === 'remove') { if (confirm('Remove task ' + id + '?')) await EspDSL.removeTask(id); }
        refresh();
    };
    container.querySelector('#tm-refresh').onclick = refresh;
    container.querySelector('#tm-auto').onclick = function() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; this.textContent = '▶ Auto'; }
        else { autoTimer = setInterval(refresh, 1000); this.textContent = '⏸ Auto'; }
    };
    refresh();
};
```

### data\js\components\window.js
```
function createWindow(config) {
    const el = document.createElement('div');
    el.className = 'window' + (config.id === AppState.activeWindowId ? ' focused' : '');
    el.style.cssText = config.maximized
        ? 'left:0;top:0;width:100%;height:calc(100% - var(--taskbar-height));z-index:' + config.zIndex
        : `left:${config.x}px;top:${config.y}px;width:${config.width}px;height:${config.height}px;z-index:${config.zIndex}`;
    el.setAttribute('data-wid', config.id);
    const titlebar = document.createElement('div');
    titlebar.className = 'window-titlebar';
    titlebar.innerHTML = `
        <span class="icon">${config.icon || '📄'}</span>
        <span class="window-title">${config.title}</span>
        <div class="window-controls">
            <button class="window-btn minimize" title="Minimize">─</button>
            <button class="window-btn maximize" title="Maximize">□</button>
            <button class="window-btn close" title="Close">✕</button>
        </div>
    `;
    titlebar.querySelector('.close').onclick = (e) => { e.stopPropagation(); AppState.closeWindow(config.id); };
    titlebar.querySelector('.minimize').onclick = (e) => { e.stopPropagation(); AppState.minimizeWindow(config.id); };
    titlebar.querySelector('.maximize').onclick = (e) => { e.stopPropagation(); AppState.maximizeWindow(config.id); };
    let dragging = false, dragX, dragY;
    titlebar.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        if (config.maximized) return;
        dragging = true;
        dragX = e.clientX - config.x;
        dragY = e.clientY - config.y;
        AppState.focusWindow(config.id);
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        config.x = Math.max(0, e.clientX - dragX);
        config.y = Math.max(0, e.clientY - dragY);
        el.style.left = config.x + 'px';
        el.style.top = config.y + 'px';
    });
    document.addEventListener('mouseup', () => {
        if (dragging) { dragging = false; AppState.updateWindow(config.id, { x: config.x, y: config.y }); }
    });
    el.addEventListener('mousedown', () => AppState.focusWindow(config.id));
    const content = document.createElement('div');
    content.className = 'window-content';
    const resize = document.createElement('div');
    resize.className = 'window-resize';
    let resizing = false, rw, rh;
    resize.addEventListener('mousedown', (e) => {
        if (config.maximized) return;
        resizing = true;
        rw = config.width; rh = config.height;
        const startX = e.clientX, startY = e.clientY;
        const onMove = (e2) => {
            config.width = Math.max(320, rw + e2.clientX - startX);
            config.height = Math.max(200, rh + e2.clientY - startY);
            el.style.width = config.width + 'px';
            el.style.height = config.height + 'px';
        };
        const onUp = () => {
            resizing = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            AppState.updateWindow(config.id, { width: config.width, height: config.height });
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.preventDefault();
    });
    el.appendChild(titlebar);
    el.appendChild(content);
    el.appendChild(resize);
    return { el, content };
}
```

### data\js\utils\format.js
```
const Format = {
    bytes(n) {
        if (n < 1024) return n + 'B';
        if (n < 1048576) return (n / 1024).toFixed(1) + 'KB';
        return (n / 1048576).toFixed(1) + 'MB';
    },
    number(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    },
    percent(n) { return n.toFixed(1) + '%'; },
    time(ms) {
        if (ms < 1000) return ms + 'ms';
        if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
        const m = Math.floor(ms / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        return m + 'm ' + s + 's';
    },
    us(n) { return n < 1000 ? n + 'µs' : (n / 1000).toFixed(1) + 'ms'; },
    clock() {
        const d = new Date();
        return d.getHours().toString().padStart(2, '0') + ':' +
               d.getMinutes().toString().padStart(2, '0');
    },
    statusColor(status) {
        if (!status) return '';
        const s = String(status);
        if (s === 'OK' || s === 'HALT') return 'halted';
        if (s === 'WAIT' || s === 'YIELD' || s === 'SLICE_END') return 'running';
        if (s === 'BREAKPOINT') return 'paused';
        if (s.startsWith('ERR') || s.startsWith('Err')) return 'halted';
        return '';
    }
};
```

### data\js\utils\state.js
```
const AppState = {
    connected: false,
    wsUrl: 'ws://192.168.4.1:8080',
    token: 'espdsl-token',
    windows: [],
    nextZIndex: 100,
    activeWindowId: null,
    engineStatus: {
        compiled: false,
        running: false,
        uptime: 0,
        taskCount: 0,
        freeHeap: 0,
        estimatedRam: 0,
        lastTickUs: 0
    },
    _listeners: [],
    subscribe(fn) { this._listeners.push(fn); return () => { this._listeners = this._listeners.filter(l => l !== fn); }; },
    notify() { this._listeners.forEach(fn => fn()); },
    openWindow(id, title, icon, component, props = {}) {
        const existing = this.windows.find(w => w.id === id);
        if (existing) {
            existing.minimized = false;
            this.focusWindow(id);
            return;
        }
        this.windows.push({
            id, title, icon, component, props,
            x: 50 + Math.random() * 200,
            y: 30 + Math.random() * 100,
            width: 700, height: 500,
            minimized: false,
            maximized: false,
            zIndex: ++this.nextZIndex
        });
        this.activeWindowId = id;
        this.notify();
    },
    closeWindow(id) {
        this.windows = this.windows.filter(w => w.id !== id);
        if (this.activeWindowId === id) this.activeWindowId = this.windows.length > 0 ? this.windows[this.windows.length - 1].id : null;
        this.notify();
    },
    focusWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (w) { w.zIndex = ++this.nextZIndex; this.activeWindowId = id; }
        this.notify();
    },
    minimizeWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (w) w.minimized = true;
        this.notify();
    },
    maximizeWindow(id) {
        const w = this.windows.find(w => w.id === id);
        if (w) w.maximized = !w.maximized;
        this.notify();
    },
    updateWindow(id, props) {
        const w = this.windows.find(w => w.id === id);
        if (w) Object.assign(w, props);
        this.notify();
    },
    updateEngineStatus(status) {
        Object.assign(this.engineStatus, status);
        this.notify();
    }
};
```

### data\js\utils\theme.js
```
const Theme = {
    current: 'dark',
    toggle() {
        this.current = this.current === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', this.current);
    }
};
```

### data\js\vendor\htm.min.js
```
!function(){function n(n){var t=e.get(this);return t||(t=new Map,e.set(this,t)),1<(t=p(this,t.get(n)||(t.set(n,t=function(n){function t(n){1===u&&(n||(r=r.replace(/^\s*\n\s*|\s*\n\s*$/g,"")))?p.push(0,n,r):3===u&&(n||r)?(p.push(3,n,r),u=2):2===u&&"..."===r&&n?p.push(4,n,0):2===u&&r&&!n?p.push(5,0,!0,r):5<=u&&((r||!n&&5===u)&&(p.push(u,0,r,s),u=6),n&&(p.push(u,n,0,s),u=6)),r=""}for(var e,s,u=1,r="",h="",p=[0],o=0;o<n.length;o++){o&&(1===u&&t(),t(o));for(var a=0;a<n[o].length;a++)e=n[o][a],1===u?"<"===e?(t(),p=[p],u=3):r+=e:4===u?r="--"===r&&">"===e?(u=1,""):e+r[0]:h?e===h?h="":r+=e:'"'===e||"'"===e?h=e:">"===e?(t(),u=1):u&&("="===e?(u=5,s=r,r=""):"/"===e&&(u<5||">"===n[o][a+1])?(t(),3===u&&(p=p[0]),(p=(u=p)[0]).push(2,0,u),u=0):" "===e||"\t"===e||"\n"===e||"\r"===e?(t(),u=2):r+=e),3===u&&"!--"===r&&(u=4,p=p[0])}return t(),p}(n)),t),arguments,[])).length?t:t[0]}var p=function(n,t,e,s){t[0]=0;for(var u=1;u<t.length;u++){var r=t[u++],h=t[u]?(t[0]|=r?1:2,e[t[u++]]):t[++u];3===r?s[0]=h:4===r?s[1]=Object.assign(s[1]||{},h):5===r?(s[1]=s[1]||{})[t[++u]]=h:6===r?s[1][t[++u]]+=h+"":r?(r=n.apply(h,p(n,h,e,["",null])),s.push(r),h[0]?t[0]|=2:(t[u-2]=0,t[u]=r)):s.push(h)}return s},e=new Map;"undefined"!=typeof module?module.exports=n:self.htm=n}();
```

### data\js\vendor\signals.min.js
```
!function(i,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((i||self).preactSignalsCore={})}(this,function(i){function t(){throw new Error("Cycle detected")}var n=Symbol.for("preact-signals");function o(){if(!(s>1)){var i,t=!1;while(void 0!==h){var n=h;h=void 0;e++;while(void 0!==n){var o=n.o;n.o=void 0;n.f&=-3;if(!(8&n.f)&&c(n))try{n.c()}catch(n){if(!t){i=n;t=!0}}n=o}}e=0;s--;if(t)throw i}else s--}var r=void 0,f=0,h=void 0,s=0,e=0,v=0;function u(i){if(void 0!==r){var t=i.n;if(void 0===t||t.t!==r){t={i:0,S:i,p:r.s,n:void 0,t:r,e:void 0,x:void 0,r:t};if(void 0!==r.s)r.s.n=t;r.s=t;i.n=t;if(32&r.f)i.S(t);return t}else if(-1===t.i){t.i=0;if(void 0!==t.n){t.n.p=t.p;if(void 0!==t.p)t.p.n=t.n;t.p=r.s;t.n=void 0;r.s.n=t;r.s=t}return t}}}function d(i){this.v=i;this.i=0;this.n=void 0;this.t=void 0}d.prototype.brand=n;d.prototype.h=function(){return!0};d.prototype.S=function(i){if(this.t!==i&&void 0===i.e){i.x=this.t;if(void 0!==this.t)this.t.e=i;this.t=i}};d.prototype.U=function(i){if(void 0!==this.t){var t=i.e,n=i.x;if(void 0!==t){t.x=n;i.e=void 0}if(void 0!==n){n.e=t;i.x=void 0}if(i===this.t)this.t=n}};d.prototype.subscribe=function(i){var t=this;return _(function(){var n=t.value,o=32&this.f;this.f&=-33;try{i(n)}finally{this.f|=o}})};d.prototype.valueOf=function(){return this.value};d.prototype.toString=function(){return this.value+""};d.prototype.toJSON=function(){return this.value};d.prototype.peek=function(){return this.v};Object.defineProperty(d.prototype,"value",{get:function(){var i=u(this);if(void 0!==i)i.i=this.i;return this.v},set:function(i){if(r instanceof y)!function(){throw new Error("Computed cannot have side-effects")}();if(i!==this.v){if(e>100)t();this.v=i;this.i++;v++;s++;try{for(var n=this.t;void 0!==n;n=n.x)n.t.N()}finally{o()}}}});function c(i){for(var t=i.s;void 0!==t;t=t.n)if(t.S.i!==t.i||!t.S.h()||t.S.i!==t.i)return!0;return!1}function a(i){for(var t=i.s;void 0!==t;t=t.n){var n=t.S.n;if(void 0!==n)t.r=n;t.S.n=t;t.i=-1;if(void 0===t.n){i.s=t;break}}}function l(i){var t=i.s,n=void 0;while(void 0!==t){var o=t.p;if(-1===t.i){t.S.U(t);if(void 0!==o)o.n=t.n;if(void 0!==t.n)t.n.p=o}else n=t;t.S.n=t.r;if(void 0!==t.r)t.r=void 0;t=o}i.s=n}function y(i){d.call(this,void 0);this.x=i;this.s=void 0;this.g=v-1;this.f=4}(y.prototype=new d).h=function(){this.f&=-3;if(1&this.f)return!1;if(32==(36&this.f))return!0;this.f&=-5;if(this.g===v)return!0;this.g=v;this.f|=1;if(this.i>0&&!c(this)){this.f&=-2;return!0}var i=r;try{a(this);r=this;var t=this.x();if(16&this.f||this.v!==t||0===this.i){this.v=t;this.f&=-17;this.i++}}catch(i){this.v=i;this.f|=16;this.i++}r=i;l(this);this.f&=-2;return!0};y.prototype.S=function(i){if(void 0===this.t){this.f|=36;for(var t=this.s;void 0!==t;t=t.n)t.S.S(t)}d.prototype.S.call(this,i)};y.prototype.U=function(i){if(void 0!==this.t){d.prototype.U.call(this,i);if(void 0===this.t){this.f&=-33;for(var t=this.s;void 0!==t;t=t.n)t.S.U(t)}}};y.prototype.N=function(){if(!(2&this.f)){this.f|=6;for(var i=this.t;void 0!==i;i=i.x)i.t.N()}};y.prototype.peek=function(){if(!this.h())t();if(16&this.f)throw this.v;return this.v};Object.defineProperty(y.prototype,"value",{get:function(){if(1&this.f)t();var i=u(this);this.h();if(void 0!==i)i.i=this.i;if(16&this.f)throw this.v;return this.v}});function w(i){var t=i.u;i.u=void 0;if("function"==typeof t){s++;var n=r;r=void 0;try{t()}catch(t){i.f&=-2;i.f|=8;p(i);throw t}finally{r=n;o()}}}function p(i){for(var t=i.s;void 0!==t;t=t.n)t.S.U(t);i.x=void 0;i.s=void 0;w(i)}function b(i){if(r!==this)throw new Error("Out-of-order effect");l(this);r=i;this.f&=-2;if(8&this.f)p(this);o()}function g(i){this.x=i;this.u=void 0;this.s=void 0;this.o=void 0;this.f=32}g.prototype.c=function(){var i=this.S();try{if(8&this.f)return;if(void 0===this.x)return;var t=this.x();if("function"==typeof t)this.u=t}finally{i()}};g.prototype.S=function(){if(1&this.f)t();this.f|=1;this.f&=-9;w(this);a(this);s++;var i=r;r=this;return b.bind(this,i)};g.prototype.N=function(){if(!(2&this.f)){this.f|=2;this.o=h;h=this}};g.prototype.d=function(){this.f|=8;if(!(1&this.f))p(this)};function _(i){var t=new g(i);try{t.c()}catch(i){t.d();throw i}return t.d.bind(t)}i.Signal=d;i.batch=function(i){if(s>0)return i();s++;try{return i()}finally{o()}};i.computed=function(i){return new y(i)};i.effect=_;i.signal=function(i){return new d(i)};i.untracked=function(i){if(f>0)return i();var t=r;r=void 0;f++;try{return i()}finally{f--;r=t}}});//# sourceMappingURL=signals-core.min.js.map

```

### data\js\vendor\preact.min.js
```
!function(){var n,l,t,u,i,o,r,e,f,c,a=65536,s=1<<17,h={},v=[],p=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,y=Array.isArray;function d(n,l){for(var t in l)n[t]=l[t];return n}function _(n){var l=n.parentNode;l&&l.removeChild(n)}function m(l,t,u){var i,o,r,e={};for(r in t)"key"==r?i=t[r]:"ref"==r?o=t[r]:e[r]=t[r];if(arguments.length>2&&(e.children=arguments.length>3?n.call(arguments,2):u),"function"==typeof l&&null!=l.defaultProps)for(r in l.defaultProps)void 0===e[r]&&(e[r]=l.defaultProps[r]);return g(l,e,i,o,null)}function g(n,u,i,o,r){var e={type:n,props:u,key:i,ref:o,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:null==r?++t:r,__i:-1,__u:0};return null==r&&null!=l.vnode&&l.vnode(e),e}function b(n){return n.children}function k(n,l){this.props=n,this.context=l}function w(n,l){if(null==l)return n.__?w(n.__,n.__i+1):null;for(var t;l<n.__k.length;l++)if(null!=(t=n.__k[l])&&null!=t.__e)return t.__e;return"function"==typeof n.type?w(n):null}function C(n){var l,t;if(null!=(n=n.__)&&null!=n.__c){for(n.__e=n.__c.base=null,l=0;l<n.__k.length;l++)if(null!=(t=n.__k[l])&&null!=t.__e){n.__e=n.__c.base=t.__e;break}return C(n)}}function x(n){(!n.__d&&(n.__d=!0)&&i.push(n)&&!P.__r++||o!==l.debounceRendering)&&((o=l.debounceRendering)||r)(P)}function P(){var n,t,u,o,r,f,c,a,s;for(i.sort(e);n=i.shift();)n.__d&&(t=i.length,o=void 0,f=(r=(u=n).__v).__e,a=[],s=[],(c=u.__P)&&((o=d({},r)).__v=r.__v+1,l.vnode&&l.vnode(o),L(c,o,r,u.__n,void 0!==c.ownerSVGElement,32&r.__u?[f]:null,a,null==f?w(r):f,!!(32&r.__u),s),o.__.__k[o.__i]=o,M(a,o,s),o.__e!=f&&C(o)),i.length>t&&i.sort(e));P.__r=0}function S(n,l,t,u,i,o,r,e,f,c,s){var p,y,d,_,m,g=u&&u.__k||v,b=l.length;for(t.__d=f,$(t,l,g),f=t.__d,p=0;p<b;p++)null!=(d=t.__k[p])&&"boolean"!=typeof d&&"function"!=typeof d&&(y=-1===d.__i?h:g[d.__i]||h,d.__i=p,L(n,d,y,i,o,r,e,f,c,s),_=d.__e,d.ref&&y.ref!=d.ref&&(y.ref&&z(y.ref,null,d),s.push(d.ref,d.__c||_,d)),null==m&&null!=_&&(m=_),d.__u&a||y.__k===d.__k?f=A(d,f,n):"function"==typeof d.type&&void 0!==d.__d?f=d.__d:_&&(f=_.nextSibling),d.__d=void 0,d.__u&=-196609);t.__d=f,t.__e=m}function $(n,l,t){var u,i,o,r,e,f=l.length,c=t.length,h=c,v=0;for(n.__k=[],u=0;u<f;u++)null!=(i=n.__k[u]=null==(i=l[u])||"boolean"==typeof i||"function"==typeof i?null:"string"==typeof i||"number"==typeof i||"bigint"==typeof i||i.constructor==String?g(null,i,null,null,i):y(i)?g(b,{children:i},null,null,null):void 0===i.constructor&&i.__b>0?g(i.type,i.props,i.key,i.ref?i.ref:null,i.__v):i)?(i.__=n,i.__b=n.__b+1,e=E(i,t,r=u+v,h),i.__i=e,o=null,-1!==e&&(h--,(o=t[e])&&(o.__u|=s)),null==o||null===o.__v?(-1==e&&v--,"function"!=typeof i.type&&(i.__u|=a)):e!==r&&(e===r+1?v++:e>r?h>f-r?v+=e-r:v--:v=e<r&&e==r-1?e-r:0,e!==u+v&&(i.__u|=a))):(o=t[u])&&null==o.key&&o.__e&&(o.__e==n.__d&&(n.__d=w(o)),F(o,o,!1),t[u]=null,h--);if(h)for(u=0;u<c;u++)null!=(o=t[u])&&0==(o.__u&s)&&(o.__e==n.__d&&(n.__d=w(o)),F(o,o))}function A(n,l,t){var u,i;if("function"==typeof n.type){for(u=n.__k,i=0;u&&i<u.length;i++)u[i]&&(u[i].__=n,l=A(u[i],l,t));return l}return n.__e!=l&&(t.insertBefore(n.__e,l||null),l=n.__e),l&&l.nextSibling}function E(n,l,t,u){var i=n.key,o=n.type,r=t-1,e=t+1,f=l[t];if(null===f||f&&i==f.key&&o===f.type)return t;if(u>(null!=f&&0==(f.__u&s)?1:0))for(;r>=0||e<l.length;){if(r>=0){if((f=l[r])&&0==(f.__u&s)&&i==f.key&&o===f.type)return r;r--}if(e<l.length){if((f=l[e])&&0==(f.__u&s)&&i==f.key&&o===f.type)return e;e++}}return-1}function H(n,l,t){"-"===l[0]?n.setProperty(l,null==t?"":t):n[l]=null==t?"":"number"!=typeof t||p.test(l)?t:t+"px"}function I(n,l,t,u,i){var o;n:if("style"===l)if("string"==typeof t)n.style.cssText=t;else{if("string"==typeof u&&(n.style.cssText=u=""),u)for(l in u)t&&l in t||H(n.style,l,"");if(t)for(l in t)u&&t[l]===u[l]||H(n.style,l,t[l])}else if("o"===l[0]&&"n"===l[1])o=l!==(l=l.replace(/(PointerCapture)$|Capture$/,"$1")),l=l.toLowerCase()in n?l.toLowerCase().slice(2):l.slice(2),n.l||(n.l={}),n.l[l+o]=t,t?u?t.t=u.t:(t.t=Date.now(),n.addEventListener(l,o?D:T,o)):n.removeEventListener(l,o?D:T,o);else{if(i)l=l.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if("width"!==l&&"height"!==l&&"href"!==l&&"list"!==l&&"form"!==l&&"tabIndex"!==l&&"download"!==l&&"rowSpan"!==l&&"colSpan"!==l&&"role"!==l&&l in n)try{n[l]=null==t?"":t;break n}catch(n){}"function"==typeof t||(null==t||!1===t&&"-"!==l[4]?n.removeAttribute(l):n.setAttribute(l,t))}}function T(n){var t=this.l[n.type+!1];if(n.u){if(n.u<=t.t)return}else n.u=Date.now();return t(l.event?l.event(n):n)}function D(n){return this.l[n.type+!0](l.event?l.event(n):n)}function L(n,t,u,i,o,r,e,f,c,a){var s,h,v,p,_,m,g,w,C,x,P,$,A,E,H,I=t.type;if(void 0!==t.constructor)return null;128&u.__u&&(c=!!(32&u.__u),r=[f=t.__e=u.__e]),(s=l.__b)&&s(t);n:if("function"==typeof I)try{if(w=t.props,C=(s=I.contextType)&&i[s.__c],x=s?C?C.props.value:s.__:i,u.__c?g=(h=t.__c=u.__c).__=h.__E:("prototype"in I&&I.prototype.render?t.__c=h=new I(w,x):(t.__c=h=new k(w,x),h.constructor=I,h.render=N),C&&C.sub(h),h.props=w,h.state||(h.state={}),h.context=x,h.__n=i,v=h.__d=!0,h.__h=[],h._sb=[]),null==h.__s&&(h.__s=h.state),null!=I.getDerivedStateFromProps&&(h.__s==h.state&&(h.__s=d({},h.__s)),d(h.__s,I.getDerivedStateFromProps(w,h.__s))),p=h.props,_=h.state,h.__v=t,v)null==I.getDerivedStateFromProps&&null!=h.componentWillMount&&h.componentWillMount(),null!=h.componentDidMount&&h.__h.push(h.componentDidMount);else{if(null==I.getDerivedStateFromProps&&w!==p&&null!=h.componentWillReceiveProps&&h.componentWillReceiveProps(w,x),!h.__e&&(null!=h.shouldComponentUpdate&&!1===h.shouldComponentUpdate(w,h.__s,x)||t.__v===u.__v)){for(t.__v!==u.__v&&(h.props=w,h.state=h.__s,h.__d=!1),t.__e=u.__e,t.__k=u.__k,t.__k.forEach(function(n){n&&(n.__=t)}),P=0;P<h._sb.length;P++)h.__h.push(h._sb[P]);h._sb=[],h.__h.length&&e.push(h);break n}null!=h.componentWillUpdate&&h.componentWillUpdate(w,h.__s,x),null!=h.componentDidUpdate&&h.__h.push(function(){h.componentDidUpdate(p,_,m)})}if(h.context=x,h.props=w,h.__P=n,h.__e=!1,$=l.__r,A=0,"prototype"in I&&I.prototype.render){for(h.state=h.__s,h.__d=!1,$&&$(t),s=h.render(h.props,h.state,h.context),E=0;E<h._sb.length;E++)h.__h.push(h._sb[E]);h._sb=[]}else do{h.__d=!1,$&&$(t),s=h.render(h.props,h.state,h.context),h.state=h.__s}while(h.__d&&++A<25);h.state=h.__s,null!=h.getChildContext&&(i=d(d({},i),h.getChildContext())),v||null==h.getSnapshotBeforeUpdate||(m=h.getSnapshotBeforeUpdate(p,_)),S(n,y(H=null!=s&&s.type===b&&null==s.key?s.props.children:s)?H:[H],t,u,i,o,r,e,f,c,a),h.base=t.__e,t.__u&=-161,h.__h.length&&e.push(h),g&&(h.__E=h.__=null)}catch(n){t.__v=null,c||null!=r?(t.__e=f,t.__u|=c?160:32,r[r.indexOf(f)]=null):(t.__e=u.__e,t.__k=u.__k),l.__e(n,t,u)}else null==r&&t.__v===u.__v?(t.__k=u.__k,t.__e=u.__e):t.__e=j(u.__e,t,u,i,o,r,e,c,a);(s=l.diffed)&&s(t)}function M(n,t,u){t.__d=void 0;for(var i=0;i<u.length;i++)z(u[i],u[++i],u[++i]);l.__c&&l.__c(t,n),n.some(function(t){try{n=t.__h,t.__h=[],n.some(function(n){n.call(t)})}catch(n){l.__e(n,t.__v)}})}function j(l,t,u,i,o,r,e,f,c){var a,s,v,p,d,m,g,b=u.props,k=t.props,C=t.type;if("svg"===C&&(o=!0),null!=r)for(a=0;a<r.length;a++)if((d=r[a])&&"setAttribute"in d==!!C&&(C?d.localName===C:3===d.nodeType)){l=d,r[a]=null;break}if(null==l){if(null===C)return document.createTextNode(k);l=o?document.createElementNS("http://www.w3.org/2000/svg",C):document.createElement(C,k.is&&k),r=null,f=!1}if(null===C)b===k||f&&l.data===k||(l.data=k);else{if(r=r&&n.call(l.childNodes),b=u.props||h,!f&&null!=r)for(b={},a=0;a<l.attributes.length;a++)b[(d=l.attributes[a]).name]=d.value;for(a in b)d=b[a],"children"==a||("dangerouslySetInnerHTML"==a?v=d:"key"===a||a in k||I(l,a,null,d,o));for(a in k)d=k[a],"children"==a?p=d:"dangerouslySetInnerHTML"==a?s=d:"value"==a?m=d:"checked"==a?g=d:"key"===a||f&&"function"!=typeof d||b[a]===d||I(l,a,d,b[a],o);if(s)f||v&&(s.__html===v.__html||s.__html===l.innerHTML)||(l.innerHTML=s.__html),t.__k=[];else if(v&&(l.innerHTML=""),S(l,y(p)?p:[p],t,u,i,o&&"foreignObject"!==C,r,e,r?r[0]:u.__k&&w(u,0),f,c),null!=r)for(a=r.length;a--;)null!=r[a]&&_(r[a]);f||(a="value",void 0!==m&&(m!==l[a]||"progress"===C&&!m||"option"===C&&m!==b[a])&&I(l,a,m,b[a],!1),a="checked",void 0!==g&&g!==l[a]&&I(l,a,g,b[a],!1))}return l}function z(n,t,u){try{"function"==typeof n?n(t):n.current=t}catch(n){l.__e(n,u)}}function F(n,t,u){var i,o;if(l.unmount&&l.unmount(n),(i=n.ref)&&(i.current&&i.current!==n.__e||z(i,null,t)),null!=(i=n.__c)){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(n){l.__e(n,t)}i.base=i.__P=null,n.__c=void 0}if(i=n.__k)for(o=0;o<i.length;o++)i[o]&&F(i[o],t,u||"function"!=typeof n.type);u||null==n.__e||_(n.__e),n.__=n.__e=n.__d=void 0}function N(n,l,t){return this.constructor(n,t)}function O(t,u,i){var o,r,e,f;l.__&&l.__(t,u),r=(o="function"==typeof i)?null:i&&i.__k||u.__k,e=[],f=[],L(u,t=(!o&&i||u).__k=m(b,null,[t]),r||h,h,void 0!==u.ownerSVGElement,!o&&i?[i]:r?null:u.firstChild?n.call(u.childNodes):null,e,!o&&i?i:r?r.__e:u.firstChild,o,f),M(e,t,f)}n=v.slice,l={__e:function(n,l,t,u){for(var i,o,r;l=l.__;)if((i=l.__c)&&!i.__)try{if((o=i.constructor)&&null!=o.getDerivedStateFromError&&(i.setState(o.getDerivedStateFromError(n)),r=i.__d),null!=i.componentDidCatch&&(i.componentDidCatch(n,u||{}),r=i.__d),r)return i.__E=i}catch(l){n=l}throw n}},t=0,u=function(n){return null!=n&&null==n.constructor},k.prototype.setState=function(n,l){var t;t=null!=this.__s&&this.__s!==this.state?this.__s:this.__s=d({},this.state),"function"==typeof n&&(n=n(d({},t),this.props)),n&&d(t,n),null!=n&&this.__v&&(l&&this._sb.push(l),x(this))},k.prototype.forceUpdate=function(n){this.__v&&(this.__e=!0,n&&this.__h.push(n),x(this))},k.prototype.render=b,i=[],r="function"==typeof Promise?Promise.prototype.then.bind(Promise.resolve()):setTimeout,e=function(n,l){return n.__v.__b-l.__v.__b},P.__r=0,f=0,c={__proto__:null,render:O,hydrate:function n(l,t){O(l,t,n)},createElement:m,h:m,Fragment:b,createRef:function(){return{current:null}},isValidElement:u,Component:k,cloneElement:function(l,t,u){var i,o,r,e,f=d({},l.props);for(r in l.type&&l.type.defaultProps&&(e=l.type.defaultProps),t)"key"==r?i=t[r]:"ref"==r?o=t[r]:f[r]=void 0===t[r]&&void 0!==e?e[r]:t[r];return arguments.length>2&&(f.children=arguments.length>3?n.call(arguments,2):u),g(l.type,f,i||l.key,o||l.ref,null)},createContext:function(n,l){var t={__c:l="__cC"+f++,__:n,Consumer:function(n,l){return n.children(l)},Provider:function(n){var t,u;return this.getChildContext||(t=[],(u={})[l]=this,this.getChildContext=function(){return u},this.shouldComponentUpdate=function(n){this.props.value!==n.value&&t.some(function(n){n.__e=!0,x(n)})},this.sub=function(n){t.push(n);var l=n.componentWillUnmount;n.componentWillUnmount=function(){t.splice(t.indexOf(n),1),l&&l.call(n)}}),n.children}};return t.Provider.__=t.Consumer.contextType=t},toChildArray:function n(l,t){return t=t||[],null==l||"boolean"==typeof l||(y(l)?l.some(function(l){n(l,t)}):t.push(l)),t},options:l},typeof module<"u"?module.exports=c:self.preact=c}();

```

### .pio\libdeps\esp32\UDCP\library.properties
```
name=UDCPversion=1.0.0author=YourNamemaintainer=YourName <you@example.com>sentence=Universal Device Communication Protocol for ESP32paragraph=Multi-protocol server (HTTP/WebSocket/UDP) with HMAC-SHA256 authentication running as WiFi Access Point.category=Communicationurl=https://github.com/yourname/UDCParchitectures=esp32depends=ArduinoJson,WebSockets
```

### .pio\libdeps\esp32\UDCP\README.md
```
# UDCP — Universal Device Communication Protocol> Multi-protocol server library for ESP32.  > Runs as a WiFi Access Point with HTTP, WebSocket, and UDP servers simultaneously.  > Built-in HMAC-SHA256 authentication, event system, and full runtime control.---## Table of Contents- [Requirements](#requirements)- [Installation](#installation)- [Quick Start](#quick-start)- [Configuration](#configuration)- [API Reference](#api-reference)  - [Core](#core)  - [HTTP Server](#http-server)  - [Messaging](#messaging)  - [Callbacks & Events](#callbacks--events)  - [Getters](#getters)- [Packet Format](#packet-format)- [Built-in HTTP Endpoints](#built-in-http-endpoints)- [Event Types](#event-types)- [Examples](#examples)---## Requirements| Dependency | Version ||---|---|| ESP32 Arduino Core | >= 2.0.0 || ArduinoJson | >= 6.0.0 || WebSockets (Links2004) | >= 2.3.0 |---## Installation**Option A — ZIP**1. Download repository as ZIP2. Arduino IDE → Sketch → Include Library → Add .ZIP Library**Option B — Manual**```Documents/Arduino/libraries/UDCP/├── src/│   ├── UDCP.h│   ├── UDCP.cpp│   ├── UDCPConfig.h│   └── UDCPEvents.h├── examples/├── library.properties└── README.md```---## Quick Start```cpp#include <UDCP.h>UDCP udcp;void setup() {    Serial.begin(115200);    UDCPConfig cfg;    cfg.apSSID    = "MyDevice";    cfg.apPassword = "12345678";    cfg.authToken = "my-token";    cfg.deviceId  = "device-01";    udcp.onPacket([](const UDCPPacket& pkt) {        Serial.println(pkt.action);    });    udcp.begin(cfg);}void loop() {    udcp.loop();}```Connect to WiFi `MyDevice` → send commands to `192.168.4.1:3000`---## ConfigurationAll fields are optional. Defaults shown below.```cppUDCPConfig cfg;cfg.apSSID      = "UDCP-Device";  // AP network namecfg.apPassword  = "";             // empty string = open networkcfg.apChannel   = 1;              // WiFi channel (1–13)cfg.apMaxConn   = 4;              // max simultaneous clients (1–8)cfg.apIP[4]     = {192,168,4,1};  // static IP for ESP32cfg.httpEnabled = true;           // enable HTTP server on bootcfg.httpPort    = 3000;           // HTTP listening portcfg.wsEnabled   = true;           // enable WS server on bootcfg.wsPort      = 8080;           // WebSocket listening portcfg.udpEnabled  = true;           // enable UDP socket on bootcfg.udpPort     = 9000;           // UDP listening portcfg.authToken   = "";             // bearer token, empty = disabledcfg.authSecret  = "";             // HMAC-SHA256 key, empty = disabledcfg.deviceId    = "udcp-device-01";```### Authentication Behavior| `authToken` | `authSecret` | Behavior ||---|---|---|| empty | empty | No authentication || set | empty | Token check only || set | set | Token + HMAC-SHA256 |---## API Reference### Core#### `begin(config)`Initializes the AP and all enabled servers.```cppudcp.begin(cfg);```#### `loop()`Must be called inside Arduino `loop()`. Handles all incoming connections and packets.```cppvoid loop() {    udcp.loop();}```#### `stop()`Stops all servers and disconnects the AP.```cppudcp.stop();```#### `enableHTTP(bool)`Start or stop the HTTP server at runtime.```cppudcp.enableHTTP(true);   // startudcp.enableHTTP(false);  // stop```#### `enableWS(bool)`Start or stop the WebSocket server at runtime.```cppudcp.enableWS(true);udcp.enableWS(false);```#### `enableUDP(bool)`Start or stop the UDP socket at runtime.```cppudcp.enableUDP(true);udcp.enableUDP(false);```---### HTTP Server#### `route(path, method, handler)`Register a custom HTTP endpoint. CORS headers are applied automatically.| Parameter | Type | Description ||---|---|---|| `path` | `String` | URL path (e.g. `"/sensor"`) || `method` | `HTTPMethod` | `HTTP_GET` `HTTP_POST` `HTTP_PUT` `HTTP_DELETE` `HTTP_PATCH` || `handler` | `HTTPHandler` | Lambda or function |```cppudcp.route("/sensor", HTTP_GET, []() {    udcp.httpSend(200, "application/json", "{\"temp\":23.5}");});udcp.route("/config", HTTP_POST, []() {    String body = udcp.httpArg("plain");    udcp.httpSend(200, "application/json", "{\"status\":\"ok\"}");});```> **Note:** Call `route()` after `begin()`.#### `routeNotFound(handler)`Custom 404 handler.```cppudcp.routeNotFound([]() {    udcp.httpSend(404, "application/json", "{\"error\":\"not_found\"}");});```#### `httpSend(code, contentType, body)`Send HTTP response from inside a route handler.```cppudcp.httpSend(200, "application/json", "{\"ok\":true}");udcp.httpSend(400, "text/plain", "Bad Request");```#### `httpSendHeader(name, value)`Add a custom response header.```cppudcp.httpSendHeader("X-Device-ID", "node-01");```#### `httpHasArg(name)`Check if a request argument exists.```cppif (udcp.httpHasArg("plain")) { }   // JSON bodyif (udcp.httpHasArg("name"))  { }   // query or form field```#### `httpArg(name)`Read a request argument value.```cppString body  = udcp.httpArg("plain");   // raw bodyString field = udcp.httpArg("name");    // form field```#### `httpMethod()`Returns the HTTP method of the current request as string.```cppString m = udcp.httpMethod(); // "GET" | "POST" | "PUT" | ...```---### Messaging#### `send(message, protocol)`Send a message over a specific protocol.  For UDP, sends to the last received sender.```cppudcp.send("{\"type\":\"ack\"}", UDCPProtocol::WS);udcp.send("{\"type\":\"ack\"}", UDCPProtocol::UDP);```#### `sendTo(message, wsClientId)`Send a message to a specific WebSocket client by ID.```cppudcp.sendTo("{\"type\":\"welcome\"}", clientId);```#### `broadcast(message)`Send to all connected WebSocket clients and last UDP sender.```cppudcp.broadcast("{\"type\":\"alert\",\"msg\":\"hello\"}");```#### `broadcastExcept(message, excludeId)`Broadcast to all WebSocket clients except one.```cppudcp.broadcastExcept(payload, senderClientId);```#### `sendUDPTo(message, ip, port)`Send a UDP datagram to a specific address.```cppudcp.sendUDPTo("{\"type\":\"ping\"}", IPAddress(192,168,4,10), 9000);```---### Callbacks & Events#### `onPacket(callback)`Fires when a valid, authenticated UDCP packet is received from any protocol.```cppudcp.onPacket([](const UDCPPacket& pkt) {    Serial.println(pkt.name);    Serial.println(pkt.action);    Serial.println(pkt.protocol);   // "HTTP" | "WS" | "UDP"    float value = pkt.value["data"] | 0.0;});```**UDCPPacket fields:**| Field | Type | Description ||---|---|---|| `v` | `int` | Protocol version || `msgId` | `String` | Unique message ID || `ts` | `unsigned long` | Client timestamp || `type` | `String` | Packet type || `name` | `String` | Command/event name || `seq` | `int` | Sequence number || `streamId` | `String` | Stream identifier || `qos` | `int` | Quality of service level || `action` | `String` | Action field from value || `protocol` | `String` | Received via: HTTP / WS / UDP || `value` | `JsonObject` | Full value payload || `authId` | `String` | Sender auth ID || `nonce` | `String` | Request nonce || `authTs` | `unsigned long` | Auth timestamp || `authExp` | `unsigned long` | Auth expiry |#### `onClientConnect(callback)`Fires when a WebSocket client connects.```cppudcp.onClientConnect([](const UDCPClientInfo& info) {    Serial.printf("Client #%d connected: %s\n",                  info.id, info.ip.c_str());    udcp.sendTo("{\"type\":\"welcome\"}", info.id);});```#### `onClientDisconnect(callback)`Fires when a WebSocket client disconnects.```cppudcp.onClientDisconnect([](const UDCPClientInfo& info) {    Serial.printf("Client #%d left\n", info.id);});```**UDCPClientInfo fields:**| Field | Type | Description ||---|---|---|| `id` | `uint8_t` | WebSocket client ID || `ip` | `String` | Client IP address || `protocol` | `UDCPProtocol` | Always `UDCPProtocol::WS` |#### `onEvent(callback)`Fires on all internal library events.```cppudcp.onEvent([](UDCPEventType type, const String& detail) {    switch (type) {        case UDCPEventType::SERVER_STARTED:    break;        case UDCPEventType::SERVER_STOPPED:    break;        case UDCPEventType::CLIENT_CONNECTED:  break;        case UDCPEventType::CLIENT_DISCONNECTED: break;        case UDCPEventType::PACKET_RECEIVED:   break;        case UDCPEventType::AUTH_FAILED:       break;        case UDCPEventType::HMAC_FAILED:       break;        case UDCPEventType::ERROR:             break;    }});```#### `onRaw(callback)`Fires with the raw unparsed string before any processing.  Useful for logging, debugging, or custom parsers.```cppudcp.onRaw([](const String& raw, UDCPProtocol proto) {    Serial.printf("[RAW][%d] %s\n", (int)proto, raw.c_str());});```---### Getters```cppudcp.getIP();                // String  — AP IP addressudcp.getClientCount();       // int     — connected WiFi stationsudcp.getFreeHeap();          // uint32_t — free heap bytesudcp.getUptime();            // unsigned long — seconds since bootudcp.getDeviceId();          // String  — configured device IDudcp.buildStatusJSON();      // String  — full status as JSONudcp.isHTTPRunning();        // booludcp.isWSRunning();          // booludcp.isUDPRunning();         // booludcp.getLastUDPSenderIP();   // IPAddress — last UDP senderudcp.getLastUDPSenderPort(); // uint16_t  — last UDP sender port```---## Packet Format```json{  "v": 1,  "msgId": "msg-001",  "ts": 1715000000,  "type": "command",  "name": "sensor_read",  "seq": 1,  "streamId": "main",  "qos": 1,  "route": ["node-a", "node-b"],  "auth": {    "id": "client-01",    "token": "my-token",    "nonce": "rand-nonce-xyz",    "ts": 1715000000,    "exp": 1715003600,    "scope": "device:write",    "sig": "hmac-sha256-hex-string"  },  "value": {    "action": "read",    "pin": 34,    "threshold": 2.5  }}```### QoS Levels| Level | Behavior ||---|---|| `0` | Fire and forget — no acknowledgment || `1` | ACK returned to sender over same protocol |### HMAC Canonical StringSignature is computed over a canonical string built as:```v|msgId|ts|type|name|seq|streamId|qos|route(sorted,asc)|authId|nonce|authTs|authExp```---## Built-in HTTP Endpoints| Method | Path | Description ||---|---|---|| `POST` | `/message` | Receive UDCP packet || `GET` | `/status` | Device status JSON || `POST` | `/udcp/ws/enable` | Enable WebSocket server || `POST` | `/udcp/ws/disable` | Disable WebSocket server || `POST` | `/udcp/udp/enable` | Enable UDP socket || `POST` | `/udcp/udp/disable` | Disable UDP socket |All endpoints include CORS headers automatically.---## Event Types| Event | Trigger ||---|---|| `SERVER_STARTED` | A server or socket came online || `SERVER_STOPPED` | A server or socket went offline || `CLIENT_CONNECTED` | WebSocket client connected || `CLIENT_DISCONNECTED` | WebSocket client disconnected || `PACKET_RECEIVED` | Valid packet dispatched || `PACKET_REJECTED` | Packet dropped before dispatch || `AUTH_FAILED` | Token verification failed || `HMAC_FAILED` | Signature verification failed || `ERROR` | Internal error (JSON parse, etc.) |---## LicenseMIT
```

