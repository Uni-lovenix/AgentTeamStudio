# Agent Team Studio

Agent Team Studio 是一个跨平台桌面应用，支持 Windows 和 macOS。用户粘贴项目的功能或需求描述后，应用会生成一个多智能体团队配置；用户可以继续编辑角色、协作流程和工程约定，最后把配置写入现有的项目目录。

生成的配置：

- `AGENTS.team.md`：供人和 AI agent 阅读的团队说明与协作规范。
- `agents.json`：机器可读的团队配置，schema version 为 1。
- 如果目标目录已存在 `AGENTS.md` 或 `CLAUDE.md`，应用向这些文件追加一行规则入口指向 `AGENTS.team.md`，不会覆盖原有规则。

当前版本只负责团队配置的生成和导出，不执行多智能体工作流。

## 本地生成发布包

`dist/` 是本地构建输出目录，不会上传到 Git。需要发布包时在本机生成：

```bash
npm run dist:mac
npm run dist:win
```

生成后可在本地 `dist/` 找到：

- macOS Apple Silicon：`dist/AgentTeamStudio-0.1.0-mac-arm64.zip`
- Windows x64：`dist/AgentTeamStudio-0.1.0-win-x64.exe`
- Windows ARM64：`dist/AgentTeamStudio-0.1.0-win-arm64.exe`
- 校验文件：`dist/SHA256SUMS.txt`

`SHA256SUMS.txt` 需要按本机最新构建产物重新生成：

```bash
cd dist
shasum -a 256 AgentTeamStudio-0.1.0-mac-arm64.zip AgentTeamStudio-0.1.0-win-x64.exe AgentTeamStudio-0.1.0-win-arm64.exe AgentTeamStudio-0.1.0-win.exe > SHA256SUMS.txt
```

> 当前包未做 Apple 和 Microsoft 代码签名。macOS 首次打开时如被 Gatekeeper 拦截，可在 Finder 中右键应用并选择“打开”；Windows SmartScreen 提示时选择“仍要运行”。

## 功能

- 输入项目名称、需求描述和技术栈提示。
- 本地分析从需求中识别必须完成的责任区块，为每个角色生成使命和具体职责，而不是按前端、后端等实现功能拆分。
- 可选 OpenAI 兼容或 Anthropic/MiniMax 兼容 LLM 生成更贴合需求的团队配置。
- 编辑角色名称、使命、职责、技能、工具、交付物、依赖和通知关系。
- 编辑协作流程和分支、提交、PR、测试、文档约定。
- 将配置原子写入用户选择的已有项目目录，团队配置使用 `AGENTS.team.md`，不覆盖 `AGENTS.md` / `CLAUDE.md`。
- 本地保存多个项目草稿，重启后仍可继续编辑。
- API Key 使用 Electron `safeStorage` 加密保存，不会写入目标项目。
- 内置结构化日志、干净状态重置、基准脚本和清理扫描器。

## 技术栈

- Electron
- React 18
- TypeScript strict mode
- Vite
- Vitest
- electron-builder

## 环境要求

- Node.js 20 或更高版本
- npm

## 快速开始

```bash
npm install
npm run dev
```

也可以直接运行完整初始化流程：

```bash
bash init.sh
```

`init.sh` 会依次执行依赖安装、类型检查、测试、构建、harness 文件检查和清理扫描。

## 使用流程

1. 点击“新建项目”，输入项目名称。
2. 粘贴至少 10 个字符的需求描述，可补充技术栈提示。
3. 点击“生成团队”，应用会先使用需求驱动生成。
4. 如需 LLM 生成，在设置中启用 LLM，选择 OpenAI 兼容或 Anthropic 兼容协议，并配置 Base URL、模型和 API Key。
5. 在团队预览中调整角色、流程和约定。
6. 点击“选择项目目录”，指定一个已有的项目目录。
7. 点击“写入项目目录”，应用会生成 `AGENTS.team.md` 和 `agents.json`。
8. 如果目录中已存在 `AGENTS.team.md` 或 `agents.json`，应用会要求确认后才覆盖。
9. 如果目录中已存在 `AGENTS.md` 或 `CLAUDE.md`，应用会向存在的规则文件追加“使用智能体规则在 AGENTS.team.md 文件”，并保留原内容。

重置按钮只清除应用本地的项目草稿和设置，不会删除或修改目标项目目录中的文件。

## LLM 配置

LLM 默认关闭。设置面板支持：

- `Base URL`：OpenAI 兼容接口地址，例如 `https://api.openai.com/v1`。
- `接口协议`：可选 `OpenAI 兼容` 或 `Anthropic 兼容`。
- `Model`：例如 `gpt-4o-mini`，可按服务商填写。
- `API Key`：通过 Electron `safeStorage` 加密保存在本地。

MiniMax 配置示例：

- OpenAI 兼容：`Base URL` 填 `https://api.minimaxi.com/v1`，协议选 `OpenAI 兼容`，模型填如 `MiniMax-M2.7-highspeed`。
- Anthropic 兼容：`Base URL` 填 `https://api.minimaxi.com/anthropic`，协议选 `Anthropic 兼容`，模型填如 `MiniMax-M2.7-highspeed`。

LLM 返回结果会经过结构校验。如果请求失败、超时或返回格式无效，应用会自动回退到需求驱动生成，并在界面中显示警告。

## 生成文件示例

`agents.json` 中的单个角色结构如下：

```json
{
  "id": "role-id",
  "name": "账户与权限负责人",
  "mission": "保证身份、账户、权限和数据可见范围完整可审计。",
  "responsibilities": ["设计注册、登录、认证、会话和找回流程", "定义用户、角色、权限与数据隔离规则"],
  "skills": ["身份认证", "权限模型", "审计"],
  "tools": ["权限矩阵", "认证方案", "审计清单"],
  "deliverables": ["账户流程说明", "权限矩阵", "审计清单"],
  "dependsOn": ["需求与验收负责人"],
  "notifies": ["交付协调负责人"]
}
```

完整 `TeamConfig` 还包含 `schemaVersion`、`projectName`、`requirement`、`techStackHints`、`generatedBy`、`createdAt`、`workflow`、`agents` 和 `conventions`。

## 开发命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 构建并启动 Electron 应用 |
| `npm run check` | 运行严格 TypeScript 类型检查 |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run build` | 构建 main、preload 和 renderer |
| `npm run dist:mac` | 打包 macOS 应用 |
| `npm run dist:win` | 打包 Windows 应用 |
| `bash scripts/benchmark.sh` | 运行性能基准 |
| `bash scripts/cleanup-scanner.sh` | 检查 stale 文件和 harness 完整性 |

## 项目结构

```text
src/
  main/        Electron 主进程、窗口和 IPC handlers
  preload/     contextBridge API
  renderer/    React 中文界面
  services/    业务逻辑、持久化、LLM、导出
  shared/      共享类型和 IPC channel 定义
test/          Vitest 单元测试
docs/          架构、产品、可靠性、质量文档
scripts/       开发、基准、清理脚本
```

## 验证状态

当前仓库已通过以下验证：

- `npm run check`
- `npm test`（20 个测试用例）
- `npm run build`
- `bash init.sh`
- `bash scripts/benchmark.sh`
- `npm run dev` Electron 窗口启动
- `npm run dist:mac` macOS ZIP 应用包构建
- `npm run dist:win` Windows x64/ARM64 NSIS 安装包构建

Windows x64/ARM64 安装包可通过 `npm run dist:win` 在本地 `dist/` 目录生成；实际 Windows 系统上的安装和冒烟测试仍建议在 Windows 或 CI 环境执行。
