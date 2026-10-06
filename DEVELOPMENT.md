# 修改本地版的入口与完整性边界

## 这份工程包含什么

这是一份 Electron 桌面外壳工程。公开仓库包含自行开发的界面、外壳、工具和来源路径清单；官网的 HTML、生产 JavaScript bundle、CSS、图片与 JSON 通过 `npm run sync` 获取到本机。当前本机已捕获 220 个官网资源，配置界面与 WebHID 通信逻辑仍来自本地官方程序。

自行开发的代码采用 MIT，第三方资源保留原有权利，见 `LICENSE` 与 `THIRD_PARTY_NOTICES.md`。尚未确认官方资源允许再分发，因此 `app/vendor/`、官方布局 JSON、分析副本、运行资料、截图和便携构建均被 Git 忽略。便携构建保留 Electron 的 `LICENSE` 和 `LICENSES.chromium.html`，另附自研代码的 `PROJECT-LICENSE` 及来源说明；它仅供本机使用，不作为公开仓库的二进制附件发布。

没有拿到达尔优开发时的 React 组件工程、构建配置、TypeScript 类型或 source map。官方生产脚本仍是混淆代码。不要把“所有已发现的静态资源均已保存”理解成“所有功能均经过测试”或“拿到了官网完整源码”。

在线键盘测试依赖 `kbtest5.driveall.cn` 的 iframe。固件版本检查和 DFU 工具下载依赖外部服务。这些没有离线打包，当前程序也不允许加载远程网页或下载固件。按键、灯效、触发等常规设置仍使用本地官方程序；具体写入效果尚未逐项验证。

## 文件对应关系

| 文件 | 用途与适合修改的内容 |
| --- | --- |
| `app/main.cjs` | 窗口、菜单、HID 授权、资源加载、资料目录、诊断和自检入口 |
| `app/local-core.cjs` | 本地网址解析、允许的键盘型号与供应商配置接口 |
| `app/preload.cjs` | 隔离的桌面桥接；发送诊断事件和标题栏主题选择 |
| `app/desktop.js` | 本地提示、附加行为、HID 通信诊断；优先在这里加小功能 |
| `app/desktop.css` | 本地 UI 设计变量、桌面布局与官网控件样式覆盖 |
| `app/ui.js` | 顶栏、侧栏、导航代理和官网内联样式的语义标记 |
| `app/vendor-bridge.js` | 读取当前配置与选择状态的有限接口；只允许已知按键 ID 的选择操作 |
| `app/keyboard-layout.json` | 从当前官方版本导出的 68 键坐标参考，含原始按键 ID 和行列 |
| `app/vendor/thunder68/index.html` | 官网页面入口；额外本地脚本由 `main.cjs` 注入 |
| `app/vendor/thunder68/static/js/main.251ddcbe.js` | 官方原始混淆生产程序，包含界面和键盘通信 |
| `app/vendor/thunder68/static/css/main.b486ec8a.css` | 官网原始样式 |
| `app/vendor/manifest.json` | 每个下载资源的网址、本地路径和 SHA256 |
| `research/asset-paths.json` | 公开的资源来源路径清单，供同步与静态核验使用 |
| `research/official-main.js` | 仅本机保留的官方脚本分析材料，不在公开仓库中 |
| `research/decode.cjs` | 仅本机保留的混淆字符串表分析工具，不是运行或同步依赖 |
| `research/decoded.js` | 仅本机保留的分析副本；不在公开仓库中，不保证可以直接运行 |
| `scripts/build-portable.cjs` | 将 `app` 和 Electron 运行时复制成便携程序 |
| `scripts/audit-package.cjs` | 对照实际资源路由核验下载文件、静态引用和打包副本 |

运行时执行的是 `app/vendor` 中的原始脚本，**不会执行 `research/decoded.js`**。分析副本不适合直接替换生产脚本：字符串解析不等于恢复了完整工程，也没有处理全部混淆与自校验行为。

## 修改和运行

在工程根目录执行：

```powershell
npm ci
npm run sync
npm start
npm test
npm run build
npm run audit:package
```

已有完整本地资源时，无需每次同步。同步直接从官网获取资源，不转发仓库中的第三方副本；任何资源下载失败都会返回非零状态。官网更新可能改变资源或运行结构，静态核验通过后仍需验证连接与界面行为。

修改前版本标签为 `pre-ui-redesign-20261006`。先保存当前工作，再用 `git switch --detach pre-ui-redesign-20261006` 查看或运行旧源码。Git 恢复的是已提交的自研代码；本机忽略的官网资源、配置与运行资料继续保留，其他机器需自行获取官方资源。

修改 `app` 中的源文件，再运行 `npm start` 查看。重新打包后，完全退出便携版再打开新版本，才能让窗口和 HID 授权等主进程改动生效。不要只修改 `release` 中的副本，下一次构建会覆盖它。

`npm run audit:package` 检查静态资源与打包一致性。如果有意改动官方资源，它会报告 SHA256 变化；先确认这正是自己的改动，再决定是否更新资源清单。不要为了让检查通过而无条件重写全部哈希。

本机分析时可在已有的 `research/decoded.js` 中搜索 `sendReport`、`inputreport`、`UPDATE_KEY_VALUES`、`rate`、`lightness`、`fastTrigger` 等；公开克隆没有该文件，也不需要它运行。分析副本仍需整理，不能当成官网源码工程。新增复杂设置时，建议将自己的配置模型与通信模块写成独立文件，并保留合法获取的官方原始副本作本机对照。开机自动恢复设置暂不实现。

## 已完成和未完成的验证

本地界面支持独立的深色、浅色配色和跟随系统，主题选择保存在本地。宽窗口将键盘和编辑面板左右排列，窄窗口上下滚动。修改颜色、字体、间距时编辑 `app/desktop.css` 中 `0.2 workbench` 后的 `--ui-*` 变量；修改导航标题和说明编辑 `app/ui.js` 的 `pages`。设备首页和带搜索的按键分配器是本地重做的组件；键盘保留官方高清拟真图与原 Canvas 点击逻辑。新的分配按钮转发至原控件的点击处理器，搜索不会写入设置，未选择按键时禁止分配。批量操作支持 WASD、字母、全选、反选与逐键取消。

`ui.js` 不搬动 React 节点、不改写通信协议，侧栏点击转发到原有菜单处理器。`vendor-bridge.js` 读取当前 Redux 状态用于显示选择反馈，且只提供受限的清除/选择操作；它依赖当前捕获版本的 React DOM 内部属性和 Redux 状态结构，升级官网程序时必须重新核验。官网内联颜色通过 `data-local-*` 属性映射到本地样式；灯效色盘及颜色控件保留其实际颜色。

标题栏支持拖动，窗口右上角保留 Windows 原生控制按钮。原菜单可按 Alt 显示，F5 可重新加载。界面适配 1024×720 最小窗口，较长配置区域可滚动。

开发时可运行 `node_modules/electron/dist/electron.exe . --self-test --connect-test --ui-audit --background-test`，使用始终隐藏的离屏窗口连接已接入的键盘并只读检查六个主配置页，输出 `output/ui-audit.json`、`output/ui-interactions.json` 和各页截图。交互检查验证官方图上的按键选择、清除、按键搜索及无结果状态。此检查不点击分配功能、恢复默认或重置按钮，也不代替配置写入验证。不加 `--background-test` 时自检会显示窗口。

- 已验证：离线页面加载、USB 配置接口枚举、打开设备、收到多条回复、配置读取提示结束。
- 静态核验：通过应用实际的 URL 解码与文件路径规则验证资源，而不只验证文件存在；已修复中文文件名图标的路径编码问题。
- 未逐项验证：具体改键、灯效参数、触发参数、宏、超级按键的写入与读回；拔插、断电、重启后的行为。
- 尚未实现：开机自动恢复设置。

`--redesign-audit` 可与 `--self-test --connect-test --background-test` 一起运行。它检查深浅主题、系统主题媒体模拟、重载后的主题记忆、三种窗口尺寸和六页导航、灯效面板内部溢出、批量选择、选中参数与当前配置一致、模拟错误提示，以及真实设备重连读回。报告为 `output/redesign-audit.json`，含验证前后的本地配置快照，不应提交。此检查只操作导航、选择与读取，不调整设备参数。截图不能替代这些交互检查；实际参数写入仍需单独验证。

底部“重新读取核对”比较按键映射、触发行程、灯效、超级按键、宏和通用设置等当前配置字段。加载期间等待 68 键数据齐全且数据稳定，再报告比对结果；这一结果不证明断电保存能力。通信协议和官方生产脚本未修改。

`output/package-audit.json` 是最近一次静态打包核验结果。自检报告在 `output/self-test.json`，便携版执行自检时则位于便携目录下的 `output/self-test.json`。`configurationReadComplete` 只表示连接成功、配置界面已出现且读取提示结束，不是完整设备状态逐字段读回比对。
