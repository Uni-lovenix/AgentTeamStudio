# Agent Team Studio

Agent Team Studio 是一个跨平台桌面应用，支持 Windows 和 macOS。用户粘贴项目的功能或需求描述后，应用会生成一个多智能体团队配置；用户可以继续编辑角色、协作流程和工程约定，最后把配置写入现有的项目目录。

生成的配置包含两个文件：

- `AGENTS.md`：供人和 AI agent 阅读的团队说明与协作规范。
- `agents.json`：机器可读的团队配置，schema version 为 1。

当前版本只负责团队配置的生成和导出，不执行多智能体工作流。

## 下载与直接使用

以下 release 包已生成在仓库 `dist/` 目录中，可直接下载使用：

| 平台 | 包 | 说明 |
| --- | --- | --- |
| macOS Apple Silicon | [AgentTeamStudio-0.1.0-mac-arm64.zip](dist/AgentTeamStudio-0.1.0-mac-arm64.zip) | 解压后将 `Agent Team Studio.app` 拖入“应用程序” |
| Windows x64 | [AgentTeamStudio-0.1.0-win-x64.exe](dist/AgentTeamStudio-0.1.0-win-x64.exe) | 双击运行 NSIS 安装程序 |
| Windows ARM64 | [AgentTeamStudio-0.1.0-win-arm64.exe](dist/AgentTeamStudio-0.1.0-win-arm64.exe) | 适用于 ARM64 Windows 设备 |
| 校验文件 | [SHA256SUMS.txt](dist/SHA256SUMS.txt) | 下载后可用 `shasum -a 256 -c SHA256SUMS.txt` 校验 |

> 当前包未做 Apple 和 Microsoft 代码签名。macOS 首次打开时如被 Gatekeeper 拦截，可在 Finder 中右键应用并选择“打开”；Windows SmartScreen 提示时选择“仍要运行”。

## 功能

- 输入项目名称、需求描述和技术栈提示。
- 本地模板自动识别 web、backend、mobile、desktop、AI/data、CLI 等项目类型。
- 可选 OpenAI 兼容 LLM 生成更贴合需求的团队配置。
- 编辑角色名称、使命、职责、技能、工具、交付物、依赖和通知关系。
- 编辑协作流程和分支、提交、PR、测试、文档约定。
- 将配置原子写入用户选择的已有项目目录。
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
3. 点击“生成团队”，应用会先使用本地模板生成。
4. 如需 LLM 生成，在设置中启用 LLM 并配置 Base URL、模型和 API Key。
5. 在团队预览中调整角色、流程和约定。
6. 点击“选择项目目录”，指定一个已有的项目目录。
7. 点击“写入项目目录”，应用会生成 `AGENTS.md` 和 `agents.json`。
8. 如果目录中已存在同名文件，应用会要求确认后才覆盖。

重置按钮只清除应用本地的项目草稿和设置，不会删除或修改目标项目目录中的文件。

## LLM 配置

LLM 默认关闭。设置面板支持：

- `Base URL`：OpenAI 兼容接口地址，例如 `https://api.openai.com/v1`。
- `Model`：例如 `gpt-4o-mini`，可按服务商填写。
- `API Key`：通过 Electron `safeStorage` 加密保存在本地。

LLM 返回结果会经过结构校验。如果请求失败、超时或返回格式无效，应用会自动回退到本地模板，并在界面中显示警告。

## 生成文件示例

`agents.json` 中的单个角色结构如下：

```json
{
  "id": "role-id",
  "name": "后端工程师",
  "mission": "实现服务端能力、数据存储、API 契约和业务逻辑。",
  "responsibilities": ["实现业务 API", "设计数据模型"],
  "skills": ["后端开发", "数据库设计"],
  "tools": ["编辑器", "API 调试工具"],
  "deliverables": ["可运行服务", "API 文档"],
  "dependsOn": ["架构师"],
  "notifies": ["QA 工程师"]
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
- `npm test`（16 个测试用例）
- `npm run build`
- `bash init.sh`
- `bash scripts/benchmark.sh`
- `npm run dev` Electron 窗口启动
- `npm run dist:mac` macOS ZIP 应用包构建
- `npm run dist:win` Windows x64/ARM64 NSIS 安装包构建

Windows x64/ARM64 安装包已在当前仓库的 `dist/` 目录中生成；实际 Windows 系统上的安装和冒烟测试仍建议在 Windows 或 CI 环境执行。
