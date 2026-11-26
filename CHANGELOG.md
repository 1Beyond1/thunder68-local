# 更新日志（Changelog）

本文件记录 `thunder68-local` 的主要版本演进与安全/稳定性修复。版本号遵循语义化版本规范（`MAJOR.MINOR.PATCH`）。

## [0.2.2] - 2026-11-26

### 安全与防砖修复（P0）
- **整机方案导入防砖校验**：在 `app/profile-core.js` 内置达尔优雷电68 完整 68 键官方 ID 白名单，并在 `validateProfileConfig` 与 `applyProfileById` 写入前交叉校验 `keyValues`、`buttonMap.mappingData`（含十六进制 `uid`）、`superkeys`（`socdKeys`/`mtKeys`/`tglKeys`/`mptKeys`/`endKeys`/`dskKeys`/`mappingData`）及 `macroMap.defaultMacros` 关键子结构；在 `sanitizeProfileConfig` 强制将 `lightness.effectId`/`brightness`/`speed` 等参数归一化为 `Number` 并拒绝 `NaN`/越界/非整数模式编号。
- **修复整机写入 `mask` 提前解锁与超时/断连误报成功**：`buildOfficialImportPayload` 保留 `mask: true` 交由硬件收尾帧解锁；重构 `app/profiles-panel.js` 写入监视流程（`evaluateProfileApplyState`），实时跟踪 HID 发包增量、监听 `hid-send-error` 与设备断连状态，严格区分「写入成功（success）/ 超时未确认（warning）/ 写入失败或断连（error）」，严禁超时或失败分支显示绿色成功并诱导立即重读。

### 竞态、同步与功能修复（P1）
- **最小化到托盘后状态与低电提醒持续同步**：`createSyncScheduler` 在 `document.hidden` 时自动降级为低频 `setTimeout`（250ms），避免 Chromium 暂停 `rAF` 导致 2.4G 低电提醒与忙态同步冻结；`app/ui.js` 在隐藏态走轻量 `reportDeviceStatus()` 跳过重 DOM 测量；主进程托盘/快捷键切方案改为双向结果回执，渲染层忙态或失败时弹出真实失败通知。
- **离线 68 键测试器键名全匹配**：为 `Caps Lock`、`ShiftL`、`ShiftR`、`CtrlL`、`WinL`、`AltL`、`Spacebar`、`AltR`、`CtrlR`、`ArrowL`、`ArrowD`、`ArrowR`（及 `Arrowup`）补齐雷电68 官方真实 ID 别名，实现 68 键（67 个标准可测键 + `Fn`）100% 一对一参数映射。
- **修复启动静默预读竞态**：`canPreload()` 增加 `!connectButton.disabled` 与 2.4G 弹窗检测；主进程轮询循环复检窗口可见性与取消标记；手动点击连接、2.4G 弹窗出现或断开时显式清零 5 秒静默窗口。
- **修复 WebHID `disconnect` 误断连与计时器残留**：断开事件先检查 `navigator.hid.getDevices()` 是否仍有已打开的 `0x369b` 目标设备，避免拔插其他外设误报断连；真实断连时同步清理 `connectionTimer`、恢复连接按钮并归零静默态。
- **细分同厂其他型号排障分类**：将同 VID（`0x369B`）非 `0x0211`/`0x0434` 拆分为独立诊断类型 `unsupported-model`，不再误报为蓝牙模式，并在无设备提示中明确蓝牙过滤说明。
- **加固资源同步脚本 `scripts/sync-official.cjs`**：非 `--force` 复用缓存前比对旧 `manifest.json` SHA256 并拒绝 0 字节文件；将 SPA `text/html` 回退拦截扩展至 `.js`/`.css`/`.jpg`/`.jpeg`/`.gif`/`.webp` 等全部非 HTML 资源；校验最终 `response.url` 同源性；采用原子替换写 `manifest.json`。

### 工程与体验收口（P2）
- 修复 `resolveAsset` 双重 `decodeURIComponent` 问题；为 `writeJsonAtomicSync` 增加随机临时后缀、Windows 文件锁短暂重试与 `finally` 清理。
- 为 `profiles:exportFile` / `profiles:importFile` 补充 `try/catch` 错误保护；启动与查询偏好时对账 `app.getLoginItemSettings()`；HTML 注入改为不区分大小写 `/<\/head>/i`；为 `setTitleBarOverlay` 增加存在性保护。
- 方案 Diff 补齐 `settings`（回报率 `rate`、休眠时间 `sleeptime`、游戏模式禁用列表 `game_disable_list`）与 `triggerMode`；测试器重置按钮点击后自动 `blur()` 防 `Enter` 误清空；渲染层诊断脱敏正则同步补全 `deviceSN`/`serialNumber`；修复 `app/redesign-audit.cjs` 错误反馈断言。
- 统一声明 `engines.node >= 22.12.0` 并将 GitHub Actions CI 对齐至 Windows Node 22（匹配 Electron 44 引擎要求）。

## [0.2.1] - 2026-10-08

- 支持打开主窗口时静默自动预读雷电68 配置并提供偏好开关。
- 优化配置读取期间的渲染节流（`createSyncScheduler`）与异步诊断日志，消除界面卡顿。
- 修复非 RT 按键灵敏度为 `null`/`0` 时保存方案误报超范围的问题。
- 新增跨版本测试入口脚本 `scripts/run-tests.cjs`。

## [0.2.0] - 2026-10-06

- 完成桌面端控制中心重构、防闪屏深浅主题与窗口几何记忆。
- 新增本地配置方案库（快照/Diff/自动回滚）、纯自研离线 68 键与磁轴手感校验器、热插拔排障与脱敏诊断中心、系统托盘与桌面伴侣。
- 建立便携包语言包瘦身、静态合规守卫与干净环境 CI 体系。
