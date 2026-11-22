# AGENTS.md — thunder68-local

本文件为 AI 编码助手与贡献者提供项目定位、版权边界、目录职责及标准验证工作流说明。

## 1. 项目定位与第三方版权边界

- **项目定位**：达尔优雷电68（DAREU Thunder68）官方 WebHID 配置页面的个人离线 Electron 桌面外壳（`thunder68-local`）。通过拦截远程请求并加载本机同步的官方静态资源，实现离线桌面端配置，**不重写底层 WebHID 通信协议**，也不安装或替换 Windows 系统驱动。
- **版权与合规边界（严禁越界）**：
  - 自研代码（Electron 主进程、外壳 UI 适配器、样式、构建与审计脚本、单元测试）采用 **MIT 许可证**（见 `LICENSE`）。
  - 官方前端资产来自 `https://oem.dareu.com/thunder68`，权利归原权利人所有，详见 `THIRD_PARTY_NOTICES.md`。
  - **严禁提交** `app/vendor/`、`app/keyboard-layout.json`、`research/official-main.js`、`research/decoded.js`、`research/decode.cjs`、`research/*.zip`、`release/`、`data/`、`output/` 等被 `.gitignore` 忽略的文件。
  - **严禁修改 `app/vendor/` 下的官方资产**（`npm run audit:package` 会校验 SHA256），更不要为通过校验而盲目重写 `manifest.json`。
  - 不提供含官方资源的公开二进制分发；`release/Thunder68-Local/` 仅供本机使用。
- **已知能力边界**：
  - 在线键盘测试（`kbtest5.driveall.cn`）、在线固件检查与 DFU 升级依赖远程服务，离线版均已拦截且不包含。
  - 核心硬件参数写入（改键、灯效、触发行程/RT、宏、超级按键）及断电/重启持久化仍依赖官方混淆脚本与键盘固件，修改 UI 外壳后不可宣称已完成全项真机写入验证。

## 2. 目录地图

```text
.
├── app/                      # Electron 主进程、预加载桥接、渲染层外壳与本地适配代码
│   └── vendor/               # [Git 忽略] npm run sync 拉取的官方离线静态资产（严禁改动/提交）
├── scripts/                  # 资源同步、Electron 运行时下载、便携打包与静态完整性审计脚本
├── tests/                    # 基于 node:test 的单元测试（核心路径、双语适配、状态机、构建脚本）
├── research/
│   └── asset-paths.json      # 公开的资源来源路径清单（供 sync 与 audit 使用）
├── data/                     # [Git 忽略] 运行期本地资料与 diagnostics.jsonl 诊断日志
├── output/                   # [Git 忽略] package-audit.json / self-test.json 等诊断报告输出
├── release/                  # [Git 忽略] npm run build 生成的便携版目录 Thunder68-Local/
├── .tmp/                     # [Git 忽略] 临时脚本、中间日志与自检暂存目录（用完即删）
├── DEVELOPMENT.md            # 详细的架构与开发维护说明
├── THIRD_PARTY_NOTICES.md    # 第三方资源来源与授权边界声明
├── README.md                 # 中文主说明文档
└── README.en.md              # 英文说明文档
```

## 3. `app/` 与 `scripts/` 职责速查

### `app/`

| 文件 | 职责 |
| --- | --- |
| `app/main.cjs` | Electron 主进程：单实例启动锁、只读目录回退、自定义 `thunder68://driver` 异步协议与 CSP/离线拦截、WebHID 设备过滤与多设备选择对话框、窗口与菜单、`--self-test` 诊断入口 |
| `app/local-core.cjs` | 纯逻辑核心模块：允许的 VID/PID（`0x369b` / 有线 `0x0211` / 2.4G `0x0434`）与配置接口判定、URL 与路径防穿越校验、设备显示标签、可写数据目录探测、打包排除清单 |
| `app/preload.cjs` | 隔离的 `contextBridge` 桥接：向渲染层只读暴露版本号、诊断上报与标题栏主题切换 |
| `app/shell-helpers.js` | 浏览器与 Node 双端复用的 UMD 辅助模块：中英双语标签匹配与结构兜底、2.4G 电量与版本解析、按键分类器、HID 反馈节流控制器、重新读取核对状态机 |
| `app/desktop.js` | 渲染层 WebHID 诊断与反馈事件桥接（包装 `requestDevice` / `open` / `close` / `sendReport` / `inputreport`） |
| `app/vendor-bridge.js` | 受限的 React/Redux 读取与选键桥接（不修改官方 bundle） |
| `app/ui.js` | 桌面工作台外壳：顶栏、侧边导航、主题切换、欢迎页、可搜索按键分配器、底栏导入配置与重新读取核对流程 |
| `app/desktop.css` | 主题变量（暗色/浅色）与全套桌面工作台样式覆盖；**注意必须保留 `#root .sidebar > .modal-overlay` 弹窗放行规则及 `#fileInput` 移出视口策略** |
| `app/redesign-audit.cjs` | 仅开发期使用的 UI/主题自动化审计模块（打包时由 `shouldPackageAppFile` 自动排除） |

### `scripts/`

| 脚本 | 职责 |
| --- | --- |
| `scripts/sync-official.cjs` | 从官网拉取静态资源到 `app/vendor/` 并生成 `manifest.json`；支持 `--force` 强制重拉并清理过期陈旧文件 |
| `scripts/download-runtime.cjs` | 手动下载官方 Electron 运行时 zip（支持 `--mirror` 镜像加速）并按 `node_modules/electron/checksums.json` 校验 SHA256 |
| `scripts/build-portable.cjs` | 校验依赖完整性，将 Electron 运行时与 `app/` 镜像同步到 `release/Thunder68-Local/`，自动剔除排除文件与孤儿文件 |
| `scripts/audit-package.cjs` | 静态核验 `app/vendor/manifest.json` 哈希、`research/asset-paths.json` 路由可达性以及 `release/` 打包副本一致性，报告写入 `output/package-audit.json` |

## 4. 常用开发、测试与打包命令

```powershell
# 安装依赖与首次同步官方资产
npm ci
npm run sync
# 如需强制重新拉取并清理过期旧资源
node scripts/sync-official.cjs --force

# 运行单元测试（node:test，当前覆盖 23 项用例）
npm test

# 本地启动开发调试
npm start

# 构建便携版并执行静态打包一致性审计
npm run build
npm run audit:package

# Electron 无头自检（不弹窗，输出报告到 output/self-test.json）
npx electron . --self-test --background-test
```

## 5. `.tmp/` 临时目录与 Git 纪律

- 临时脚本、中间日志、调试快照统一写入 `.tmp/` 目录（已加入 `.gitignore`），**任务结束前必须清理删除 `.tmp/` 内生成物**，不得污染工作区根目录。
- 如运行 `npm run audit:package` 或无头自检生成了 `output/` 下报告，无需纳入版本控制（已由 `.gitignore` 忽略）。
- Commit Message 遵循 Angular 规范并使用简体中文描述（如 `style(ui): ...`、`docs: ...`、`fix(main): ...`）。
- 严禁改动 `app/vendor/` 下任何官方文件；修改 `app/` 后务必完整复跑 `npm test`、`npm run build`、`npm run audit:package` 与无头自检。
