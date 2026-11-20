# DSH Desktop 项目说明与快捷命令

本文面向新加入的开发者，一页汇总项目定位、目录结构，以及日常开发、验证、打包的常用命令。命令均摘自根目录 `package.json` 的 `scripts`（本文对应 0.12.1 时期的 scripts，应用版本已统一为 0.1.0）；依赖升级后以 `package.json` 实际内容为准。

运行架构的完整设计见[运行架构](architecture.md)，更细的开发流程见[开发指南](development.md)。

## 项目说明

### 定位

DSH Desktop（DSH 客户端）是 Dataelem 团队基于 DeepSeek Harness 框架打造的桌面 Agent 应用：**Electron 宿主复用 Harness 运行时和 Web UI**，不自建第二套 Agent runtime 或独立业务前端。桌面增强能力（工作台、市场、Office、品牌 UI 等）以 `packages/` 宿主插件和补丁层注入 Harness。

开源版基于上游基线 `@deepseek-ai/dsh@0.2.2-rc.1`。官方 Desktop 与 Host 按模块改写进本仓库，逐文件登记在根目录 `upstream-baseline.json`（含有意差异与跳过项），由 `test/upstream/baseline.test.ts` 校验漂移。对第三方依赖的兼容修改一律放在 `patches/`，经 `postinstall` 的 patch-package 重放，不直接改 `node_modules`。

### 进程拓扑

| 进程 | 入口与产物 | 职责 |
| --- | --- | --- |
| Electron 主进程 | `src/main/shell/app.ts` → `out/main/index.js` | 应用生命周期、窗口编排、Profile 与 generation 投影、Host 子进程拉起、Safe Mode、插件恢复、更新、手机桥接 |
| Harness 子进程 | `src/host/index.ts` → `out/main/host.js` | 主进程以 `ELECTRON_RUN_AS_NODE=1` 启动的 Node 模式进程；加载 Profile，在本机回环端口运行 Harness（Agent 后端与 Web UI），经 stdout 回报启动状态 |
| 渲染窗口 | Harness Web UI + `src/preload/app.ts` → `out/preload/app.cjs` | 沙箱 BrowserWindow 加载 Harness Web UI；preload 只暴露具名窄桥，特权操作经 IPC 交给主进程 |

跨进程数据契约与纯逻辑集中在 `src/shared/`，可序列化、不依赖 Electron 与 Node 特权 API。渲染窗口没有独立的前端构建（无 Vite renderer 入口），UI 来自 Harness Web UI。

### 目录地图

| 目录 | 职责 |
| --- | --- |
| `src/main/` | 原生能力、运行时编排、Profile、更新、手机桥接和企业登录；正式主进程在 `src/main/shell/` |
| `src/host/` | Harness 子进程入口，不导入 Electron |
| `src/preload/` | 窄 IPC 桥和桌面 UI 接缝（引导页、启动失败页、标题栏等独立入口） |
| `src/shared/` | 跨进程数据契约和纯逻辑 |
| `packages/` | 宿主插件（client-ui、workbenches、market-installer、office、onboarding、preset-transfer、hmr-fallback、log-bridge、image-generation、gis）与 `ppt-runtime/` PPT 运行时源码 |
| `patches/` | 对第三方依赖的可重放 patch-package 兼容补丁 |
| `build/` | 打包输入：独立 HTML 页面（splash、safe-mode、恢复等）、图标、NSIS 脚本、Office CLI、pnpm 调用入口；不是可整体清空的生成目录 |
| `scripts/`、`test/` | 构建发布工具；行为与契约回归测试（`test/shell/` 壳行为、`test/host/` Host 子进程、`test/profile/`、`test/upstream/` 等） |

### 主要能力

细节见 [README](../README.md)，此处一行速览：

- **主流模型适配**：模型提供方配置、模型搜索、图片输入、推理能力配置。
- **Office 三件套模板**：Word 套版、Excel 案例工作簿、PPT 可编辑模板，输出 DOCX / XLSX / PPTX。
- **启动异常与插件故障恢复**：引导恢复、安全模式、修复 Agent 入口。
- **工作台**：市场安装与本地导入业务应用，复用 Harness 会话交互。
- **Agent Preset 迁移**：`.dshpreset` 包导入导出，契约见 [Preset 包格式](preset-packages.md)。
- **手机连接**：扫码配对，局域网或可选公网隧道继续会话。
- **原生桌面体验**：自动管理 Harness 启停、自动更新检查、原生菜单与窗口。

## 快捷启动命令

### 环境要求

- Node.js 22 或更高、npm
- Windows x64 或 macOS（Apple Silicon / Intel）
- 详细前置说明见[开发指南](development.md)

### 首次启动与开发模式

```bash
npm ci        # postinstall：回放 patches/ 补丁、注入品牌资源、安装 Electron；必须确认完整成功
npm run dev   # 先执行 office:prepare 与 ppt:build，再 electron-vite dev 启动壳与 Host
```

- 开发构建使用独立应用名 `DSH Desktop Dev` 与独立用户数据目录，不污染正式版数据。
- 多个开发 worktree 默认共享同一开发 Profile；涉及 Profile、插件、迁移或恢复的验证不要并行修改同一份数据，并发调试用下方环境变量区分。
- `npm run dev`、`npm run build`、`npm test`、`npm run test:watch` 都会先准备 Office 运行时与模板（哈希锁定的 Python/wheel 下载到 `.build/office-runtime`）和 PPT 运行时（`.build/ppt-runtime`）。

### 开发环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DSH_DEV_PROFILE` | `dsh-desktop-dev` | 开发 Profile 目录名；多 worktree 并发时各自取名 |
| `DSH_DEV_HARNESS_PORT` | `43130` | 开发模式 Harness 回环端口（1024–65535） |
| `DSH_DEV_MOBILE_PORT` | `43128` | 开发模式手机桥端口（1024–65535） |
| `DSH_TUNNEL_FORCE_PINGGY=1` | — | 强制手机桥走 Pinggy 隧道，验证 Cloudflare → Pinggy 回退 |
| `DSH_DESKTOP_PRIMARY_RUNTIME_DIR` | 仓库内 `.build/office-runtime/primary-runtime` | 仅开发期覆盖 Office 主运行时；安装包固定用 `Resources/office-runtime/primary-runtime`，忽略该覆盖 |

PowerShell 通过 `$env:DSH_DEV_PROFILE` 等方式设置；以上覆盖均被正式构建忽略。

### 验证

提交或交付前：

| 命令 | 作用 |
| --- | --- |
| `npm test` | 完整 vitest 回归（`pretest` 先准备 Office/PPT 资源） |
| `npm test -- test/<name>.test.ts` | 按实际改动选择相关回归文件 |
| `npm run typecheck` | `tsc --noEmit`；覆盖配置及 `src/main`、`src/host`、`src/preload`、`src/shared` 与 TS 测试，插件 JS、脚本和 HTML 不在覆盖范围 |
| `npm run build` | 正式入口编译；只证明能编译，安装与进入工作区要单独验收 |
| `git diff --check` | 提交前空白检查 |

- 本仓库没有 `npm run lint` 或 `npm run format:check`，不得报告它们通过。
- Windows 上部分套件必须串行运行（`vitest.config.ts` 的 `WINDOWS_SERIAL_SUITES`），包括会启动真实 Electron / Host 子进程的 `test/shell/` Electron 用例与 `test/host/` 全部用例。

### 打包

所有安装包都在目标操作系统与架构上本机构建，`scripts/verify/verify-target.mjs` 会拒绝 host 与 target 不匹配；本地打包成功不等于正式发布（正式发布由推送 `v*` tag 触发 CI 构建、签名并发布，见[发布手册](release-runbook.md)）。

本地调试（未签名）：

| 命令 | 产物 |
| --- | --- |
| `npm run package:dir` | 当前平台目录包（正式身份） |
| `npm run package:dev:dir` | 当前平台目录包（开发身份） |
| `npm run package:dev:mac:arm64` | macOS Apple Silicon 未签名开发包 |
| `npm run package:dev:mac:x64` | macOS Intel 未签名开发包 |
| `npm run package:dev:win` | Windows x64 未签名开发包 |
| `npm run package:dev:linux:x64` | Linux x64 开发身份 deb |

正式签名包（均 `--publish never`，不在本地发布）：

| 命令 | 产物 |
| --- | --- |
| `npm run package:mac` | macOS 正式包（架构目标随 electron-builder 默认配置） |
| `npm run package:mac:arm64` | macOS Apple Silicon 正式包 |
| `npm run package:mac:x64` | macOS Intel 正式包 |
| `npm run package:win` | Windows x64 正式 NSIS 安装包 |
| `npm run package:linux:x64` | Linux x64 deb（UOS V20 目标本机打包，非正式发布渠道） |

### 资源与素材

| 命令 | 作用 |
| --- | --- |
| `npm run office:prepare` | 准备 Office 运行时与模板（dev / build / test 自动前置） |
| `npm run ppt:build` | 准备 PPT 运行时（dev / build / test 自动前置） |
| `npm run icons:generate` | 生成应用图标 |
| `npm run loader:generate` | 生成加载动画 GIF |
| `npm run preview` | 预览构建产物 |

### 故障排查入口

- 正常界面无法进入时，可用 `--safe-mode` 启动安全模式（只加载安装包自带的包），启动示例见 [README](../README.md)。
- 启动、Profile、插件解析各阶段的验收口径见根目录 `AGENTS.md` 与[补丁与插件契约](patch-plugin-contract.md)。

## 延伸阅读

- [运行架构](architecture.md) — 启动流程、持久化数据、安全边界、故障恢复
- [开发指南](development.md) — 本地环境、验证、补丁维护与原生平台打包细节
- [发布手册](release-runbook.md) — 签名与正式发布控制
- [补丁与插件契约](patch-plugin-contract.md) — Patch 与 Plugin 选型、slot 兼容
- 根目录 `AGENTS.md` — 仓库开发约束（目录职责、启动协议、验证要求）
