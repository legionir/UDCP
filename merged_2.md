### src\Debug\Disassembler.h
```
#ifndef ESPDSL_DISASSEMBLER_H
#define ESPDSL_DISASSEMBLER_H
#include "../Core/Core.h"
#include <iostream>
#include <iomanip>
class Disassembler
{
    const uint8_t *code;
    size_t len;
    const VMValue *consts;
    size_t constCnt;
public:
    Disassembler(const uint8_t *c, size_t l, const VMValue *co, size_t cc) : code(c), len(l), consts(co), constCnt(cc) {}
    void print() const
    {
        std::cout << "=== Disassembly (" << len << " bytes) ===\n";
        size_t i = 0;
        while (i < len)
        {
            std::cout << std::setw(5) << i << ": ";
            uint8_t op = code[i++];
            switch (op)
            {
            case OP_NOP:
                std::cout << "NOP";
                break;
            case OP_PUSH_CONST:
            {
                uint16_t id = code[i] | (code[i + 1] << 8);
                i += 2;
                std::cout << "PUSH #" << id;
                if (id < constCnt)
                    std::cout << " (" << consts[id].toString() << ")";
                break;
            }
            case OP_STORE:
                std::cout << "STORE g" << (int)code[i++];
                break;
            case OP_LOAD:
                std::cout << "LOAD g" << (int)code[i++];
                break;
            case OP_STORE_LOCAL:
                std::cout << "STL l" << (int)code[i++];
                break;
            case OP_LOAD_LOCAL:
                std::cout << "LDL l" << (int)code[i++];
                break;
            case OP_ADD:
                std::cout << "ADD";
                break;
            case OP_SUB:
                std::cout << "SUB";
                break;
            case OP_MUL:
                std::cout << "MUL";
                break;
            case OP_DIV:
                std::cout << "DIV";
                break;
            case OP_MOD:
                std::cout << "MOD";
                break;
            case OP_CMP_EQ:
                std::cout << "EQ";
                break;
            case OP_CMP_NE:
                std::cout << "NE";
                break;
            case OP_CMP_LT:
                std::cout << "LT";
                break;
            case OP_CMP_GT:
                std::cout << "GT";
                break;
            case OP_CMP_LTE:
                std::cout << "LTE";
                break;
            case OP_CMP_GTE:
                std::cout << "GTE";
                break;
            case OP_AND:
                std::cout << "AND";
                break;
            case OP_OR:
                std::cout << "OR";
                break;
            case OP_NOT:
                std::cout << "NOT";
                break;
            case OP_JMP:
            {
                uint16_t t = code[i] | (code[i + 1] << 8);
                i += 2;
                std::cout << "JMP->" << t;
                break;
            }
            case OP_JZ:
            {
                uint16_t t = code[i] | (code[i + 1] << 8);
                i += 2;
                std::cout << "JZ->" << t;
                break;
            }
            case OP_JNZ:
            {
                uint16_t t = code[i] | (code[i + 1] << 8);
                i += 2;
                std::cout << "JNZ->" << t;
                break;
            }
            case OP_POP:
                std::cout << "POP";
                break;
            case OP_DUP:
                std::cout << "DUP";
                break;
            case OP_CALL:
            {
                int m = code[i++], f = code[i++], a = code[i++];
                std::cout << "CALL m" << m << " f" << f << " a" << a;
                break;
            }
            case OP_CALL_VOID:
            {
                int m = code[i++], f = code[i++], a = code[i++];
                std::cout << "CALLV m" << m << " f" << f << " a" << a;
                break;
            }
            case OP_FUNC_CALL:
            {
                uint16_t t = code[i] | (code[i + 1] << 8);
                i += 2;
                int a = code[i++];
                std::cout << "FCALL->" << t << " a" << a;
                break;
            }
            case OP_RETURN:
                std::cout << "RET";
                break;
            case OP_RETURN_NONE:
                std::cout << "RETN";
                break;
            case OP_MAKE_ARRAY:
                std::cout << "MKARR " << (int)code[i++];
                break;
            case OP_INDEX_GET:
                std::cout << "IGET";
                break;
            case OP_INDEX_SET:
                std::cout << "ISET";
                break;
            case OP_LENGTH:
                std::cout << "LEN";
                break;
            case OP_ARRAY_PUSH:
                std::cout << "APUSH";
                break;
            case OP_STR_CONCAT:
                std::cout << "CONCAT";
                break;
            case OP_CAST_INT:
                std::cout << "CINT";
                break;
            case OP_CAST_FLOAT:
                std::cout << "CFLT";
                break;
            case OP_CAST_STR:
                std::cout << "CSTR";
                break;
            case OP_WAIT:
            {
                uint16_t t = code[i] | (code[i + 1] << 8);
                i += 2;
                std::cout << "WAIT " << t << "ms";
                break;
            }
            case OP_WAIT_DYN:
                std::cout << "WAITD";
                break;
            case OP_YIELD:
                std::cout << "YIELD";
                break;
            case OP_HALT:
                std::cout << "HALT";
                break;
            default:
                std::cout << "? 0x" << std::hex << (int)op << std::dec;
                break;
            }
            std::cout << "\n";
        }
    }
};
#endif
```

### src\Debug\Profiler.h
```
#ifndef ESPDSL_PROFILER_H
#define ESPDSL_PROFILER_H
#include "../Core/Core.h"
#include "../Runtime/RuntimeIds.h"
#include <iostream>
#include <iomanip>
#include <cstring>
struct ProfileFunction
{
    bool used = false;
    uint16_t entry = 0;
    char name[NAME_LEN] = {0};
    uint32_t callCount = 0;
    uint32_t totalInstructions = 0;
    uint32_t selfInstructions = 0;
};
struct ProfileStackEntry
{
    uint8_t funcIndex = 0xFF;
    uint32_t startInstr = 0;
};
class Profiler
{
    bool active_ = false;
    uint32_t opcodeCount[256] = {0};
    ProfileFunction funcs[MAX_PROFILE_FUNCS];
    ProfileStackEntry pstack[32];
    uint8_t pstackDepth = 0;
public:
    void reset()
    {
        active_ = false;
        memset(opcodeCount, 0, sizeof(opcodeCount));
        for (auto &f : funcs)
            f = ProfileFunction{};
        pstackDepth = 0;
    }
    void start() { active_ = true; }
    void stop() { active_ = false; }
    bool active() const { return active_; }
    bool registerFunction(uint16_t entry, const char *name)
    {
        for (auto &f : funcs)
            if (!f.used)
            {
                f.used = true;
                f.entry = entry;
                rtCopyName(f.name, name);
                return true;
            }
        return false;
    }
    int findFunc(uint16_t entry) const
    {
        for (uint8_t i = 0; i < MAX_PROFILE_FUNCS; i++)
            if (funcs[i].used && funcs[i].entry == entry)
                return i;
        return -1;
    }
    void onOpcode(uint8_t op)
    {
        if (!active_)
            return;
        opcodeCount[op]++;
        if (pstackDepth > 0)
        {
            auto idx = pstack[pstackDepth - 1].funcIndex;
            if (idx != 0xFF && idx < MAX_PROFILE_FUNCS)
            {
                funcs[idx].totalInstructions++;
                funcs[idx].selfInstructions++;
            }
        }
    }
    void onFuncEnter(uint16_t entry, uint32_t totalInstr)
    {
        if (!active_)
            return;
        int idx = findFunc(entry);
        if (idx < 0)
            return;
        funcs[idx].callCount++;
        if (pstackDepth < 32)
        {
            pstack[pstackDepth].funcIndex = (uint8_t)idx;
            pstack[pstackDepth].startInstr = totalInstr;
            pstackDepth++;
        }
    }
    void onFuncExit(uint32_t totalInstr)
    {
        if (!active_ || pstackDepth == 0)
            return;
        pstackDepth--;
    }
    void printReport() const
    {
        std::cout << "=== Profiler ===\nFunctions:\n";
        for (const auto &f : funcs)
        {
            if (!f.used)
                continue;
            std::cout << "  " << f.name << " calls=" << f.callCount << " total=" << f.totalInstructions << " self=" << f.selfInstructions << "\n";
        }
        std::cout << "Hot opcodes:\n";
        for (int i = 0; i < 256; i++)
            if (opcodeCount[i] > 0)
                std::cout << "  0x" << std::hex << i << std::dec << " = " << opcodeCount[i] << "\n";
    }
};
extern Profiler g_profiler;
#endif
```

### src\Debug\Profiler.cpp
```
#include "Profiler.h"Profiler g_profiler;
```

### src\Lang\Compiler.h
```
#ifndef ESPDSL_COMPILER_H
#define ESPDSL_COMPILER_H
#include "../Core/Core.h"
#include "Parser.h"
#include <vector>
#include <string>
#include <map>
#include <unordered_map>
struct CompilerScope
{
    std::unordered_map<std::string, uint8_t> locals;
    uint8_t nextLocal = 0;
    bool isFunction = false;
};
struct LoopContext
{
    std::vector<size_t> breakPatches;
    std::vector<size_t> continuePatches;
    uint16_t continueTarget;
};
class Compiler
{
    std::vector<uint8_t> bytecode;
    std::vector<VMValue> constants;
    std::shared_ptr<StringArena> arena;
    std::map<std::string, uint8_t> globalSymbols;
    uint8_t nextGlobalId = 0;
    std::vector<CompilerScope> scopes;
    std::vector<LoopContext> loopStack;
    std::vector<TaskEntry> taskEntries;
    std::vector<FuncEntry> funcEntries;
    std::vector<ExportSymbol> exportSymbols;
    std::vector<ImportRequest> importRequests;
    std::map<std::string, uint16_t> funcAddresses;
    std::map<std::string, bool> declaredVars;
    std::vector<std::string> importedModules;
    uint16_t addConstant(VMValue val);
    uint8_t getVarId(const std::string &name, bool isStore);
    bool isLocalScope() const;
    int findLocal(const std::string &name) const;
    void emit(uint8_t b);
    void emitU16(uint16_t v);
    size_t emitJumpPlaceholder(uint8_t op);
    void patchJump(size_t pos, uint16_t target);
    size_t currentPos() const;
    void pushScope(bool isFunc = false);
    void popScope();
    void emitStore(const std::string &name);
    void emitLoad(const std::string &name);
    void compileNode(ASTNode *node);
    void compileBlock(ASTNode *block);
    void compileCall(ASTNode *node, bool isVoid);
    bool tryConstantFold(ASTNode *node, VMValue &result);
    void collectFunctions(ASTNode *root);
public:
    Compiler() : arena(std::make_shared<StringArena>()) {}
    ProgramBinary compile(ASTNode *root);
    void printBytecode() const;
    void printConstants() const;
};
int findModuleId(const std::string &name);
int findFuncId(int modId, const std::string &funcName);
#endif
```

### src\Lang\Compiler.cpp
```
#include "Compiler.h"
#include <iostream>
#include <cctype>
uint16_t Compiler::addConstant(VMValue val)
{
    for (size_t i = 0; i < constants.size(); i++)
    {
        if (constants[i].type != val.type)
            continue;
        switch (val.type)
        {
        case ValueType::INT:
            if (constants[i].data.i == val.data.i)
                return (uint16_t)i;
            break;
        case ValueType::FLOAT:
            if (floatEqual(constants[i].data.f, val.data.f))
                return (uint16_t)i;
            break;
        case ValueType::BOOL:
            if (constants[i].data.b == val.data.b)
                return (uint16_t)i;
            break;
        case ValueType::STRING:
            if (val.data.s && constants[i].data.s && strcmp(constants[i].data.s, val.data.s) == 0)
                return (uint16_t)i;
            break;
        default:
            break;
        }
    }
    if (constants.size() >= 65535)
        throw std::runtime_error("Constant pool overflow");
    constants.push_back(val);
    return (uint16_t)(constants.size() - 1);
}
void Compiler::pushScope(bool f)
{
    scopes.push_back({});
    scopes.back().isFunction = f;
}
void Compiler::popScope()
{
    if (!scopes.empty())
        scopes.pop_back();
}
bool Compiler::isLocalScope() const { return !scopes.empty(); }
int Compiler::findLocal(const std::string &name) const
{
    for (int i = (int)scopes.size() - 1; i >= 0; i--)
    {
        auto it = scopes[i].locals.find(name);
        if (it != scopes[i].locals.end())
            return it->second;
        if (scopes[i].isFunction)
            return -1;
    }
    return -1;
}
uint8_t Compiler::getVarId(const std::string &name, bool isStore)
{
    int l = findLocal(name);
    if (l >= 0)
        return (uint8_t)l;
    if (isStore && isLocalScope())
    {
        auto &s = scopes.back();
        if (s.nextLocal >= 32)
            throw std::runtime_error("Too many locals");
        s.locals[name] = s.nextLocal;
        return s.nextLocal++;
    }
    auto it = globalSymbols.find(name);
    if (it != globalSymbols.end())
        return it->second;
    if (nextGlobalId >= 128)
        throw std::runtime_error("Global overflow");
    globalSymbols[name] = nextGlobalId;
    return nextGlobalId++;
}
void Compiler::emit(uint8_t b) { bytecode.push_back(b); }
void Compiler::emitU16(uint16_t v)
{
    bytecode.push_back(v & 0xFF);
    bytecode.push_back((v >> 8) & 0xFF);
}
size_t Compiler::emitJumpPlaceholder(uint8_t op)
{
    emit(op);
    size_t p = bytecode.size();
    emitU16(0);
    return p;
}
void Compiler::patchJump(size_t p, uint16_t t)
{
    bytecode[p] = t & 0xFF;
    bytecode[p + 1] = (t >> 8) & 0xFF;
}
size_t Compiler::currentPos() const { return bytecode.size(); }
void Compiler::compileBlock(ASTNode *b)
{
    if (!b)
        return;
    for (auto &c : b->children)
        compileNode(c.get());
}
void Compiler::emitStore(const std::string &name)
{
    int l = findLocal(name);
    if (isLocalScope() && l < 0)
    {
        uint8_t id = getVarId(name, true);
        emit(OP_STORE_LOCAL);
        emit(id);
    }
    else if (l >= 0)
    {
        emit(OP_STORE_LOCAL);
        emit((uint8_t)l);
    }
    else
    {
        emit(OP_STORE);
        emit(getVarId(name, false));
    }
}
void Compiler::emitLoad(const std::string &name)
{
    int l = findLocal(name);
    if (l >= 0)
    {
        emit(OP_LOAD_LOCAL);
        emit((uint8_t)l);
    }
    else
    {
        emit(OP_LOAD);
        emit(getVarId(name, false));
    }
}
bool Compiler::tryConstantFold(ASTNode *node, VMValue &result)
{
    if (!node)
        return false;
    if (node->type == ASTNodeType::LITERAL)
    {
        const auto &v = node->value;
        if (v == "TRUE")
        {
            result = VMValue::Bool(true);
            return true;
        }
        if (v == "FALSE")
        {
            result = VMValue::Bool(false);
            return true;
        }
        if (v.size() >= 2 && v[0] == '"')
            return false;
        if (v.find('.') != std::string::npos)
        {
            result = VMValue::Float(std::stof(v));
            return true;
        }
        result = VMValue::Int(std::stoi(v));
        return true;
    }
    if ((node->type == ASTNodeType::BINARY_OP || node->type == ASTNodeType::MODULO_OP) && node->children.size() == 2)
    {
        VMValue l, r;
        if (!tryConstantFold(node->children[0].get(), l) || !tryConstantFold(node->children[1].get(), r))
            return false;
        if (!l.isNumber() || !r.isNumber())
            return false;
        const auto &op = node->value;
        if (l.type == ValueType::INT && r.type == ValueType::INT)
        {
            if (op == "+")
            {
                result = VMValue::Int(l.data.i + r.data.i);
                return true;
            }
            if (op == "-")
            {
                result = VMValue::Int(l.data.i - r.data.i);
                return true;
            }
            if (op == "*")
            {
                result = VMValue::Int(l.data.i * r.data.i);
                return true;
            }
            if (op == "/" && r.data.i != 0)
            {
                result = VMValue::Int(l.data.i / r.data.i);
                return true;
            }
            if (op == "%" && r.data.i != 0)
            {
                result = VMValue::Int(l.data.i % r.data.i);
                return true;
            }
        }
    }
    return false;
}
void Compiler::compileCall(ASTNode *node, bool isVoid)
{
    const auto &modName = node->value;
    if (node->children.empty())
        throw std::runtime_error("CALL without method");
    const auto &methName = node->children[0]->value;
    int modId = findModuleId(modName);
    if (modId < 0)
        throw std::runtime_error("Unknown module '" + modName + "'");
    int funcId = findFuncId(modId, methName);
    if (funcId < 0)
        throw std::runtime_error("Unknown method '" + methName + "' in '" + modName + "'");
    uint8_t ac = 0;
    for (size_t i = 1; i < node->children.size(); i++)
    {
        compileNode(node->children[i].get());
        ac++;
    }
    if (ac > 8)
        throw std::runtime_error("Too many args");
    emit(isVoid ? OP_CALL_VOID : OP_CALL);
    emit((uint8_t)modId);
    emit((uint8_t)funcId);
    emit(ac);
}
void Compiler::collectFunctions(ASTNode *root)
{
    for (auto &c : root->children)
        if (c->type == ASTNodeType::FUNC_DEF)
            funcAddresses[c->value] = 0xFFFF;
}
void Compiler::compileNode(ASTNode *node)
{
    if (!node)
        return;
    if (node->type == ASTNodeType::BINARY_OP || node->type == ASTNodeType::LITERAL || node->type == ASTNodeType::MODULO_OP)
    {
        VMValue f;
        if (tryConstantFold(node, f))
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(f));
            return;
        }
    }
    switch (node->type)
    {
    case ASTNodeType::IMPORT_STMT:
        importedModules.push_back(node->value);
        break;
    case ASTNodeType::LITERAL:
    {
        const auto &v = node->value;
        if (v == "TRUE")
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Bool(true)));
        }
        else if (v == "FALSE")
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Bool(false)));
        }
        else if (v.size() >= 2 && v[0] == '"' && v.back() == '"')
        {
            std::string c = v.substr(1, v.size() - 2);
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Str(arena->intern(c))));
        }
        else if (v.find('.') != std::string::npos)
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Float(std::stof(v))));
        }
        else
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Int(std::stoi(v))));
        }
        break;
    }
    case ASTNodeType::VARIABLE:
        emitLoad(node->value);
        break;
    case ASTNodeType::ASSIGNMENT:
        if (node->children.empty())
            throw std::runtime_error("Assignment empty");
        compileNode(node->children[0].get());
        declaredVars[node->value] = true;
        emitStore(node->value);
        break;
    case ASTNodeType::VAR_DECL:
        declaredVars[node->value] = true;
        if (!node->children.empty())
            compileNode(node->children[0].get());
        else
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::None()));
        }
        emitStore(node->value);
        break;
    case ASTNodeType::BINARY_OP:
        compileNode(node->children[0].get());
        compileNode(node->children[1].get());
        {
            const auto &op = node->value;
            if (op == "+")
                emit(OP_ADD);
            else if (op == "-")
                emit(OP_SUB);
            else if (op == "*")
                emit(OP_MUL);
            else if (op == "/")
                emit(OP_DIV);
            else if (op == "==")
                emit(OP_CMP_EQ);
            else if (op == "!=")
                emit(OP_CMP_NE);
            else if (op == "<")
                emit(OP_CMP_LT);
            else if (op == ">")
                emit(OP_CMP_GT);
            else if (op == "<=")
                emit(OP_CMP_LTE);
            else if (op == ">=")
                emit(OP_CMP_GTE);
            else
                throw std::runtime_error("Unknown op '" + op + "'");
        }
        break;
    case ASTNodeType::MODULO_OP:
        compileNode(node->children[0].get());
        compileNode(node->children[1].get());
        emit(OP_MOD);
        break;
    case ASTNodeType::LOGICAL_AND:
        compileNode(node->children[0].get());
        emit(OP_DUP);
        {
            size_t j = emitJumpPlaceholder(OP_JZ);
            emit(OP_POP);
            compileNode(node->children[1].get());
            patchJump(j, (uint16_t)currentPos());
        }
        break;
    case ASTNodeType::LOGICAL_OR:
        compileNode(node->children[0].get());
        emit(OP_DUP);
        {
            size_t j = emitJumpPlaceholder(OP_JNZ);
            emit(OP_POP);
            compileNode(node->children[1].get());
            patchJump(j, (uint16_t)currentPos());
        }
        break;
    case ASTNodeType::LOGICAL_NOT:
        compileNode(node->children[0].get());
        emit(OP_NOT);
        break;
    case ASTNodeType::TERNARY_EXPR:
    {
        compileNode(node->children[0].get());
        size_t jF = emitJumpPlaceholder(OP_JZ);
        compileNode(node->children[1].get());
        size_t jE = emitJumpPlaceholder(OP_JMP);
        patchJump(jF, (uint16_t)currentPos());
        compileNode(node->children[2].get());
        patchJump(jE, (uint16_t)currentPos());
        break;
    }
    case ASTNodeType::CALL_STMT:
        compileCall(node, true);
        break;
    case ASTNodeType::CALL_EXPR:
        compileCall(node, false);
        break;
    case ASTNodeType::IF_STMT:
        compileNode(node->children[0].get());
        if (node->children.size() == 3)
        {
            size_t jE = emitJumpPlaceholder(OP_JZ);
            compileBlock(node->children[1].get());
            size_t jEnd = emitJumpPlaceholder(OP_JMP);
            patchJump(jE, (uint16_t)currentPos());
            compileBlock(node->children[2].get());
            patchJump(jEnd, (uint16_t)currentPos());
        }
        else
        {
            size_t jEnd = emitJumpPlaceholder(OP_JZ);
            compileBlock(node->children[1].get());
            patchJump(jEnd, (uint16_t)currentPos());
        }
        break;
    case ASTNodeType::LOOP_STMT:
    {
        pushScope();
        loopStack.push_back({});
        if (!node->value.empty())
        {
            int count = std::stoi(node->value);
            uint8_t cid = getVarId("__lc_" + std::to_string(currentPos()), true);
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Int(count)));
            emit(OP_STORE_LOCAL);
            emit(cid);
            uint16_t top = (uint16_t)currentPos();
            loopStack.back().continueTarget = top;
            emit(OP_LOAD_LOCAL);
            emit(cid);
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Int(0)));
            emit(OP_CMP_GT);
            size_t jOut = emitJumpPlaceholder(OP_JZ);
            for (auto &c : node->children)
                compileNode(c.get());
            emit(OP_LOAD_LOCAL);
            emit(cid);
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Int(1)));
            emit(OP_SUB);
            emit(OP_STORE_LOCAL);
            emit(cid);
            emit(OP_JMP);
            emitU16(top);
            patchJump(jOut, (uint16_t)currentPos());
        }
        else
        {
            uint16_t top = (uint16_t)currentPos();
            loopStack.back().continueTarget = top;
            for (auto &c : node->children)
                compileNode(c.get());
            emit(OP_JMP);
            emitU16(top);
        }
        for (size_t bp : loopStack.back().breakPatches)
            patchJump(bp, (uint16_t)currentPos());
        for (size_t cp : loopStack.back().continuePatches)
            patchJump(cp, loopStack.back().continueTarget);
        loopStack.pop_back();
        popScope();
        break;
    }
    case ASTNodeType::WHILE_STMT:
    {
        pushScope();
        loopStack.push_back({});
        uint16_t top = (uint16_t)currentPos();
        loopStack.back().continueTarget = top;
        compileNode(node->children[0].get());
        size_t jOut = emitJumpPlaceholder(OP_JZ);
        compileBlock(node->children[1].get());
        emit(OP_JMP);
        emitU16(top);
        uint16_t after = (uint16_t)currentPos();
        patchJump(jOut, after);
        for (size_t bp : loopStack.back().breakPatches)
            patchJump(bp, after);
        for (size_t cp : loopStack.back().continuePatches)
            patchJump(cp, top);
        loopStack.pop_back();
        popScope();
        break;
    }
    case ASTNodeType::FOR_STMT:
    {
        pushScope();
        loopStack.push_back({});
        const auto &varName = node->value;
        declaredVars[varName] = true;
        bool hasStep = (node->children.size() == 4);
        int bodyIdx = hasStep ? 3 : 2;
        compileNode(node->children[0].get());
        emitStore(varName);
        std::string endVar = "__for_end_" + std::to_string(currentPos());
        declaredVars[endVar] = true;
        compileNode(node->children[1].get());
        emitStore(endVar);
        std::string stepVar = "__for_step_" + std::to_string(currentPos());
        declaredVars[stepVar] = true;
        if (hasStep)
            compileNode(node->children[2].get());
        else
        {
            emit(OP_PUSH_CONST);
            emitU16(addConstant(VMValue::Int(1)));
        }
        emitStore(stepVar);
        uint16_t top = (uint16_t)currentPos();
        loopStack.back().continueTarget = top;
        emitLoad(varName);
        emitLoad(endVar);
        emit(OP_CMP_LTE);
        size_t jOut = emitJumpPlaceholder(OP_JZ);
        compileBlock(node->children[bodyIdx].get());
        emitLoad(varName);
        emitLoad(stepVar);
        emit(OP_ADD);
        emitStore(varName);
        emit(OP_JMP);
        emitU16(top);
        uint16_t after = (uint16_t)currentPos();
        patchJump(jOut, after);
        for (size_t bp : loopStack.back().breakPatches)
            patchJump(bp, after);
        for (size_t cp : loopStack.back().continuePatches)
            patchJump(cp, top);
        loopStack.pop_back();
        popScope();
        break;
    }
    case ASTNodeType::BREAK_STMT:
        if (loopStack.empty())
            throw std::runtime_error("BREAK outside loop");
        loopStack.back().breakPatches.push_back(emitJumpPlaceholder(OP_JMP));
        break;
    case ASTNodeType::CONTINUE_STMT:
        if (loopStack.empty())
            throw std::runtime_error("CONTINUE outside loop");
        loopStack.back().continuePatches.push_back(emitJumpPlaceholder(OP_JMP));
        break;
    case ASTNodeType::ARRAY_PUSH:
        compileNode(node->children[0].get());
        compileNode(node->children[1].get());
        emit(OP_ARRAY_PUSH);
        break;
    case ASTNodeType::CAST_EXPR:
        compileNode(node->children[0].get());
        if (node->value == "TOINT")
            emit(OP_CAST_INT);
        else if (node->value == "TOFLOAT")
            emit(OP_CAST_FLOAT);
        else if (node->value == "TOSTR")
            emit(OP_CAST_STR);
        break;
    case ASTNodeType::CONCAT_EXPR:
        compileNode(node->children[0].get());
        compileNode(node->children[1].get());
        emit(OP_STR_CONCAT);
        break;
    case ASTNodeType::WAIT_STMT:
    {
        VMValue folded;
        if (tryConstantFold(node->children[0].get(), folded) && folded.type == ValueType::INT)
        {
            emit(OP_WAIT);
            emitU16((uint16_t)folded.data.i);
        }
        else
        {
            compileNode(node->children[0].get());
            emit(OP_WAIT_DYN);
        }
        break;
    }
    case ASTNodeType::YIELD_STMT:
        emit(OP_YIELD);
        break;
    case ASTNodeType::PRINT_STMT:
        compileNode(node->children[0].get());
        {
            int m = findModuleId("serial");
            int f = (m >= 0) ? findFuncId(m, "print") : -1;
            if (m < 0 || f < 0)
                throw std::runtime_error("serial module not found");
            emit(OP_CALL_VOID);
            emit((uint8_t)m);
            emit((uint8_t)f);
            emit(1);
        }
        break;
    case ASTNodeType::ARRAY_LITERAL:
        for (auto &c : node->children)
            compileNode(c.get());
        emit(OP_MAKE_ARRAY);
        emit((uint8_t)node->children.size());
        break;
    case ASTNodeType::INDEX_ACCESS:
        emitLoad(node->value);
        compileNode(node->children[0].get());
        emit(OP_INDEX_GET);
        break;
    case ASTNodeType::INDEX_ASSIGN:
        emitLoad(node->value);
        compileNode(node->children[0].get());
        compileNode(node->children[1].get());
        emit(OP_INDEX_SET);
        break;
    case ASTNodeType::LEN_EXPR:
        compileNode(node->children[0].get());
        emit(OP_LENGTH);
        break;
    case ASTNodeType::FUNC_DEF:
    {
        size_t jOver = emitJumpPlaceholder(OP_JMP);
        uint16_t entry = (uint16_t)currentPos();
        funcAddresses[node->value] = entry;
        std::vector<std::string> paramNames;
        ASTNode *bodyNode = nullptr;
        for (auto &c : node->children)
        {
            if (c->type == ASTNodeType::VAR_DECL)
                paramNames.push_back(c->value);
            else if (c->type == ASTNodeType::PROGRAM)
                bodyNode = c.get();
        }
        FuncEntry fe;
        fe.name = node->value;
        fe.entryPoint = entry;
        fe.paramCount = (uint8_t)paramNames.size();
        fe.paramNames = paramNames;
        funcEntries.push_back(fe);
        if (node->isExported)
        {
            ExportSymbol es;
            es.name = node->value;
            es.type = SymbolType::FUNCTION;
            es.address = entry;
            es.paramCount = (uint8_t)paramNames.size();
            exportSymbols.push_back(es);
        }
        pushScope(true);
        for (size_t i = 0; i < paramNames.size(); i++)
            scopes.back().locals[paramNames[i]] = (uint8_t)i;
        scopes.back().nextLocal = (uint8_t)paramNames.size();
        if (bodyNode)
            compileBlock(bodyNode);
        emit(OP_RETURN_NONE);
        popScope();
        patchJump(jOver, (uint16_t)currentPos());
        break;
    }
    case ASTNodeType::FUNC_CALL:
    {
        uint8_t ac = 0;
        for (auto &c : node->children)
        {
            compileNode(c.get());
            ac++;
        }
        auto it = funcAddresses.find(node->value);
        if (it == funcAddresses.end())
        {
            emit(OP_FUNC_CALL);
            size_t pa = bytecode.size();
            emitU16(0xFFFF);
            emit(ac);
            for (const auto &mod : importedModules)
            {
                importRequests.push_back({mod, node->value, pa});
                break;
            }
        }
        else
        {
            emit(OP_FUNC_CALL);
            emitU16(it->second);
            emit(ac);
        }
        break;
    }
    case ASTNodeType::RETURN_STMT:
        if (!node->children.empty())
        {
            compileNode(node->children[0].get());
            emit(OP_RETURN);
        }
        else
            emit(OP_RETURN_NONE);
        break;
    case ASTNodeType::TASK:
    {
        size_t jOver = emitJumpPlaceholder(OP_JMP);
        uint16_t entry = (uint16_t)currentPos();
        taskEntries.push_back({node->value, entry});
        pushScope();
        for (auto &c : node->children)
            compileNode(c.get());
        emit(OP_HALT);
        popScope();
        patchJump(jOver, (uint16_t)currentPos());
        break;
    }
    case ASTNodeType::PROGRAM:
        for (auto &c : node->children)
            compileNode(c.get());
        break;
    default:
        throw std::runtime_error("Compiler:Unknown node " + std::to_string((int)node->type));
    }
}
ProgramBinary Compiler::compile(ASTNode *root)
{
    if (!root)
        throw std::runtime_error("Null AST");
    bytecode.clear();
    constants.clear();
    globalSymbols.clear();
    scopes.clear();
    declaredVars.clear();
    taskEntries.clear();
    funcEntries.clear();
    funcAddresses.clear();
    exportSymbols.clear();
    importRequests.clear();
    importedModules.clear();
    loopStack.clear();
    nextGlobalId = 0;
    collectFunctions(root);
    for (auto &node : root->children)
        compileNode(node.get());
    emit(OP_HALT);
    ProgramBinary prog;
    prog.bytecode = bytecode;
    prog.constants = constants;
    prog.tasks = taskEntries;
    prog.functions = funcEntries;
    prog.exports = exportSymbols;
    prog.imports = importRequests;
    prog.arena = arena;
    prog.name = root->value;
    return prog;
}
void Compiler::printConstants() const
{
    std::cout << "=== Constants (" << constants.size() << ") ===\n";
    for (size_t i = 0; i < constants.size(); i++)
        std::cout << "  #" << i << " [" << constants[i].typeStr() << "] " << constants[i].toString() << "\n";
}
void Compiler::printBytecode() const
{
    std::cout << "=== Bytecode (" << bytecode.size() << " bytes) ===\n";
    size_t i = 0;
    while (i < bytecode.size())
    {
        std::cout << "  [" << i << "] ";
        uint8_t op = bytecode[i++];
        switch (op)
        {
        case OP_NOP:
            std::cout << "NOP\n";
            break;
        case OP_PUSH_CONST:
        {
            uint16_t id = bytecode[i] | (bytecode[i + 1] << 8);
            i += 2;
            std::cout << "PUSH #" << id << "\n";
            break;
        }
        case OP_STORE:
            std::cout << "STORE g" << (int)bytecode[i++] << "\n";
            break;
        case OP_LOAD:
            std::cout << "LOAD g" << (int)bytecode[i++] << "\n";
            break;
        case OP_STORE_LOCAL:
            std::cout << "STL l" << (int)bytecode[i++] << "\n";
            break;
        case OP_LOAD_LOCAL:
            std::cout << "LDL l" << (int)bytecode[i++] << "\n";
            break;
        case OP_ADD:
            std::cout << "ADD\n";
            break;
        case OP_SUB:
            std::cout << "SUB\n";
            break;
        case OP_MUL:
            std::cout << "MUL\n";
            break;
        case OP_DIV:
            std::cout << "DIV\n";
            break;
        case OP_MOD:
            std::cout << "MOD\n";
            break;
        case OP_CMP_EQ:
            std::cout << "EQ\n";
            break;
        case OP_CMP_NE:
            std::cout << "NE\n";
            break;
        case OP_CMP_LT:
            std::cout << "LT\n";
            break;
        case OP_CMP_GT:
            std::cout << "GT\n";
            break;
        case OP_CMP_LTE:
            std::cout << "LTE\n";
            break;
        case OP_CMP_GTE:
            std::cout << "GTE\n";
            break;
        case OP_AND:
            std::cout << "AND\n";
            break;
        case OP_OR:
            std::cout << "OR\n";
            break;
        case OP_NOT:
            std::cout << "NOT\n";
            break;
        case OP_POP:
            std::cout << "POP\n";
            break;
        case OP_DUP:
            std::cout << "DUP\n";
            break;
        case OP_JMP:
        {
            uint16_t t = bytecode[i] | (bytecode[i + 1] << 8);
            i += 2;
            std::cout << "JMP->" << t << "\n";
            break;
        }
        case OP_JZ:
        {
            uint16_t t = bytecode[i] | (bytecode[i + 1] << 8);
            i += 2;
            std::cout << "JZ->" << t << "\n";
            break;
        }
        case OP_JNZ:
        {
            uint16_t t = bytecode[i] | (bytecode[i + 1] << 8);
            i += 2;
            std::cout << "JNZ->" << t << "\n";
            break;
        }
        case OP_CALL:
        {
            int m = bytecode[i++], f = bytecode[i++], a = bytecode[i++];
            std::cout << "CALL m" << m << " f" << f << " a" << a << "\n";
            break;
        }
        case OP_CALL_VOID:
        {
            int m = bytecode[i++], f = bytecode[i++], a = bytecode[i++];
            std::cout << "CALLV m" << m << " f" << f << " a" << a << "\n";
            break;
        }
        case OP_FUNC_CALL:
        {
            uint16_t t = bytecode[i] | (bytecode[i + 1] << 8);
            i += 2;
            int a = bytecode[i++];
            std::cout << "FCALL->" << t << " a" << a << "\n";
            break;
        }
        case OP_RETURN:
            std::cout << "RET\n";
            break;
        case OP_RETURN_NONE:
            std::cout << "RETN\n";
            break;
        case OP_MAKE_ARRAY:
            std::cout << "MKARR " << (int)bytecode[i++] << "\n";
            break;
        case OP_INDEX_GET:
            std::cout << "IGET\n";
            break;
        case OP_INDEX_SET:
            std::cout << "ISET\n";
            break;
        case OP_LENGTH:
            std::cout << "LEN\n";
            break;
        case OP_ARRAY_PUSH:
            std::cout << "APUSH\n";
            break;
        case OP_STR_CONCAT:
            std::cout << "CONCAT\n";
            break;
        case OP_CAST_INT:
            std::cout << "CINT\n";
            break;
        case OP_CAST_FLOAT:
            std::cout << "CFLT\n";
            break;
        case OP_CAST_STR:
            std::cout << "CSTR\n";
            break;
        case OP_WAIT:
        {
            uint16_t t = bytecode[i] | (bytecode[i + 1] << 8);
            i += 2;
            std::cout << "WAIT " << t << "ms\n";
            break;
        }
        case OP_WAIT_DYN:
            std::cout << "WAITD\n";
            break;
        case OP_YIELD:
            std::cout << "YIELD\n";
            break;
        case OP_HALT:
            std::cout << "HALT\n";
            break;
        default:
            std::cout << "? 0x" << std::hex << (int)op << std::dec << "\n";
            break;
        }
    }
}
```

### src\Lang\Lexer.cpp
```
#include "Lexer.h"
#include <unordered_set>
#include <cctype>
#include <stdexcept>
char Lexer::peek() { return pos < source.length() ? source[pos] : 0; }
char Lexer::peekNext() { return (pos + 1) < source.length() ? source[pos + 1] : 0; }
char Lexer::advance() { return source[pos++]; }
bool Lexer::isAtEnd() { return pos >= source.length(); }
std::vector<Token> Lexer::tokenize()
{
    std::vector<Token> tokens;
    static std::unordered_set<std::string> kw = {
        "PROGRAM", "ENDPROGRAM", "TASK", "ENDTASK", "SET", "WAIT", "YIELD", "CALL",
        "IF", "THEN", "ELSE", "ENDIF", "LOOP", "ENDLOOP", "WHILE", "ENDWHILE",
        "FOR", "TO", "STEP", "ENDFOR", "BREAK", "CONTINUE",
        "PRINT", "TRUE", "FALSE", "FUNC", "ENDFUNC", "RETURN", "AND", "OR", "NOT",
        "VAR", "LEN", "IMPORT", "EXPORT", "PUSH", "CONCAT", "TOSTR", "TOINT", "TOFLOAT"};
    while (!isAtEnd())
    {
        char c = peek();
        if (isspace(c))
        {
            if (c == '\n')
                line++;
            advance();
            continue;
        }
        if (c == '/' && peekNext() == '/')
        {
            while (!isAtEnd() && peek() != '\n')
                advance();
            continue;
        }
        if (isalpha(c) || c == '_')
        {
            std::string s;
            while (!isAtEnd() && (isalnum(peek()) || peek() == '_'))
                s += advance();
            tokens.push_back({kw.count(s) ? TokenType::KEYWORD : TokenType::IDENTIFIER, s, line});
            continue;
        }
        if (isdigit(c))
        {
            std::string s;
            while (!isAtEnd() && isdigit(peek()))
                s += advance();
            if (!isAtEnd() && peek() == '.')
            {
                s += advance();
                while (!isAtEnd() && isdigit(peek()))
                    s += advance();
            }
            tokens.push_back({TokenType::NUMBER, s, line});
            continue;
        }
        if (c == '"')
        {
            advance();
            std::string s;
            while (!isAtEnd() && peek() != '"')
            {
                if (peek() == '\\')
                {
                    advance();
                    if (isAtEnd())
                        throw std::runtime_error("Unterminated escape L" + std::to_string(line));
                    char e = advance();
                    switch (e)
                    {
                    case 'n':
                        s += '\n';
                        break;
                    case 't':
                        s += '\t';
                        break;
                    case '\\':
                        s += '\\';
                        break;
                    case '"':
                        s += '"';
                        break;
                    default:
                        s += e;
                    }
                }
                else
                {
                    if (peek() == '\n')
                        line++;
                    s += advance();
                }
            }
            if (isAtEnd())
                throw std::runtime_error("Unterminated string L" + std::to_string(line));
            advance();
            tokens.push_back({TokenType::STRING, s, line});
            continue;
        }
        if (c == '.')
        {
            tokens.push_back({TokenType::DOT, std::string(1, advance()), line});
            continue;
        }
        if (c == ':')
        {
            tokens.push_back({TokenType::COLON, std::string(1, advance()), line});
            continue;
        }
        if (c == ';')
        {
            tokens.push_back({TokenType::SEMICOLON, std::string(1, advance()), line});
            continue;
        }
        if (c == '?')
        {
            tokens.push_back({TokenType::QUESTION, std::string(1, advance()), line});
            continue;
        }
        if (c == '%')
        {
            tokens.push_back({TokenType::PERCENT, std::string(1, advance()), line});
            continue;
        }
        if (c == '[')
        {
            tokens.push_back({TokenType::LBRACKET, std::string(1, advance()), line});
            continue;
        }
        if (c == ']')
        {
            tokens.push_back({TokenType::RBRACKET, std::string(1, advance()), line});
            continue;
        }
        if (c == '=' && peekNext() == '=')
        {
            advance();
            advance();
            tokens.push_back({TokenType::OPERATOR, "==", line});
            continue;
        }
        if (c == '!' && peekNext() == '=')
        {
            advance();
            advance();
            tokens.push_back({TokenType::OPERATOR, "!=", line});
            continue;
        }
        if (c == '>' && peekNext() == '=')
        {
            advance();
            advance();
            tokens.push_back({TokenType::OPERATOR, ">=", line});
            continue;
        }
        if (c == '<' && peekNext() == '=')
        {
            advance();
            advance();
            tokens.push_back({TokenType::OPERATOR, "<=", line});
            continue;
        }
        if (c == '=')
        {
            advance();
            tokens.push_back({TokenType::EQUALS, "=", line});
            continue;
        }
        if (c == '(')
        {
            tokens.push_back({TokenType::LPAREN, std::string(1, advance()), line});
            continue;
        }
        if (c == ')')
        {
            tokens.push_back({TokenType::RPAREN, std::string(1, advance()), line});
            continue;
        }
        if (c == ',')
        {
            tokens.push_back({TokenType::COMMA, std::string(1, advance()), line});
            continue;
        }
        if (c == '{')
        {
            tokens.push_back({TokenType::LBRACE, std::string(1, advance()), line});
            continue;
        }
        if (c == '}')
        {
            tokens.push_back({TokenType::RBRACE, std::string(1, advance()), line});
            continue;
        }
        if (std::string("+-*/<>!").find(c) != std::string::npos)
        {
            tokens.push_back({TokenType::OPERATOR, std::string(1, advance()), line});
            continue;
        }
        tokens.push_back({TokenType::UNKNOWN, std::string(1, advance()), line});
    }
    tokens.push_back({TokenType::EOF_TOKEN, "", line});
    return tokens;
}
```

### src\Lang\Lexer.h
```
#ifndef ESPDSL_LEXER_H
#define ESPDSL_LEXER_H
#include <string>
#include <vector>
enum class TokenType
{
    KEYWORD,
    IDENTIFIER,
    NUMBER,
    STRING,
    OPERATOR,
    LPAREN,
    RPAREN,
    COMMA,
    EQUALS,
    DOT,
    LBRACE,
    RBRACE,
    LBRACKET,
    RBRACKET,
    COLON,
    SEMICOLON,
    QUESTION,
    PERCENT,
    EOF_TOKEN,
    UNKNOWN
};
struct Token
{
    TokenType type;
    std::string value;
    int line;
};
class Lexer
{
    std::string source;
    size_t pos = 0;
    int line = 1;
    char peek();
    char peekNext();
    char advance();
    bool isAtEnd();
public:
    Lexer(const std::string &src) : source(src) {}
    std::vector<Token> tokenize();
};
#endif
```

### src\Lang\Parser.cpp
```
#include "Parser.h"
Token Parser::peek() { return pos < tokens.size() ? tokens[pos] : Token{TokenType::EOF_TOKEN, "", 0}; }
Token Parser::consume()
{
    if (pos >= tokens.size())
        throw std::runtime_error("Parser:Unexpected EOF");
    return tokens[pos++];
}
Token Parser::expect(TokenType t, const std::string &ctx)
{
    Token tok = peek();
    if (tok.type != t)
        throw std::runtime_error("Parser:Expected token in " + ctx + " got '" + tok.value + "' L" + std::to_string(tok.line));
    return consume();
}
Token Parser::expectKW(const std::string &kw)
{
    Token t = peek();
    if (t.type != TokenType::KEYWORD || t.value != kw)
        throw std::runtime_error("Parser:Expected '" + kw + "' got '" + t.value + "' L" + std::to_string(t.line));
    return consume();
}
bool Parser::match(const std::string &v)
{
    if (peek().value == v)
    {
        consume();
        return true;
    }
    return false;
}
std::unique_ptr<ASTNode> Parser::parse()
{
    auto root = std::make_unique<ASTNode>(ASTNodeType::PROGRAM);
    while (peek().type != TokenType::EOF_TOKEN)
    {
        Token t = peek();
        if (t.type == TokenType::KEYWORD && t.value == "PROGRAM")
        {
            consume();
            if (peek().type == TokenType::IDENTIFIER)
                root->value = consume().value;
            continue;
        }
        if (t.type == TokenType::KEYWORD && t.value == "ENDPROGRAM")
        {
            consume();
            continue;
        }
        if (t.type == TokenType::KEYWORD && t.value == "IMPORT")
        {
            consume();
            root->children.push_back(std::make_unique<ASTNode>(ASTNodeType::IMPORT_STMT, expect(TokenType::IDENTIFIER, "IMPORT").value));
            continue;
        }
        if (t.type == TokenType::KEYWORD && t.value == "EXPORT")
        {
            consume();
            auto s = parseStatement();
            if (s)
                s->isExported = true;
            if (s)
                root->children.push_back(std::move(s));
            continue;
        }
        if (t.type == TokenType::KEYWORD && t.value == "TASK")
        {
            consume();
            std::string name = expect(TokenType::IDENTIFIER, "TASK").value;
            auto task = std::make_unique<ASTNode>(ASTNodeType::TASK, name);
            while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && peek().value == "ENDTASK"))
                task->children.push_back(parseStatement());
            expectKW("ENDTASK");
            root->children.push_back(std::move(task));
            continue;
        }
        if (t.type == TokenType::KEYWORD && t.value == "FUNC")
        {
            root->children.push_back(parseStatement());
            continue;
        }
        root->children.push_back(parseStatement());
    }
    return root;
}
std::unique_ptr<ASTNode> Parser::parseStatement()
{
    Token t = peek();
    if (t.type == TokenType::KEYWORD && t.value == "FUNC")
    {
        consume();
        std::string name = expect(TokenType::IDENTIFIER, "FUNC").value;
        auto func = std::make_unique<ASTNode>(ASTNodeType::FUNC_DEF, name);
        expect(TokenType::LPAREN, "FUNC");
        while (peek().type != TokenType::RPAREN && peek().type != TokenType::EOF_TOKEN)
        {
            std::string pn = expect(TokenType::IDENTIFIER, "param").value;
            auto p = std::make_unique<ASTNode>(ASTNodeType::VAR_DECL, pn);
            if (peek().type == TokenType::COLON)
            {
                consume();
                p->typeHint = expect(TokenType::IDENTIFIER, "type").value;
            }
            func->children.push_back(std::move(p));
            if (peek().type == TokenType::COMMA)
                consume();
        }
        expect(TokenType::RPAREN, "FUNC");
        auto body = std::make_unique<ASTNode>(ASTNodeType::PROGRAM, "body");
        while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && peek().value == "ENDFUNC"))
            body->children.push_back(parseStatement());
        expectKW("ENDFUNC");
        func->children.push_back(std::move(body));
        return func;
    }
    if (t.type == TokenType::KEYWORD && t.value == "VAR")
    {
        consume();
        std::string var = expect(TokenType::IDENTIFIER, "VAR").value;
        auto node = std::make_unique<ASTNode>(ASTNodeType::VAR_DECL, var);
        if (peek().type == TokenType::COLON)
        {
            consume();
            node->typeHint = expect(TokenType::IDENTIFIER, "type").value;
        }
        if (peek().type == TokenType::EQUALS)
        {
            consume();
            node->children.push_back(parseExpression());
        }
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "SET")
    {
        consume();
        std::string var = expect(TokenType::IDENTIFIER, "SET").value;
        if (peek().type == TokenType::LBRACKET)
        {
            consume();
            auto idx = parseExpression();
            expect(TokenType::RBRACKET, "SET idx");
            expect(TokenType::EQUALS, "SET");
            auto node = std::make_unique<ASTNode>(ASTNodeType::INDEX_ASSIGN, var);
            node->children.push_back(std::move(idx));
            node->children.push_back(parseExpression());
            return node;
        }
        expect(TokenType::EQUALS, "SET");
        auto node = std::make_unique<ASTNode>(ASTNodeType::ASSIGNMENT, var);
        node->children.push_back(parseExpression());
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "CALL")
    {
        consume();
        std::string mod = expect(TokenType::IDENTIFIER, "CALL").value;
        expect(TokenType::DOT, "CALL");
        std::string meth = expect(TokenType::IDENTIFIER, "CALL").value;
        auto node = std::make_unique<ASTNode>(ASTNodeType::CALL_STMT);
        node->value = mod;
        node->children.push_back(std::make_unique<ASTNode>(ASTNodeType::VARIABLE, meth));
        expect(TokenType::LPAREN, "CALL");
        while (peek().type != TokenType::RPAREN && peek().type != TokenType::EOF_TOKEN)
        {
            node->children.push_back(parseExpression());
            if (peek().type == TokenType::COMMA)
                consume();
        }
        expect(TokenType::RPAREN, "CALL");
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "IF")
    {
        consume();
        auto node = std::make_unique<ASTNode>(ASTNodeType::IF_STMT);
        node->children.push_back(parseExpression());
        expectKW("THEN");
        auto tb = std::make_unique<ASTNode>(ASTNodeType::PROGRAM, "then");
        while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && (peek().value == "ELSE" || peek().value == "ENDIF")))
            tb->children.push_back(parseStatement());
        node->children.push_back(std::move(tb));
        if (peek().type == TokenType::KEYWORD && peek().value == "ELSE")
        {
            consume();
            auto eb = std::make_unique<ASTNode>(ASTNodeType::PROGRAM, "else");
            while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && peek().value == "ENDIF"))
                eb->children.push_back(parseStatement());
            node->children.push_back(std::move(eb));
        }
        expectKW("ENDIF");
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "LOOP")
    {
        consume();
        auto node = std::make_unique<ASTNode>(ASTNodeType::LOOP_STMT);
        if (peek().type == TokenType::NUMBER)
            node->value = consume().value;
        while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && peek().value == "ENDLOOP"))
            node->children.push_back(parseStatement());
        expectKW("ENDLOOP");
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "WHILE")
    {
        consume();
        auto node = std::make_unique<ASTNode>(ASTNodeType::WHILE_STMT);
        node->children.push_back(parseExpression());
        auto body = std::make_unique<ASTNode>(ASTNodeType::PROGRAM, "while_body");
        while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && peek().value == "ENDWHILE"))
            body->children.push_back(parseStatement());
        expectKW("ENDWHILE");
        node->children.push_back(std::move(body));
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "FOR")
    {
        consume();
        std::string var = expect(TokenType::IDENTIFIER, "FOR").value;
        expect(TokenType::EQUALS, "FOR");
        auto node = std::make_unique<ASTNode>(ASTNodeType::FOR_STMT, var);
        node->children.push_back(parseExpression());
        expectKW("TO");
        node->children.push_back(parseExpression());
        if (peek().type == TokenType::KEYWORD && peek().value == "STEP")
        {
            consume();
            node->children.push_back(parseExpression());
        }
        auto body = std::make_unique<ASTNode>(ASTNodeType::PROGRAM, "for_body");
        while (peek().type != TokenType::EOF_TOKEN && !(peek().type == TokenType::KEYWORD && peek().value == "ENDFOR"))
            body->children.push_back(parseStatement());
        expectKW("ENDFOR");
        node->children.push_back(std::move(body));
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "BREAK")
    {
        consume();
        return std::make_unique<ASTNode>(ASTNodeType::BREAK_STMT);
    }
    if (t.type == TokenType::KEYWORD && t.value == "CONTINUE")
    {
        consume();
        return std::make_unique<ASTNode>(ASTNodeType::CONTINUE_STMT);
    }
    if (t.type == TokenType::KEYWORD && t.value == "PUSH")
    {
        consume();
        auto node = std::make_unique<ASTNode>(ASTNodeType::ARRAY_PUSH);
        node->children.push_back(parseExpression());
        expect(TokenType::COMMA, "PUSH");
        node->children.push_back(parseExpression());
        return node;
    }
    if (t.type == TokenType::KEYWORD && t.value == "WAIT")
    {
        consume();
        auto n = std::make_unique<ASTNode>(ASTNodeType::WAIT_STMT);
        n->children.push_back(parseExpression());
        return n;
    }
    if (t.type == TokenType::KEYWORD && t.value == "YIELD")
    {
        consume();
        return std::make_unique<ASTNode>(ASTNodeType::YIELD_STMT);
    }
    if (t.type == TokenType::KEYWORD && t.value == "PRINT")
    {
        consume();
        auto n = std::make_unique<ASTNode>(ASTNodeType::PRINT_STMT);
        n->children.push_back(parseExpression());
        return n;
    }
    if (t.type == TokenType::KEYWORD && t.value == "RETURN")
    {
        consume();
        auto node = std::make_unique<ASTNode>(ASTNodeType::RETURN_STMT);
        Token next = peek();
        bool hasExpr = (next.type != TokenType::EOF_TOKEN && next.type != TokenType::KEYWORD) || (next.type == TokenType::KEYWORD && next.value != "ENDFUNC" && next.value != "ENDTASK" && next.value != "ENDIF" && next.value != "ENDLOOP" && next.value != "ENDWHILE" && next.value != "ENDFOR" && next.value != "ELSE");
        if (hasExpr)
            node->children.push_back(parseExpression());
        return node;
    }
    Token bad = consume();
    throw std::runtime_error("Parser:Unexpected '" + bad.value + "' L" + std::to_string(bad.line));
}
std::unique_ptr<ASTNode> Parser::parseExpression() { return parseTernary(); }
std::unique_ptr<ASTNode> Parser::parseTernary()
{
    auto node = parseLogicalOr();
    if (peek().type == TokenType::QUESTION)
    {
        consume();
        auto tern = std::make_unique<ASTNode>(ASTNodeType::TERNARY_EXPR);
        tern->children.push_back(std::move(node));
        tern->children.push_back(parseLogicalOr());
        expect(TokenType::COLON, "ternary");
        tern->children.push_back(parseLogicalOr());
        return tern;
    }
    return node;
}
std::unique_ptr<ASTNode> Parser::parseLogicalOr()
{
    auto node = parseLogicalAnd();
    while (peek().type == TokenType::KEYWORD && peek().value == "OR")
    {
        consume();
        auto bin = std::make_unique<ASTNode>(ASTNodeType::LOGICAL_OR, "OR");
        bin->children.push_back(std::move(node));
        bin->children.push_back(parseLogicalAnd());
        node = std::move(bin);
    }
    return node;
}
std::unique_ptr<ASTNode> Parser::parseLogicalAnd()
{
    auto node = parseComparison();
    while (peek().type == TokenType::KEYWORD && peek().value == "AND")
    {
        consume();
        auto bin = std::make_unique<ASTNode>(ASTNodeType::LOGICAL_AND, "AND");
        bin->children.push_back(std::move(node));
        bin->children.push_back(parseComparison());
        node = std::move(bin);
    }
    return node;
}
std::unique_ptr<ASTNode> Parser::parseComparison()
{
    auto node = parseTerm();
    while (peek().type == TokenType::OPERATOR && (peek().value == "==" || peek().value == "!=" || peek().value == "<" || peek().value == ">" || peek().value == "<=" || peek().value == ">="))
    {
        std::string op = consume().value;
        auto bin = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, op);
        bin->children.push_back(std::move(node));
        bin->children.push_back(parseTerm());
        node = std::move(bin);
    }
    return node;
}
std::unique_ptr<ASTNode> Parser::parseTerm()
{
    auto node = parseFactor();
    while (peek().type == TokenType::OPERATOR && (peek().value == "+" || peek().value == "-"))
    {
        std::string op = consume().value;
        auto bin = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, op);
        bin->children.push_back(std::move(node));
        bin->children.push_back(parseFactor());
        node = std::move(bin);
    }
    return node;
}
std::unique_ptr<ASTNode> Parser::parseFactor()
{
    auto node = parseUnary();
    while ((peek().type == TokenType::OPERATOR && (peek().value == "*" || peek().value == "/")) || peek().type == TokenType::PERCENT)
    {
        if (peek().type == TokenType::PERCENT)
        {
            consume();
            auto bin = std::make_unique<ASTNode>(ASTNodeType::MODULO_OP, "%");
            bin->children.push_back(std::move(node));
            bin->children.push_back(parseUnary());
            node = std::move(bin);
        }
        else
        {
            std::string op = consume().value;
            auto bin = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, op);
            bin->children.push_back(std::move(node));
            bin->children.push_back(parseUnary());
            node = std::move(bin);
        }
    }
    return node;
}
std::unique_ptr<ASTNode> Parser::parseUnary()
{
    if (peek().type == TokenType::OPERATOR && peek().value == "-")
    {
        consume();
        auto operand = parseUnary();
        if (operand->type == ASTNodeType::LITERAL && operand->value.find('"') == std::string::npos)
        {
            if (operand->value[0] == '-')
                operand->value = operand->value.substr(1);
            else
                operand->value = "-" + operand->value;
            return operand;
        }
        auto z = std::make_unique<ASTNode>(ASTNodeType::LITERAL, "0");
        auto bin = std::make_unique<ASTNode>(ASTNodeType::BINARY_OP, "-");
        bin->children.push_back(std::move(z));
        bin->children.push_back(std::move(operand));
        return bin;
    }
    if (peek().type == TokenType::KEYWORD && peek().value == "NOT")
    {
        consume();
        auto n = std::make_unique<ASTNode>(ASTNodeType::LOGICAL_NOT, "NOT");
        n->children.push_back(parseUnary());
        return n;
    }
    return parsePrimary();
}
std::unique_ptr<ASTNode> Parser::parseCallExpr(const std::string &mod)
{
    std::string meth = expect(TokenType::IDENTIFIER, "call").value;
    auto node = std::make_unique<ASTNode>(ASTNodeType::CALL_EXPR);
    node->value = mod;
    node->children.push_back(std::make_unique<ASTNode>(ASTNodeType::VARIABLE, meth));
    expect(TokenType::LPAREN, "call");
    while (peek().type != TokenType::RPAREN && peek().type != TokenType::EOF_TOKEN)
    {
        node->children.push_back(parseExpression());
        if (peek().type == TokenType::COMMA)
            consume();
    }
    expect(TokenType::RPAREN, "call");
    return node;
}
std::unique_ptr<ASTNode> Parser::parseFuncCall(const std::string &name)
{
    auto node = std::make_unique<ASTNode>(ASTNodeType::FUNC_CALL, name);
    expect(TokenType::LPAREN, "func call");
    while (peek().type != TokenType::RPAREN && peek().type != TokenType::EOF_TOKEN)
    {
        node->children.push_back(parseExpression());
        if (peek().type == TokenType::COMMA)
            consume();
    }
    expect(TokenType::RPAREN, "func call");
    return node;
}
std::unique_ptr<ASTNode> Parser::parsePrimary()
{
    Token t = peek();
    if (t.type == TokenType::NUMBER)
    {
        consume();
        return std::make_unique<ASTNode>(ASTNodeType::LITERAL, t.value);
    }
    if (t.type == TokenType::STRING)
    {
        consume();
        return std::make_unique<ASTNode>(ASTNodeType::LITERAL, "\"" + t.value + "\"");
    }
    if (t.type == TokenType::KEYWORD && (t.value == "TRUE" || t.value == "FALSE"))
    {
        consume();
        return std::make_unique<ASTNode>(ASTNodeType::LITERAL, t.value);
    }
    if (t.type == TokenType::KEYWORD && t.value == "LEN")
    {
        consume();
        expect(TokenType::LPAREN, "LEN");
        auto n = std::make_unique<ASTNode>(ASTNodeType::LEN_EXPR);
        n->children.push_back(parseExpression());
        expect(TokenType::RPAREN, "LEN");
        return n;
    }
    if (t.type == TokenType::KEYWORD && (t.value == "TOINT" || t.value == "TOFLOAT" || t.value == "TOSTR"))
    {
        std::string ct = consume().value;
        expect(TokenType::LPAREN, "cast");
        auto n = std::make_unique<ASTNode>(ASTNodeType::CAST_EXPR, ct);
        n->children.push_back(parseExpression());
        expect(TokenType::RPAREN, "cast");
        return n;
    }
    if (t.type == TokenType::KEYWORD && t.value == "CONCAT")
    {
        consume();
        expect(TokenType::LPAREN, "CONCAT");
        auto n = std::make_unique<ASTNode>(ASTNodeType::CONCAT_EXPR);
        n->children.push_back(parseExpression());
        expect(TokenType::COMMA, "CONCAT");
        n->children.push_back(parseExpression());
        expect(TokenType::RPAREN, "CONCAT");
        return n;
    }
    if (t.type == TokenType::LBRACKET)
    {
        consume();
        auto n = std::make_unique<ASTNode>(ASTNodeType::ARRAY_LITERAL);
        while (peek().type != TokenType::RBRACKET && peek().type != TokenType::EOF_TOKEN)
        {
            n->children.push_back(parseExpression());
            if (peek().type == TokenType::COMMA)
                consume();
        }
        expect(TokenType::RBRACKET, "array");
        return n;
    }
    if (t.type == TokenType::IDENTIFIER)
    {
        consume();
        if (peek().type == TokenType::DOT)
        {
            consume();
            return parseCallExpr(t.value);
        }
        if (peek().type == TokenType::LPAREN)
        {
            return parseFuncCall(t.value);
        }
        if (peek().type == TokenType::LBRACKET)
        {
            consume();
            auto idx = parseExpression();
            expect(TokenType::RBRACKET, "index");
            auto n = std::make_unique<ASTNode>(ASTNodeType::INDEX_ACCESS, t.value);
            n->children.push_back(std::move(idx));
            return n;
        }
        return std::make_unique<ASTNode>(ASTNodeType::VARIABLE, t.value);
    }
    if (t.type == TokenType::LPAREN)
    {
        consume();
        auto n = parseExpression();
        expect(TokenType::RPAREN, "paren");
        return n;
    }
    if (t.type == TokenType::KEYWORD && t.value == "CALL")
    {
        consume();
        std::string mod = expect(TokenType::IDENTIFIER, "CALL expr").value;
        expect(TokenType::DOT, "CALL expr");
        return parseCallExpr(mod);
    }
    throw std::runtime_error("Parser:Unexpected '" + t.value + "' L" + std::to_string(t.line));
}
```

### src\Lang\Parser.h
```
#ifndef ESPDSL_PARSER_H
#define ESPDSL_PARSER_H
#include "Lexer.h"
#include <memory>
#include <vector>
#include <string>
#include <stdexcept>
enum class ASTNodeType
{
    PROGRAM,
    TASK,
    ASSIGNMENT,
    CALL_STMT,
    CALL_EXPR,
    BINARY_OP,
    LITERAL,
    VARIABLE,
    IF_STMT,
    LOOP_STMT,
    WHILE_STMT,
    FOR_STMT,
    BREAK_STMT,
    CONTINUE_STMT,
    WAIT_STMT,
    YIELD_STMT,
    PRINT_STMT,
    FUNC_DEF,
    RETURN_STMT,
    FUNC_CALL,
    ARRAY_LITERAL,
    INDEX_ACCESS,
    INDEX_ASSIGN,
    VAR_DECL,
    LEN_EXPR,
    LOGICAL_AND,
    LOGICAL_OR,
    LOGICAL_NOT,
    IMPORT_STMT,
    EXPORT_MARKER,
    TERNARY_EXPR,
    ARRAY_PUSH,
    CAST_EXPR,
    CONCAT_EXPR,
    MODULO_OP
};
struct ASTNode
{
    ASTNodeType type;
    std::string value;
    std::string typeHint;
    bool isExported = false;
    std::vector<std::unique_ptr<ASTNode>> children;
    ASTNode(ASTNodeType t, const std::string &v = "") : type(t), value(v) {}
    void print(int indent = 0) const
    {
        for (int i = 0; i < indent; i++)
            printf("  ");
        static const char *n[] = {"PROG", "TASK", "SET", "CLS", "CLE", "BOP", "LIT", "VAR", "IF", "LOOP", "WHILE", "FOR", "BRK", "CONT", "WAIT", "YLD", "PRT", "FN", "RET", "FC", "AL", "IG", "IS", "VD", "LEN", "LA", "LO", "LN", "IMP", "EXP", "TERN", "AP", "CAST", "CAT", "MOD"};
        int idx = (int)type;
        printf("[%s] '%s'", idx < 35 ? n[idx] : "?", value.c_str());
        if (isExported)
            printf(" EXP");
        if (!typeHint.empty())
            printf(" :%s", typeHint.c_str());
        printf("\n");
        for (const auto &c : children)
            if (c)
                c->print(indent + 1);
    }
};
class Parser
{
    std::vector<Token> tokens;
    size_t pos = 0;
    Token peek();
    Token consume();
    Token expect(TokenType t, const std::string &ctx = "");
    Token expectKW(const std::string &kw);
    bool match(const std::string &v);
    std::unique_ptr<ASTNode> parseStatement();
    std::unique_ptr<ASTNode> parseExpression();
    std::unique_ptr<ASTNode> parseTernary();
    std::unique_ptr<ASTNode> parseLogicalOr();
    std::unique_ptr<ASTNode> parseLogicalAnd();
    std::unique_ptr<ASTNode> parseComparison();
    std::unique_ptr<ASTNode> parseTerm();
    std::unique_ptr<ASTNode> parseFactor();
    std::unique_ptr<ASTNode> parseUnary();
    std::unique_ptr<ASTNode> parsePrimary();
    std::unique_ptr<ASTNode> parseCallExpr(const std::string &mod);
    std::unique_ptr<ASTNode> parseFuncCall(const std::string &name);
public:
    Parser(const std::vector<Token> &t) : tokens(t) {}
    std::unique_ptr<ASTNode> parse();
};
#endif
```

### src\Net\HttpClient.cpp
```
#include "HttpClient.h"#include "../VM/VM.h"#include "../Stdlib/StringLib.h"#include <iostream>static VMValue http_get(int c, VMValue *a){    if (c < 1)        return VMValue::Str("");    std::cout << "[HTTP] GET " << a[0].toString() << "\n";    return VMValue::Str(g_runtimeArena.intern("{\"mock\":true}"));}static VMValue http_post(int c, VMValue *a){    if (c < 2)        return VMValue::Str("");    std::cout << "[HTTP] POST " << a[0].toString()              << " body=" << a[1].toString() << "\n";    return VMValue::Str(g_runtimeArena.intern("{\"ok\":true}"));}static VMValue http_status(int, VMValue *){    return VMValue::Int(200);}static ModuleFuncEntry http_m[] = {    {"get", http_get},    {"post", http_post},    {"status", http_status}};void registerHttpModule(){    g_moduleRegistry.registerModule({"http", 1, http_m, 3});}
```

### src\Net\HttpClient.h
```
#ifndef ESPDSL_HTTP_CLIENT_H
#define ESPDSL_HTTP_CLIENT_H
void registerHttpModule();
#endif
```

### src\Net\MqttClient.h
```
#ifndef ESPDSL_MQTT_CLIENT_H
#define ESPDSL_MQTT_CLIENT_H
void registerMqttModule();
#endif
```

### src\Net\MqttClient.cpp
```
#include "MqttClient.h"#include "../VM/VM.h"#include "../Stdlib/StringLib.h"#include <iostream>static bool mqttConnected = false;static VMValue mq_connect(int c, VMValue* a) {    if (c < 3) return VMValue::Bool(false);    std::cout << "[MQTT] Connect " << a[0].toString()              << ":" << a[1].toInt() << "\n";    mqttConnected = true;    return VMValue::Bool(true);}static VMValue mq_publish(int c, VMValue* a) {    if (c < 2 || !mqttConnected) return VMValue::Bool(false);    std::cout << "[MQTT] PUB " << a[0].toString()              << "=" << a[1].toString() << "\n";    return VMValue::Bool(true);}static VMValue mq_subscribe(int c, VMValue* a) {    if (c < 1 || !mqttConnected) return VMValue::Bool(false);    std::cout << "[MQTT] SUB " << a[0].toString() << "\n";    return VMValue::Bool(true);}static VMValue mq_connected(int, VMValue*) {    return VMValue::Bool(mqttConnected);}static VMValue mq_disconnect(int, VMValue*) {    mqttConnected = false;    return VMValue::Bool(true);}static ModuleFuncEntry mq_m[] = {    {"connect",    mq_connect},    {"publish",    mq_publish},    {"subscribe",  mq_subscribe},    {"connected",  mq_connected},    {"disconnect", mq_disconnect}};void registerMqttModule() {    g_moduleRegistry.registerModule({"mqtt", 1, mq_m, 5});}
```

### src\Runtime\EventBus.cpp
```
#include "EventBus.h"
EventBus g_eventBus;
```

### src\Runtime\EventBus.h
```
#ifndef ESPDSL_EVENT_BUS_H
#define ESPDSL_EVENT_BUS_H
#include "../Core/Core.h"
#include "RuntimeIds.h"
#include "MessageBus.h"
#include <vector>
struct RtEvent
{
    EventId id;
    TaskId source;
    VMValue payload;
    uint32_t timestamp;
    RtEvent() : id(0), source(INVALID_TASK), payload(VMValue::None()), timestamp(0) {}
};
using EventCallback = void (*)(const RtEvent &);
struct EventSubscription
{
    bool used;
    EventId eventId;
    TaskId targetTask;
    TopicId deliverTopic;
    EventSubscription() : used(false), eventId(0), targetTask(INVALID_TASK), deliverTopic(0) {}
};
struct EventCallbackEntry
{
    bool used;
    EventId eventId;
    EventCallback callback;
    EventCallbackEntry() : used(false), eventId(0), callback(nullptr) {}
};
class EventBus
{
    RtEvent queue[MAX_EVENT_QUEUE];
    uint8_t qHead, qTail, qCount;
    RtEvent logBuf[MAX_EVENT_LOG];
    uint8_t logHead, logCount;
    EventSubscription subs[MAX_EVENT_SUBS];
    EventCallbackEntry callbacks[MAX_EVENT_CALLBACKS];
    uint32_t nowMs;
public:
    EventBus() : qHead(0), qTail(0), qCount(0), logHead(0), logCount(0), nowMs(0) {}
    void setTime(uint32_t t) { nowMs = t; }
    void reset()
    {
        qHead = qTail = qCount = 0;
        logHead = logCount = 0;
        for (int i = 0; i < MAX_EVENT_SUBS; i++)
            subs[i].used = false;
        for (int i = 0; i < MAX_EVENT_CALLBACKS; i++)
            callbacks[i].used = false;
    }
    bool subscribe(TaskId task, EventId evt, TopicId topic)
    {
        for (int i = 0; i < MAX_EVENT_SUBS; i++)
        {
            if (!subs[i].used)
            {
                subs[i].used = true;
                subs[i].eventId = evt;
                subs[i].targetTask = task;
                subs[i].deliverTopic = topic;
                return true;
            }
        }
        return false;
    }
    bool addCallback(EventId evt, EventCallback cb)
    {
        for (int i = 0; i < MAX_EVENT_CALLBACKS; i++)
        {
            if (!callbacks[i].used)
            {
                callbacks[i].used = true;
                callbacks[i].eventId = evt;
                callbacks[i].callback = cb;
                return true;
            }
        }
        return false;
    }
    bool emit(EventId id, TaskId source, const VMValue &payload)
    {
        RtEvent e;
        e.id = id;
        e.source = source;
        e.payload = payload;
        e.timestamp = nowMs;
        uint8_t li = (uint8_t)((logHead + logCount) % MAX_EVENT_LOG);
        if (logCount < MAX_EVENT_LOG)
        {
            logBuf[li] = e;
            logCount++;
        }
        else
        {
            logBuf[logHead] = e;
            logHead = (uint8_t)((logHead + 1) % MAX_EVENT_LOG);
        }
        if (qCount >= MAX_EVENT_QUEUE)
        {
            qHead = (uint8_t)((qHead + 1) % MAX_EVENT_QUEUE);
            qCount--;
        }
        queue[qTail] = e;
        qTail = (uint8_t)((qTail + 1) % MAX_EVENT_QUEUE);
        qCount++;
        return true;
    }
    void process(MessageBus &bus, uint8_t maxPerTick = 8)
    {
        uint8_t processed = 0;
        while (processed < maxPerTick && qCount > 0)
        {
            RtEvent e = queue[qHead];
            qHead = (uint8_t)((qHead + 1) % MAX_EVENT_QUEUE);
            qCount--;
            for (int i = 0; i < MAX_EVENT_SUBS; i++)
            {
                if (subs[i].used && (subs[i].eventId == e.id || subs[i].eventId == EVENT_ANY))
                    bus.send(e.source, subs[i].targetTask, subs[i].deliverTopic, e.payload, 1);
            }
            for (int i = 0; i < MAX_EVENT_CALLBACKS; i++)
            {
                if (callbacks[i].used && callbacks[i].callback &&
                    (callbacks[i].eventId == e.id || callbacks[i].eventId == EVENT_ANY))
                    callbacks[i].callback(e);
            }
            processed++;
        }
    }
    uint8_t pending() const { return qCount; }
    uint8_t logSize() const { return logCount; }
    void getLog(std::vector<RtEvent> &out) const
    {
        out.clear();
        for (uint8_t i = 0; i < logCount; i++)
        {
            uint8_t idx = (uint8_t)((logHead + i) % MAX_EVENT_LOG);
            out.push_back(logBuf[idx]);
        }
    }
    void clearLog() { logHead = logCount = 0; }
    void clearQueue() { qHead = qTail = qCount = 0; }
    void unsubscribeTask(TaskId taskId)
    {
        for (int i = 0; i < MAX_EVENT_SUBS; i++)
            if (subs[i].used && subs[i].targetTask == taskId)
                subs[i].used = false;
    }
    uint8_t subscriptionCount() const
    {
        uint8_t c = 0;
        for (int i = 0; i < MAX_EVENT_SUBS; i++)
            if (subs[i].used)
                c++;
        return c;
    }
    uint8_t callbackCount() const
    {
        uint8_t c = 0;
        for (int i = 0; i < MAX_EVENT_CALLBACKS; i++)
            if (callbacks[i].used)
                c++;
        return c;
    }
    void printLog() const
    {
        std::cout << "=== Event Log ===\n";
        for (uint8_t i = 0; i < logCount; i++)
        {
            uint8_t idx = (uint8_t)((logHead + i) % MAX_EVENT_LOG);
            std::cout << "  t=" << logBuf[idx].timestamp << " evt=" << logBuf[idx].id
                      << " src=" << (int)logBuf[idx].source
                      << " val=" << logBuf[idx].payload.toString() << "\n";
        }
    }
};
extern EventBus g_eventBus;
#endif
```

### src\Runtime\MemoryMonitor.h
```
#ifndef ESPDSL_MEMORY_MONITOR_H
#define ESPDSL_MEMORY_MONITOR_H
#include "../Core/Core.h"
#include "../VM/VM.h"
struct TaskMemoryStats
{
    uint32_t stackUsed, varsUsed, callDepth, arrayCount, totalArrayElements, estimatedBytes;
};
class MemoryMonitor
{
public:
    static TaskMemoryStats getStats(const VMContext &ctx)
    {
        TaskMemoryStats s{};
        s.stackUsed = (uint32_t)(ctx.sp + 1);
        s.callDepth = (uint32_t)(ctx.fp + 1);
        s.arrayCount = (uint32_t)ctx.arrays.size();
        for (const auto &a : ctx.arrays)
            s.totalArrayElements += a->length();
        s.varsUsed = 0;
        for (int i = 0; i < VMContext::VAR_COUNT; i++)
            if (ctx.vars[i].type != ValueType::NONE)
                s.varsUsed++;
        s.estimatedBytes = sizeof(VMContext) + s.arrayCount * sizeof(VMArray) + s.totalArrayElements * sizeof(VMValue);
        return s;
    }
    static void print(const char *name, const VMContext &ctx)
    {
        auto s = getStats(ctx);
        std::cout << "  " << name << ": stack=" << s.stackUsed << " vars=" << s.varsUsed << " arrays=" << s.arrayCount << " est=" << s.estimatedBytes << "B\n";
    }
};
#endif
```

### src\Runtime\MessageBus.cpp
```
#include "MessageBus.h"
MessageBus g_messageBus;
```

### src\Runtime\MessageBus.h
```
#ifndef ESPDSL_MESSAGE_BUS_H
#define ESPDSL_MESSAGE_BUS_H
#include "../Core/Core.h"
#include "RuntimeIds.h"
#include <vector>
struct RtMessage
{
    TaskId from;
    TaskId to;
    TopicId topic;
    VMValue payload;
    uint32_t timestamp;
    uint8_t priority;
    RtMessage() : from(INVALID_TASK), to(INVALID_TASK), topic(0),
                  payload(VMValue::None()), timestamp(0), priority(0) {}
};
struct RtMailbox
{
    RtMessage buffer[MAX_MAILBOX_MSG];
    uint8_t head, tail, count;
    bool used;
    RtMailbox() : head(0), tail(0), count(0), used(false) {}
    void clear() { head = tail = count = 0; }
    bool push(const RtMessage &msg)
    {
        if (count >= MAX_MAILBOX_MSG)
        {
            head = (uint8_t)((head + 1) % MAX_MAILBOX_MSG);
            count--;
        }
        buffer[tail] = msg;
        tail = (uint8_t)((tail + 1) % MAX_MAILBOX_MSG);
        count++;
        return true;
    }
    bool pop(RtMessage &out)
    {
        if (count == 0)
            return false;
        out = buffer[head];
        head = (uint8_t)((head + 1) % MAX_MAILBOX_MSG);
        count--;
        return true;
    }
    bool peekAt(uint8_t index, RtMessage &out) const
    {
        if (index >= count)
            return false;
        uint8_t idx = (uint8_t)((head + index) % MAX_MAILBOX_MSG);
        out = buffer[idx];
        return true;
    }
};
class MessageBus
{
    RtMailbox mailboxes[MAX_TASKS];
    uint32_t totalSent, totalDelivered, totalDropped;
    uint32_t nowMs;
public:
    MessageBus() : totalSent(0), totalDelivered(0), totalDropped(0), nowMs(0) {}
    void setTime(uint32_t t) { nowMs = t; }
    void createMailbox(TaskId id)
    {
        if (id < MAX_TASKS)
        {
            mailboxes[id].used = true;
            mailboxes[id].clear();
        }
    }
    void destroyMailbox(TaskId id)
    {
        if (id < MAX_TASKS)
        {
            mailboxes[id].used = false;
            mailboxes[id].clear();
        }
    }
    bool send(TaskId from, TaskId to, TopicId topic, const VMValue &payload, uint8_t prio = 0)
    {
        totalSent++;
        if (to >= MAX_TASKS || !mailboxes[to].used)
        {
            totalDropped++;
            return false;
        }
        RtMessage m;
        m.from = from;
        m.to = to;
        m.topic = topic;
        m.payload = payload;
        m.timestamp = nowMs;
        m.priority = prio;
        mailboxes[to].push(m);
        totalDelivered++;
        return true;
    }
    void broadcast(TaskId from, TopicId topic, const VMValue &payload, uint8_t prio = 0)
    {
        for (TaskId i = 0; i < MAX_TASKS; i++)
            if (i != from && mailboxes[i].used)
                send(from, i, topic, payload, prio);
    }
    bool receive(TaskId id, RtMessage &out)
    {
        return id < MAX_TASKS && mailboxes[id].used && mailboxes[id].pop(out);
    }
    bool has(TaskId id) const
    {
        return id < MAX_TASKS && mailboxes[id].used && mailboxes[id].count > 0;
    }
    uint8_t count(TaskId id) const
    {
        return (id < MAX_TASKS && mailboxes[id].used) ? mailboxes[id].count : 0;
    }
    void clear(TaskId id)
    {
        if (id < MAX_TASKS && mailboxes[id].used)
            mailboxes[id].clear();
    }
    void peekAll(TaskId id, std::vector<RtMessage> &out) const
    {
        out.clear();
        if (id >= MAX_TASKS || !mailboxes[id].used)
            return;
        const auto &mb = mailboxes[id];
        for (uint8_t i = 0; i < mb.count; i++)
        {
            RtMessage m;
            if (mb.peekAt(i, m))
                out.push_back(m);
        }
    }
    void clearAll()
    {
        for (TaskId i = 0; i < MAX_TASKS; i++)
            if (mailboxes[i].used)
                mailboxes[i].clear();
        totalSent = totalDelivered = totalDropped = 0;
    }
    uint32_t sent() const { return totalSent; }
    uint32_t delivered() const { return totalDelivered; }
    uint32_t dropped() const { return totalDropped; }
};
extern MessageBus g_messageBus;
#endif
```

### src\Runtime\ModuleLoader.cpp
```
#include "ModuleLoader.h"
#include <algorithm>
ModuleLoader g_moduleLoader;
bool ModuleLoader::parseModb(const std::vector<uint8_t> &data, LoadedModule &mod)
{
    if (data.size() < 6)
        return false;
    size_t pos = 0;
    if (data[0] != 'M' || data[1] != 'O' || data[2] != 'D' || data[3] != 'B')
        return false;
    pos = 4;
    mod.version = data[pos] | (data[pos + 1] << 8);
    pos += 2;
    uint8_t nameLen = data[pos++];
    if (pos + nameLen > data.size())
        return false;
    mod.name = std::string(data.begin() + pos, data.begin() + pos + nameLen);
    pos += nameLen;
    if (pos + 2 > data.size())
        return false;
    uint16_t expCount = data[pos] | (data[pos + 1] << 8);
    pos += 2;
    for (uint16_t i = 0; i < expCount; i++)
    {
        if (pos >= data.size())
            return false;
        ExportSymbol e;
        uint8_t nlen = data[pos++];
        if (pos + nlen > data.size())
            return false;
        e.name = std::string(data.begin() + pos, data.begin() + pos + nlen);
        pos += nlen;
        if (pos + 3 > data.size())
            return false;
        e.address = data[pos] | (data[pos + 1] << 8);
        pos += 2;
        e.paramCount = data[pos++];
        e.type = SymbolType::FUNCTION;
        mod.exports.push_back(e);
    }
    if (pos + 2 > data.size())
        return false;
    uint16_t constCount = data[pos] | (data[pos + 1] << 8);
    pos += 2;
    for (uint16_t i = 0; i < constCount; i++)
    {
        if (pos >= data.size())
            return false;
        ValueType type = (ValueType)data[pos++];
        switch (type)
        {
        case ValueType::INT:
        {
            if (pos + 4 > data.size())
                return false;
            int32_t v = (int32_t)(data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24));
            pos += 4;
            mod.constants.push_back(VMValue::Int(v));
            break;
        }
        case ValueType::FLOAT:
        {
            if (pos + 4 > data.size())
                return false;
            uint32_t bits = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
            pos += 4;
            float fv;
            memcpy(&fv, &bits, 4);
            mod.constants.push_back(VMValue::Float(fv));
            break;
        }
        case ValueType::BOOL:
        {
            if (pos >= data.size())
                return false;
            mod.constants.push_back(VMValue::Bool(data[pos++] != 0));
            break;
        }
        case ValueType::STRING:
        {
            if (pos + 2 > data.size())
                return false;
            uint16_t slen = data[pos] | (data[pos + 1] << 8);
            pos += 2;
            if (pos + slen > data.size())
                return false;
            std::string s(data.begin() + pos, data.begin() + pos + slen);
            pos += slen;
            mod.constants.push_back(VMValue::Str(arena_.intern(s)));
            break;
        }
        default:
            mod.constants.push_back(VMValue::None());
            break;
        }
    }
    if (pos + 4 > data.size())
        return false;
    uint32_t codeSize = data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24);
    pos += 4;
    if (pos + codeSize > data.size())
        return false;
    mod.bytecode.assign(data.begin() + pos, data.begin() + pos + codeSize);
    mod.loaded = true;
    return true;
}
std::string ModuleLoader::findFile(const std::string &name)
{
    std::vector<uint8_t> dummy;
    if (fileReader_(name, dummy))
        return name;
    std::vector<std::string> exts = {".modb", ".mod", ""};
    for (const auto &sp : searchPaths_)
        for (const auto &ext : exts)
        {
            std::string path = sp + "/" + name + ext;
            if (fileReader_(path, dummy))
                return path;
        }
    return "";
}
bool ModuleLoader::loadBinary(const std::string &name)
{
    if (modules_.count(name) && modules_[name].loaded)
        return true;
    std::string path = findFile(name);
    if (path.empty())
        return false;
    std::vector<uint8_t> data;
    if (!fileReader_(path, data))
        return false;
    if (data.size() >= 4 && data[0] == 'M' && data[1] == 'O' && data[2] == 'D' && data[3] == 'B')
    {
        LoadedModule mod;
        if (!parseModb(data, mod))
            return false;
        modules_[name] = std::move(mod);
        return true;
    }
    return loadSource(name, std::string(data.begin(), data.end()));
}
bool ModuleLoader::loadSource(const std::string &name, const std::string &source)
{
    try
    {
        std::string wrapped = source;
        if (wrapped.find("PROGRAM") == std::string::npos)
            wrapped = "PROGRAM _mod_" + name + "\n" + wrapped + "\nENDPROGRAM\n";
        Lexer lex(wrapped);
        auto tokens = lex.tokenize();
        Parser par(tokens);
        auto ast = par.parse();
        Compiler comp;
        auto prog = comp.compile(ast.get());
        LoadedModule mod;
        mod.name = name;
        mod.version = 1;
        mod.exports = prog.exports;
        mod.constants = prog.constants;
        mod.bytecode = prog.bytecode;
        mod.loaded = true;
        modules_[name] = std::move(mod);
        return true;
    }
    catch (const std::exception &e)
    {
        return false;
    }
}
bool ModuleLoader::linkInto(ProgramBinary &program, const std::string &moduleName)
{
    const LoadedModule *mod = getModule(moduleName);
    if (!mod)
        return false;
    uint16_t offset = 0;
    if (!program.bytecode.empty() && program.bytecode.back() == OP_HALT)
    {
        program.bytecode.pop_back();
        offset = (uint16_t)program.bytecode.size();
    }
    else
        offset = (uint16_t)program.bytecode.size();
    uint16_t constOffset = (uint16_t)program.constants.size();
    for (const auto &c : mod->constants)
        program.constants.push_back(c);
    std::vector<uint8_t> reloc = mod->bytecode;
    size_t i = 0;
    while (i < reloc.size())
    {
        uint8_t op = reloc[i++];
        switch (op)
        {
        case OP_PUSH_CONST:
        {
            uint16_t oldId = reloc[i] | (reloc[i + 1] << 8);
            uint16_t newId = oldId + constOffset;
            reloc[i] = newId & 0xFF;
            reloc[i + 1] = (newId >> 8) & 0xFF;
            i += 2;
            break;
        }
        case OP_JMP:
        case OP_JZ:
        case OP_JNZ:
        {
            uint16_t oldAddr = reloc[i] | (reloc[i + 1] << 8);
            uint16_t newAddr = oldAddr + offset;
            reloc[i] = newAddr & 0xFF;
            reloc[i + 1] = (newAddr >> 8) & 0xFF;
            i += 2;
            break;
        }
        case OP_WAIT:
            i += 2;
            break;
        case OP_FUNC_CALL:
        {
            uint16_t oldAddr = reloc[i] | (reloc[i + 1] << 8);
            if (oldAddr != 0xFFFF)
            {
                uint16_t newAddr = oldAddr + offset;
                reloc[i] = newAddr & 0xFF;
                reloc[i + 1] = (newAddr >> 8) & 0xFF;
            }
            i += 3;
            break;
        }
        case OP_CALL:
        case OP_CALL_VOID:
            i += 3;
            break;
        case OP_STORE:
        case OP_LOAD:
        case OP_STORE_LOCAL:
        case OP_LOAD_LOCAL:
        case OP_MAKE_ARRAY:
            i += 1;
            break;
        default:
            break;
        }
    }
    program.bytecode.insert(program.bytecode.end(), reloc.begin(), reloc.end());
    program.bytecode.push_back(OP_HALT);
    for (auto &imp : program.imports)
    {
        if (imp.moduleName != moduleName)
            continue;
        const ExportSymbol *sym = mod->findExport(imp.symbolName);
        if (!sym)
            continue;
        uint16_t resolvedAddr = sym->address + offset;
        if (imp.patchAddress + 1 < program.bytecode.size())
        {
            program.bytecode[imp.patchAddress] = resolvedAddr & 0xFF;
            program.bytecode[imp.patchAddress + 1] = (resolvedAddr >> 8) & 0xFF;
        }
    }
    for (const auto &e : mod->exports)
    {
        FuncEntry fe;
        fe.name = e.name;
        fe.entryPoint = e.address + offset;
        fe.paramCount = e.paramCount;
        program.functions.push_back(fe);
    }
    return true;
}
bool ModuleLoader::resolveImports(ProgramBinary &program, std::string &error)
{
    std::vector<std::string> needed;
    for (const auto &imp : program.imports)
        if (std::find(needed.begin(), needed.end(), imp.moduleName) == needed.end())
            needed.push_back(imp.moduleName);
    for (const auto &modName : needed)
    {
        if (!isLoaded(modName))
            if (!loadBinary(modName))
            {
                error = "Cannot load module: " + modName;
                return false;
            }
        if (!linkInto(program, modName))
        {
            error = "Cannot link module: " + modName;
            return false;
        }
    }
    return true;
}
```

### src\Runtime\ModuleLoader.h
```
#ifndef ESPDSL_MODULE_LOADER_H
#define ESPDSL_MODULE_LOADER_H
#include "../Core/Core.h"
#include "../VM/VM.h"
#include "../Lang/Lexer.h"
#include "../Lang/Parser.h"
#include "../Lang/Compiler.h"
#include <map>
#include <functional>
struct LoadedModule
{
    std::string name;
    uint16_t version = 0;
    std::vector<ExportSymbol> exports;
    std::vector<VMValue> constants;
    std::vector<uint8_t> bytecode;
    bool loaded = false;
    const ExportSymbol *findExport(const std::string &fn) const
    {
        for (const auto &e : exports)
            if (e.name == fn)
                return &e;
        return nullptr;
    }
};
using FileReaderFunc = std::function<bool(const std::string &path, std::vector<uint8_t> &out)>;
class ModuleLoader
{
    std::map<std::string, LoadedModule> modules_;
    std::vector<std::string> searchPaths_;
    StringArena arena_;
    FileReaderFunc fileReader_;
    static bool defaultFileReader(const std::string &path, std::vector<uint8_t> &out)
    {
        std::ifstream f(path, std::ios::binary | std::ios::ate);
        if (!f)
            return false;
        size_t size = f.tellg();
        f.seekg(0);
        out.resize(size);
        f.read(reinterpret_cast<char *>(out.data()), size);
        return true;
    }
    bool parseModb(const std::vector<uint8_t> &data, LoadedModule &mod);
    std::string findFile(const std::string &name);
public:
    ModuleLoader() : fileReader_(defaultFileReader)
    {
        searchPaths_.push_back(".");
        searchPaths_.push_back("modules");
        searchPaths_.push_back("/modules");
    }
    void setFileReader(FileReaderFunc r) { fileReader_ = r; }
    void addSearchPath(const std::string &p) { searchPaths_.push_back(p); }
    bool loadBinary(const std::string &name);
    bool loadSource(const std::string &name, const std::string &source);
    const LoadedModule *getModule(const std::string &name) const
    {
        auto it = modules_.find(name);
        return (it != modules_.end() && it->second.loaded) ? &it->second : nullptr;
    }
    bool isLoaded(const std::string &name) const
    {
        auto it = modules_.find(name);
        return it != modules_.end() && it->second.loaded;
    }
    void unload(const std::string &name) { modules_.erase(name); }
    std::vector<std::string> listLoaded() const
    {
        std::vector<std::string> n;
        for (auto it = modules_.begin(); it != modules_.end(); ++it)
        {
            if (it->second.loaded)
                n.push_back(it->first);
        }
        return n;
    }
    bool linkInto(ProgramBinary &program, const std::string &moduleName);
    bool resolveImports(ProgramBinary &program, std::string &error);
};
extern ModuleLoader g_moduleLoader;
#endif
```

### src\Runtime\RuleEngine.cpp
```
#include "RuleEngine.h"
#include "MessageBus.h"
#include "EventBus.h"
RuleEngine g_ruleEngine;
void RuleEngine::evaluate(MessageBus &msgBus, EventBus &evtBus)
{
    uint8_t order[MAX_RULES];
    uint8_t orderCount = 0;
    for (uint8_t i = 0; i < MAX_RULES; i++)
    {
        if (rules_[i].used && rules_[i].enabled)
            order[orderCount++] = i;
    }
    for (uint8_t i = 1; i < orderCount; i++)
    {
        uint8_t key = order[i];
        int8_t j = (int8_t)i - 1;
        while (j >= 0 && rules_[order[j]].priority < rules_[key].priority)
        {
            order[j + 1] = order[j];
            j--;
        }
        order[j + 1] = key;
    }
    for (uint8_t oi = 0; oi < orderCount; oi++)
    {
        Rule &r = rules_[order[oi]];
        if (r.cooldownMs > 0 && (nowMs_ - r.lastFireMs) < r.cooldownMs)
            continue;
        bool allTrue = true;
        for (uint8_t ci = 0; ci < r.condCount; ci++)
        {
            float val = 0.0f;
            if (r.conditions[ci].metricId < MAX_RULE_METRICS && metricValid_[r.conditions[ci].metricId])
            {
                val = metrics_[r.conditions[ci].metricId];
            }
            if (!r.conditions[ci].eval(val))
            {
                allTrue = false;
                break;
            }
        }
        if (!allTrue)
            continue;
        r.lastFireMs = nowMs_;
        r.fireCount++;
        for (uint8_t ai = 0; ai < r.actionCount; ai++)
        {
            const RuleAction &a = r.actions[ai];
            switch (a.type)
            {
            case RuleActionType::EMIT_EVENT:
                evtBus.emit(a.eventId, INVALID_TASK, a.value);
                break;
            case RuleActionType::SEND_MESSAGE:
                msgBus.send(INVALID_TASK, a.taskId, a.topicId, a.value);
                break;
            case RuleActionType::SET_METRIC:
                setMetric(a.metricId, a.value.toFloat());
                break;
            default:
                break;
            }
        }
    }
}
```

### src\Runtime\RuleEngine.h
```
#ifndef ESPDSL_RULE_ENGINE_H
#define ESPDSL_RULE_ENGINE_H
#include "../Core/Core.h"
#include "RuntimeIds.h"
#include <vector>
#include <tuple>
class MessageBus;
class EventBus;
enum class RuleCondOp : uint8_t
{
    EQ,
    NE,
    GT,
    LT,
    GTE,
    LTE,
    CHANGED,
    CROSS_ABOVE,
    CROSS_BELOW
};
enum class RuleActionType : uint8_t
{
    NONE,
    EMIT_EVENT,
    SEND_MESSAGE,
    SET_METRIC
};
struct RuleCondition
{
    uint8_t metricId;
    RuleCondOp op;
    float threshold;
    float previous;
    bool initialized;
    RuleCondition() : metricId(0), op(RuleCondOp::EQ),
                      threshold(0.0f), previous(0.0f), initialized(false) {}
    bool eval(float current)
    {
        bool r = false;
        switch (op)
        {
        case RuleCondOp::EQ:
            r = floatEqual(current, threshold);
            break;
        case RuleCondOp::NE:
            r = !floatEqual(current, threshold);
            break;
        case RuleCondOp::GT:
            r = current > threshold;
            break;
        case RuleCondOp::LT:
            r = current < threshold;
            break;
        case RuleCondOp::GTE:
            r = current >= threshold;
            break;
        case RuleCondOp::LTE:
            r = current <= threshold;
            break;
        case RuleCondOp::CHANGED:
            r = initialized && !floatEqual(current, previous);
            break;
        case RuleCondOp::CROSS_ABOVE:
            r = initialized && previous <= threshold && current > threshold;
            break;
        case RuleCondOp::CROSS_BELOW:
            r = initialized && previous >= threshold && current < threshold;
            break;
        }
        previous = current;
        initialized = true;
        return r;
    }
};
struct RuleAction
{
    RuleActionType type;
    TaskId taskId;
    TopicId topicId;
    EventId eventId;
    uint8_t metricId;
    VMValue value;
    RuleAction() : type(RuleActionType::NONE), taskId(INVALID_TASK),
                   topicId(0), eventId(0), metricId(0), value(VMValue::None()) {}
};
struct Rule
{
    bool used;
    bool enabled;
    char name[NAME_LEN];
    uint8_t priority;
    uint32_t cooldownMs;
    uint32_t lastFireMs;
    uint32_t fireCount;
    uint8_t condCount;
    RuleCondition conditions[MAX_RULE_CONDS];
    uint8_t actionCount;
    RuleAction actions[MAX_RULE_ACTIONS];
    Rule() : used(false), enabled(true), priority(0),
             cooldownMs(0), lastFireMs(0), fireCount(0),
             condCount(0), actionCount(0)
    {
        memset(name, 0, NAME_LEN);
    }
};
struct RuleEntry
{
    uint8_t index;
    const Rule *rule;
    RuleEntry() : index(0), rule(nullptr) {}
    RuleEntry(uint8_t i, const Rule *r) : index(i), rule(r) {}
};
class RuleEngine
{
    Rule rules_[MAX_RULES];
    float metrics_[MAX_RULE_METRICS];
    bool metricValid_[MAX_RULE_METRICS];
    uint32_t nowMs_;
public:
    RuleEngine() : nowMs_(0)
    {
        for (int i = 0; i < MAX_RULE_METRICS; i++)
        {
            metrics_[i] = 0.0f;
            metricValid_[i] = false;
        }
    }
    void reset()
    {
        for (int i = 0; i < MAX_RULES; i++)
            rules_[i] = Rule();
        for (int i = 0; i < MAX_RULE_METRICS; i++)
        {
            metrics_[i] = 0.0f;
            metricValid_[i] = false;
        }
        nowMs_ = 0;
    }
    void setTime(uint32_t t) { nowMs_ = t; }
    void setMetric(uint8_t id, float v)
    {
        if (id < MAX_RULE_METRICS)
        {
            metrics_[id] = v;
            metricValid_[id] = true;
        }
    }
    float getMetric(uint8_t id) const
    {
        return id < MAX_RULE_METRICS ? metrics_[id] : 0.0f;
    }
    bool isMetricValid(uint8_t id) const
    {
        return id < MAX_RULE_METRICS && metricValid_[id];
    }
    void clearMetric(uint8_t id)
    {
        if (id < MAX_RULE_METRICS)
        {
            metrics_[id] = 0.0f;
            metricValid_[id] = false;
        }
    }
    void clearAllMetrics()
    {
        for (int i = 0; i < MAX_RULE_METRICS; i++)
        {
            metrics_[i] = 0.0f;
            metricValid_[i] = false;
        }
    }
    bool addRule(const Rule &rule, uint8_t &outIdx)
    {
        for (uint8_t i = 0; i < MAX_RULES; i++)
        {
            if (!rules_[i].used)
            {
                rules_[i] = rule;
                rules_[i].used = true;
                outIdx = i;
                return true;
            }
        }
        return false;
    }
    uint8_t ruleCount() const
    {
        uint8_t c = 0;
        for (int i = 0; i < MAX_RULES; i++)
            if (rules_[i].used)
                c++;
        return c;
    }
    void listRules(std::vector<RuleEntry> &out) const
    {
        out.clear();
        for (uint8_t i = 0; i < MAX_RULES; i++)
        {
            if (rules_[i].used)
            {
                out.push_back(RuleEntry(i, &rules_[i]));
            }
        }
    }
    void listAllMetrics(std::vector<std::tuple<uint8_t, float, bool>> &out) const
    {
        out.clear();
        for (uint8_t i = 0; i < MAX_RULE_METRICS; i++)
        {
            if (metricValid_[i])
            {
                out.push_back(std::make_tuple(i, metrics_[i], true));
            }
        }
    }
    bool enableRule(uint8_t idx, bool en)
    {
        if (idx >= MAX_RULES || !rules_[idx].used)
            return false;
        rules_[idx].enabled = en;
        return true;
    }
    bool removeRule(uint8_t idx)
    {
        if (idx >= MAX_RULES || !rules_[idx].used)
            return false;
        rules_[idx] = Rule();
        return true;
    }
    void evaluate(MessageBus &msgBus, EventBus &evtBus);
    void printStats() const
    {
        std::cout << "=== Rules ===\n";
        for (uint8_t i = 0; i < MAX_RULES; i++)
        {
            if (!rules_[i].used)
                continue;
            std::cout << "  [" << (int)i << "] " << rules_[i].name
                      << " prio=" << (int)rules_[i].priority
                      << " fires=" << rules_[i].fireCount
                      << (rules_[i].enabled ? " ON" : " OFF") << "\n";
        }
    }
};
extern RuleEngine g_ruleEngine;
#endif
```

### src\Runtime\Scheduler.cpp
```
#include "Scheduler.h"
```

### src\Runtime\RuntimeIds.h
```
#ifndef ESPDSL_RUNTIME_IDS_H
#define ESPDSL_RUNTIME_IDS_H
#include <stdint.h>
#include <string.h>
using TaskId = uint8_t;
using EventId = uint16_t;
using TopicId = uint16_t;
static constexpr TaskId INVALID_TASK = 0xFF;
static constexpr EventId EVENT_ANY = 0xFFFF;
static constexpr TopicId TOPIC_ANY = 0xFFFF;
static constexpr uint8_t MAX_TASKS = 16;
static constexpr uint8_t MAX_RULES = 16;
static constexpr uint8_t MAX_RULE_CONDS = 4;
static constexpr uint8_t MAX_RULE_ACTIONS = 4;
static constexpr uint8_t MAX_SCHEDULES = 16;
static constexpr uint8_t MAX_EVENT_SUBS = 32;
static constexpr uint8_t MAX_EVENT_CALLBACKS = 8;
static constexpr uint8_t MAX_EVENT_QUEUE = 32;
static constexpr uint8_t MAX_EVENT_LOG = 64;
static constexpr uint8_t MAX_MAILBOX_MSG = 16;
static constexpr uint8_t MAX_BREAKPOINTS = 16;
static constexpr uint8_t MAX_WATCHES = 16;
static constexpr uint16_t MAX_EXEC_LOG = 128;
static constexpr uint8_t MAX_PROFILE_FUNCS = 32;
static constexpr uint8_t MAX_RULE_METRICS = 32;
static constexpr uint8_t NAME_LEN = 24;
inline void rtCopyName(char *dst, const char *src, size_t cap = NAME_LEN)
{
    if (!dst || !cap)
        return;
    if (!src)
    {
        dst[0] = 0;
        return;
    }
    size_t i = 0;
    for (; i + 1 < cap && src[i]; ++i)
        dst[i] = src[i];
    dst[i] = 0;
}
inline bool rtNameEq(const char *a, const char *b) { return a && b && strncmp(a, b, NAME_LEN) == 0; }
#endif
```

### src\Runtime\Scheduler.h
```
#ifndef ESPDSL_SCHEDULER_H
#define ESPDSL_SCHEDULER_H
#include "../VM/VM.h"
#include "../Core/Logger.h"
#include "RuntimeIds.h"
#include "MessageBus.h"
#include "EventBus.h"
#include "RuleEngine.h"
enum class TaskPriority : uint8_t {
    TASK_CRITICAL = 0,
    TASK_HIGH     = 1,
    TASK_NORMAL   = 2,
    TASK_LOW      = 3,
    TASK_IDLE     = 4
};
struct RtTask {
    bool used;
    bool active;
    bool halted;
    bool paused;
    TaskId id;
    char name[NAME_LEN];
    TaskPriority priority;
    uint32_t sliceBudget;
    VMContext ctx;
    uint32_t runCount;
    uint32_t errorCount;
    RtTask()
        : used(false),
          active(false),
          halted(false),
          paused(false),
          id(INVALID_TASK),
          priority(TaskPriority::TASK_NORMAL),
          sliceBudget(10000),
          runCount(0),
          errorCount(0) {
        memset(name, 0, NAME_LEN);
    }
};
class Scheduler {
    VirtualMachine* vm_;
    RtTask tasks_[MAX_TASKS];
    uint8_t buildRunnable(TaskId out[], uint32_t now) {
        uint8_t c = 0;
        for (TaskId i = 0; i < MAX_TASKS; i++) {
            RtTask& t = tasks_[i];
            if (!t.used || !t.active || t.halted || t.paused) continue;
            if (t.ctx.waitUntil > 0 && !timeReached(now, t.ctx.waitUntil)) continue;
            out[c++] = i;
        }
        return c;
    }
    void sortByPriority(TaskId ids[], uint8_t cnt) {
        for (uint8_t i = 1; i < cnt; i++) {
            TaskId key = ids[i];
            int8_t j = (int8_t)i - 1;
            while (j >= 0 &&
                   (uint8_t)tasks_[ids[j]].priority > (uint8_t)tasks_[key].priority) {
                ids[j + 1] = ids[j];
                j--;
            }
            ids[j + 1] = key;
        }
    }
public:
    Scheduler(VirtualMachine* vm) : vm_(vm) {}
    TaskId addTask(const char* name,
                   uint16_t entry,
                   TaskPriority prio = TaskPriority::TASK_NORMAL,
                   uint32_t budget = 10000,
                   const ResourceQuota& quota = QuotaProfiles::standard()) {
        for (TaskId i = 0; i < MAX_TASKS; i++) {
            if (!tasks_[i].used) {
                tasks_[i] = RtTask();
                tasks_[i].used = true;
                tasks_[i].active = true;
                tasks_[i].halted = false;
                tasks_[i].paused = false;
                tasks_[i].id = i;
                tasks_[i].priority = prio;
                tasks_[i].sliceBudget = budget;
                tasks_[i].ctx = VMContext(quota);
                tasks_[i].ctx.ip = entry;
                rtCopyName(tasks_[i].name, name);
                g_messageBus.createMailbox(i);
                return i;
            }
        }
        return INVALID_TASK;
    }
    bool pauseTask(TaskId id) {
        if (id >= MAX_TASKS || !tasks_[id].used) return false;
        tasks_[id].paused = true;
        return true;
    }
    bool resumeTask(TaskId id) {
        if (id >= MAX_TASKS || !tasks_[id].used) return false;
        tasks_[id].paused = false;
        return true;
    }
    bool removeTask(TaskId id) {
        if (id >= MAX_TASKS || !tasks_[id].used) return false;
        g_messageBus.destroyMailbox(id);
        tasks_[id] = RtTask();
        return true;
    }
    RtTask* getTask(TaskId id) {
        return (id < MAX_TASKS && tasks_[id].used) ? &tasks_[id] : nullptr;
    }
    void tick(uint32_t now) {
        g_messageBus.setTime(now);
        g_eventBus.setTime(now);
        g_ruleEngine.setTime(now);
        g_eventBus.process(g_messageBus, 8);
        g_ruleEngine.evaluate(g_messageBus, g_eventBus);
        TaskId runnable[MAX_TASKS];
        uint8_t cnt = buildRunnable(runnable, now);
        sortByPriority(runnable, cnt);
        for (uint8_t i = 0; i < cnt; i++) {
            RtTask& t = tasks_[runnable[i]];
            VMStatus st = vm_->executeSlice(t.ctx, now, t.sliceBudget);
            t.runCount++;
            switch (st) {
                case VMStatus::HALT:
                    t.halted = true;
                    t.active = false;
                    g_eventBus.emit(1, t.id, VMValue::None());
                    LOG_INFO("Sched", std::string(t.name) + " halted");
                    break;
                case VMStatus::WAIT:
                case VMStatus::YIELD:
                case VMStatus::SLICE_END:
                case VMStatus::BREAKPOINT:
                    break;
                default:
                    if (isError(st)) {
                        t.halted = true;
                        t.active = false;
                        t.errorCount++;
                        g_eventBus.emit(2, t.id, VMValue::Int((int32_t)st));
                        LOG_ERROR("Sched", std::string(t.name) + ": " + statusToString(st));
                        if (!t.ctx.lastTrace.empty())
                            LOG_ERROR("Sched", t.ctx.lastTrace.format());
                    }
                    break;
            }
        }
    }
    bool allDone() const {
        for (TaskId i = 0; i < MAX_TASKS; i++) {
            if (tasks_[i].used &&
                tasks_[i].active &&
                !tasks_[i].halted &&
                !tasks_[i].paused)
                return false;
        }
        return true;
    }
    void printStatus() const {
        std::cout << "=== Tasks ===\n";
        for (TaskId i = 0; i < MAX_TASKS; i++) {
            const RtTask& t = tasks_[i];
            if (!t.used) continue;
            std::cout << "  " << t.name
                      << " id=" << (int)t.id
                      << " ip=" << t.ctx.ip
                      << " " << statusToString(t.ctx.status)
                      << " instr=" << t.ctx.usage.instructionsTotal
                      << (t.paused ? " PAUSED" : "")
                      << "\n";
        }
    }
    size_t taskCount() const {
        size_t c = 0;
        for (int i = 0; i < MAX_TASKS; i++) {
            if (tasks_[i].used) c++;
        }
        return c;
    }
};
#endif
```

### src\Runtime\SnapshotManager.h
```
#ifndef ESPDSL_SNAPSHOT_MANAGER_H
#define ESPDSL_SNAPSHOT_MANAGER_H
#include "../Core/Core.h"
#include "../VM/VM.h"
class SnapshotManager
{
    std::string path;
    void writeU16(std::ofstream &f, uint16_t v)
    {
        f.put(v & 0xFF);
        f.put((v >> 8) & 0xFF);
    }
    void writeU32(std::ofstream &f, uint32_t v)
    {
        f.put(v & 0xFF);
        f.put((v >> 8) & 0xFF);
        f.put((v >> 16) & 0xFF);
        f.put((v >> 24) & 0xFF);
    }
    uint16_t readU16(std::ifstream &f)
    {
        uint8_t lo = f.get(), hi = f.get();
        return lo | (hi << 8);
    }
    uint32_t readU32(std::ifstream &f)
    {
        uint8_t a = f.get(), b = f.get(), c = f.get(), d = f.get();
        return a | (b << 8) | (c << 16) | (d << 24);
    }
    void writeVal(std::ofstream &f, const VMValue &v)
    {
        f.put((uint8_t)v.type);
        switch (v.type)
        {
        case ValueType::INT:
            writeU32(f, (uint32_t)v.data.i);
            break;
        case ValueType::FLOAT:
        {
            uint32_t bits;
            memcpy(&bits, &v.data.f, 4);
            writeU32(f, bits);
            break;
        }
        case ValueType::BOOL:
            f.put(v.data.b ? 1 : 0);
            break;
        case ValueType::STRING:
        {
            std::string s = v.data.s ? v.data.s : "";
            writeU16(f, (uint16_t)s.size());
            f.write(s.data(), s.size());
            break;
        }
        default:
            break;
        }
    }
    VMValue readVal(std::ifstream &f, std::shared_ptr<StringArena> arena)
    {
        uint8_t type = f.get();
        switch ((ValueType)type)
        {
        case ValueType::INT:
            return VMValue::Int((int32_t)readU32(f));
        case ValueType::FLOAT:
        {
            uint32_t b = readU32(f);
            float fv;
            memcpy(&fv, &b, 4);
            return VMValue::Float(fv);
        }
        case ValueType::BOOL:
            return VMValue::Bool(f.get() != 0);
        case ValueType::STRING:
        {
            uint16_t l = readU16(f);
            std::string s(l, '\0');
            f.read(&s[0], l);
            return VMValue::Str(arena->intern(s));
        }
        default:
            return VMValue::None();
        }
    }
public:
    SnapshotManager(const std::string &p = "snapshots/") : path(p) {}
    bool save(const std::string &name, const VMSnapshot &snap)
    {
        std::ofstream f(path + name + ".snap", std::ios::binary);
        if (!f)
            return false;
        f.write("SNAP", 4);
        writeU32(f, (uint32_t)snap.ip);
        writeU16(f, (uint16_t)snap.sp);
        writeU16(f, (uint16_t)snap.fp);
        f.put((uint8_t)snap.status);
        writeU32(f, snap.waitUntil);
        writeU16(f, (uint16_t)snap.stack.size());
        for (const auto &v : snap.stack)
            writeVal(f, v);
        writeU16(f, (uint16_t)snap.vars.size());
        for (const auto &v : snap.vars)
            writeVal(f, v);
        writeU16(f, (uint16_t)snap.frames.size());
        for (const auto &fr : snap.frames)
        {
            writeU32(f, (uint32_t)fr.retAddr);
            writeU16(f, (uint16_t)fr.stackBase);
            f.put(fr.localCnt);
            for (const auto &l : fr.locals)
                writeVal(f, l);
        }
        return true;
    }
    bool load(const std::string &name, VMSnapshot &snap, std::shared_ptr<StringArena> arena)
    {
        std::ifstream f(path + name + ".snap", std::ios::binary);
        if (!f)
            return false;
        char magic[4];
        f.read(magic, 4);
        if (std::string(magic, 4) != "SNAP")
            return false;
        snap.ip = readU32(f);
        snap.sp = (int)readU16(f);
        snap.fp = (int)readU16(f);
        snap.status = (VMStatus)f.get();
        snap.waitUntil = readU32(f);
        uint16_t sc = readU16(f);
        snap.stack.resize(sc);
        for (auto &v : snap.stack)
            v = readVal(f, arena);
        uint16_t vc = readU16(f);
        snap.vars.resize(vc);
        for (auto &v : snap.vars)
            v = readVal(f, arena);
        uint16_t fc = readU16(f);
        snap.frames.resize(fc);
        for (auto &fr : snap.frames)
        {
            fr.retAddr = readU32(f);
            fr.stackBase = (int)readU16(f);
            fr.localCnt = f.get();
            fr.locals.resize(32);
            for (auto &l : fr.locals)
                l = readVal(f, arena);
        }
        return true;
    }
};
#endif
```

### src\Security\AccessControl.h
```
#ifndef ESPDSL_ACCESS_CONTROL_H
#define ESPDSL_ACCESS_CONTROL_H
#include <string>
#include <set>
#include <map>
enum class Permission : uint8_t
{
    GPIO_READ,
    GPIO_WRITE,
    NETWORK,
    STORAGE,
    SYSTEM
};
struct AccessPolicy
{
    std::string name;
    std::set<Permission> allowed;
    std::set<std::string> allowedModules;
    bool hasPermission(Permission p) const { return allowed.count(p) > 0; }
    bool canAccessModule(const std::string &m) const { return allowedModules.empty() || allowedModules.count(m) > 0; }
};
struct AccessPolicies
{
    static AccessPolicy full() { return {"full", {Permission::GPIO_READ, Permission::GPIO_WRITE, Permission::NETWORK, Permission::STORAGE, Permission::SYSTEM}, {}}; }
    static AccessPolicy sandbox() { return {"sandbox", {}, {"serial", "math", "str", "time"}}; }
};
class AccessControlManager
{
    std::map<std::string, AccessPolicy> taskPolicies;
    AccessPolicy defaultPolicy = AccessPolicies::full();
public:
    void setDefault(const AccessPolicy &p) { defaultPolicy = p; }
    void setTaskPolicy(const std::string &task, const AccessPolicy &p) { taskPolicies[task] = p; }
    bool checkModule(const std::string &task, const std::string &mod) const
    {
        auto it = taskPolicies.find(task);
        return (it != taskPolicies.end()) ? it->second.canAccessModule(mod) : defaultPolicy.canAccessModule(mod);
    }
};
extern AccessControlManager g_accessControl;
#endif
```

### src\Security\ScriptSigner.h
```
#ifndef ESPDSL_SCRIPT_SIGNER_H
#define ESPDSL_SCRIPT_SIGNER_H
#include <string>
#include <vector>
#include <cstdint>
class ScriptSigner
{
    std::string key;
    static uint32_t hash32(const uint8_t *data, size_t len, uint32_t seed = 0x811c9dc5)
    {
        uint32_t h = seed;
        for (size_t i = 0; i < len; i++)
        {
            h ^= data[i];
            h *= 0x01000193;
        }
        return h;
    }
public:
    ScriptSigner(const std::string &k = "espdsl-key") : key(k) {}
    void setKey(const std::string &k) { key = k; }
    std::vector<uint8_t> sign(const std::vector<uint8_t> &bc) const
    {
        std::vector<uint8_t> combined(key.begin(), key.end());
        combined.insert(combined.end(), bc.begin(), bc.end());
        uint32_t h1 = hash32(combined.data(), combined.size());
        uint32_t h2 = hash32(combined.data(), combined.size(), h1);
        return {(uint8_t)(h1), (uint8_t)(h1 >> 8), (uint8_t)(h1 >> 16), (uint8_t)(h1 >> 24), (uint8_t)(h2), (uint8_t)(h2 >> 8), (uint8_t)(h2 >> 16), (uint8_t)(h2 >> 24)};
    }
    bool verify(const std::vector<uint8_t> &bc, const std::vector<uint8_t> &sig) const
    {
        if (sig.size() != 8)
            return false;
        auto expected = sign(bc);
        for (int i = 0; i < 8; i++)
            if (expected[i] != sig[i])
                return false;
        return true;
    }
};
#endif
```

### src\Stdlib\MathLib.cpp
```
#include "MathLib.h"#include "../VM/VM.h"#include <cmath>#include <cstdlib>static VMValue m_abs(int c, VMValue *a){    if (c < 1)        return VMValue::Int(0);    return a[0].type == ValueType::INT               ? VMValue::Int(a[0].data.i < 0 ? -a[0].data.i : a[0].data.i)               : VMValue::Float(std::fabs(a[0].toFloat()));}static VMValue m_min(int c, VMValue *a){    if (c < 2)        return VMValue::Int(0);    return a[0].toFloat() < a[1].toFloat() ? a[0] : a[1];}static VMValue m_max(int c, VMValue *a){    if (c < 2)        return VMValue::Int(0);    return a[0].toFloat() > a[1].toFloat() ? a[0] : a[1];}static VMValue m_sqrt(int c, VMValue *a){    return c < 1 ? VMValue::Float(0) : VMValue::Float(std::sqrt(a[0].toFloat()));}static VMValue m_pow(int c, VMValue *a){    return c < 2 ? VMValue::Float(0) : VMValue::Float(std::pow(a[0].toFloat(), a[1].toFloat()));}static VMValue m_floor(int c, VMValue *a){    return c < 1 ? VMValue::Int(0) : VMValue::Int((int32_t)std::floor(a[0].toFloat()));}static VMValue m_ceil(int c, VMValue *a){    return c < 1 ? VMValue::Int(0) : VMValue::Int((int32_t)std::ceil(a[0].toFloat()));}static VMValue m_round(int c, VMValue *a){    return c < 1 ? VMValue::Int(0) : VMValue::Int((int32_t)std::round(a[0].toFloat()));}static VMValue m_random(int c, VMValue *a){    if (c == 0)        return VMValue::Int(std::rand() % 1000);    if (c == 1)    {        int hi = a[0].toInt();        if (hi <= 0)            return VMValue::Int(0);        return VMValue::Int(std::rand() % (hi + 1));    }    int lo = a[0].toInt();    int hi = a[1].toInt();    if (hi <= lo)        return VMValue::Int(lo);    return VMValue::Int(lo + (std::rand() % (hi - lo + 1)));}static VMValue m_clamp(int c, VMValue *a){    if (c < 3)        return VMValue::Int(0);    float v = a[0].toFloat();    float lo = a[1].toFloat();    float hi = a[2].toFloat();    return VMValue::Float(v < lo ? lo : (v > hi ? hi : v));}static VMValue m_map(int c, VMValue *a){    if (c < 5)        return VMValue::Float(0);    float v = a[0].toFloat();    float il = a[1].toFloat();    float ih = a[2].toFloat();    float ol = a[3].toFloat();    float oh = a[4].toFloat();    if (floatEqual(ih, il))        return VMValue::Float(ol);    return VMValue::Float(ol + (v - il) * (oh - ol) / (ih - il));}static ModuleFuncEntry math_m[] = {    {"abs", m_abs},    {"min", m_min},    {"max", m_max},    {"sqrt", m_sqrt},    {"pow", m_pow},    {"floor", m_floor},    {"ceil", m_ceil},    {"round", m_round},    {"random", m_random},    {"clamp", m_clamp},    {"map", m_map}};void registerMathModule(){    g_moduleRegistry.registerModule({"math", 1, math_m, 11});}
```

### src\Stdlib\MathLib.h
```
#ifndef ESPDSL_MATHLIB_H
#define ESPDSL_MATHLIB_H
void registerMathModule();
#endif
```

