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
| `app/main.cjs` | Electron 主进程：单实例锁、只读目录回退、自定义 `thunder68://driver` 协议与防闪屏初始主题注入、WebHID 过滤与枚举分类、配置方案库与偏好 IPC、系统托盘常驻、全局快捷键、2.4G 低电轻提示、`--minimized` 与 `--self-test` 入口 |
| `app/local-core.cjs` | 纯逻辑核心模块：VID/PID 与配置接口判定、蓝牙/非配置枚举分类、诊断日志脱敏、URL 与路径防穿越、方案文件原子存储、偏好与多屏窗口几何校验、低电滞回判定、打包排除清单 |
| `app/profile-core.js` | 浏览器与 Node 双端复用的 UMD 方案核心：剥离运行态字段的快照清洗、68 键与参数范围校验、官方 `#fileInput` 导入体构造、双方案差异对比（Diff） |
| `app/preload.cjs` | 隔离的 `contextBridge` 桥接：向渲染层暴露版本号、诊断上报/读取、主题同步、设备状态上报、配置方案库 IPC 与伴侣偏好 IPC |
| `app/shell-helpers.js` | 浏览器与 Node 双端复用的 UMD 辅助模块：双语标签匹配与结构兜底、2.4G 电量解析、按键分类器、四分类精准排障判定、热插拔设备判定、暗/浅色行程徽章配色、HID 反馈节流、重新读取核对状态机 |
| `app/desktop.js` | 渲染层 WebHID 诊断与反馈事件桥接（含完整 `error.name` 透传、会话 HID 计数器与脱敏内存事件环） |
| `app/vendor-bridge.js` | 受限的 React/Redux 读取与选键桥接（不修改官方 bundle） |
| `app/ui.js` | 桌面工作台外壳：顶栏、侧边导航与伴侣工具宿主、热插拔重连浮条、四分类排障卡片、侧滑连接诊断中心、主题切换、可搜索按键分配器与重新读取核对流程 |
| `app/profiles-panel.js` | 本地配置方案库 UI：快照捕获、JSON 导入导出、Diff 对比表格、带自动回滚与 `config.mask` 防并发守卫的原生 `#fileInput` 写入 |
| `app/key-tester.js` | 浏览器与 Node 双端复用的纯自研离线按键与磁轴手感校验器：68 键矩阵、NKRO 统计、`<15ms`/`<25ms` RT 连击检测、FPS `A/D` & `W/S` 急停 SOCD 重叠分析器 |
| `app/companion-panel.js` | 桌面伴侣设置面板：托盘最小化、开机静默自启（`--minimized`）、防闪屏主题/窗口记忆、全局热键与 2.4G 低电量提醒配置 |
| `app/assets/` | 自研 MIT 简约矢量/PNG 托盘与应用图标（严禁挪用官方商标） |
| `app/desktop.css` | 主题变量（暗色/浅色）、窄屏可折叠排障条与全套桌面工作台/伴侣工具样式；**注意必须保留 `#root .sidebar > .modal-overlay` 弹窗放行规则及 `#fileInput` 移出视口策略** |
| `app/redesign-audit.cjs` | 仅开发期使用的 UI/主题自动化审计模块（打包时由 `shouldPackageAppFile` 自动排除） |

### `scripts/`

| 脚本 | 职责 |
| --- | --- |
| `scripts/sync-official.cjs` | 从官网拉取静态资源到 `app/vendor/` 并生成 `manifest.json`；支持 `--force` 强制重拉并清理过期陈旧文件 |
| `scripts/download-runtime.cjs` | 手动下载官方 Electron 运行时 zip（支持 `--mirror` 镜像加速）并按 `node_modules/electron/checksums.json` 校验 SHA256 |
| `scripts/build-portable.cjs` | 校验依赖完整性，镜像同步 Electron 运行时与 `app/` 到 `release/Thunder68-Local/`，自动裁剪 `locales/` 仅保留 `zh-CN.pak` 与 `en-US.pak` 并输出瘦身体积统计 |
| `scripts/audit-package.cjs` | 静态核验 `app/vendor/manifest.json` 哈希、`research/asset-paths.json` 路由可达性以及 `release/` 打包副本一致性，报告写入 `output/package-audit.json` |
| `scripts/check-compliance.cjs` | Git 静态合规守卫：确保 `git ls-files` 不含 `app/vendor/`、`research/decoded.js`、打包产物与本地运行数据 |

## 4. 常用开发、测试与打包命令

```powershell
# 安装依赖与首次同步官方资产
npm ci
npm run sync
# 如需强制重新拉取并清理过期旧资源
node scripts/sync-official.cjs --force

# 运行干净环境单元测试（node:test，当前覆盖 42 项用例，无需 app/vendor/）
npm test

# 静态合规检查与本地官方资产 SHA256 校验
npm run check:compliance
npm run test:vendor

# 本地启动开发调试
npm start

# 构建瘦身便携版并执行静态打包一致性审计
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
