/* Desktop Companion Settings panel & main-process tray/hotkey action dispatcher (Phase A). */
(() => {
  'use strict';

  const ICON_SVG = '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><circle cx="17" cy="9" r="1.5" fill="currentColor" stroke="none"/>';

  function mountCompanionPanel() {
    const shell = window.thunder68Shell;
    const prefsApi = window.thunder68Local?.preferences;
    if (!shell || !prefsApi) return;

    let container = null;
    let state = null;

    function renderShortcutStatus(el, statusObj) {
      if (!el) return;
      if (!statusObj || !statusObj.accelerator) {
        el.textContent = '未设置（留空即禁用）';
        el.dataset.state = 'idle';
        return;
      }
      if (statusObj.ok) {
        el.textContent = `已注册生效：${statusObj.accelerator}`;
        el.dataset.state = 'ok';
      } else {
        el.textContent = `注册失败：${statusObj.error || '可能与其他软件冲突'}`;
        el.dataset.state = 'error';
      }
    }

    function syncForm() {
      if (!container || !state?.preferences) return;
      const p = state.preferences;
      const themeSel = container.querySelector('.local-pref-theme');
      const minTray = container.querySelector('.local-pref-min-tray');
      const autoLaunch = container.querySelector('.local-pref-autolaunch');
      const autoConnect = container.querySelector('.local-pref-autoconnect');
      const lowBat = container.querySelector('.local-pref-lowbat');
      const lowBatThreshold = container.querySelector('.local-pref-lowbat-threshold');
      const toggleHotkey = container.querySelector('.local-pref-hotkey-toggle');
      const switchHotkey = container.querySelector('.local-pref-hotkey-switch');
      const boundsInfo = container.querySelector('.local-pref-bounds');
      const portableNote = container.querySelector('.local-pref-portable-note');

      if (themeSel) themeSel.value = p.themeChoice || 'system';
      if (minTray) minTray.checked = Boolean(p.minimizeToTray);
      if (autoLaunch) {
        autoLaunch.checked = Boolean(p.autoLaunch);
        autoLaunch.disabled = !state.loginItemSupported;
      }
      if (autoConnect) autoConnect.checked = Boolean(p.autoConnectOnLaunch);
      if (lowBat) lowBat.checked = Boolean(p.lowBatteryAlert);
      if (lowBatThreshold) {
        lowBatThreshold.value = String(p.lowBatteryThreshold ?? 20);
        lowBatThreshold.disabled = !p.lowBatteryAlert;
      }
      if (toggleHotkey) toggleHotkey.value = p.globalShortcuts?.toggleWindow || '';
      if (switchHotkey) switchHotkey.value = p.globalShortcuts?.quickSwitchProfile || '';
      if (boundsInfo) {
        const b = p.windowBounds || {};
        boundsInfo.textContent = `${b.width || 1400} × ${b.height || 940}${b.maximized ? '（最大化）' : ''}`;
      }
      if (portableNote) {
        portableNote.textContent = state.isPackaged
          ? '便携版提示：开启开机自启前，请将 Thunder68-Local 整个文件夹放置到固定目录（如 D:\\Tools\\Thunder68-Local），移动目录后需重新取消并勾选以更新启动路径。'
          : '开发模式提示：开机自启将以静默参数（--minimized）启动；正式使用时建议将构建后的便携版放到固定目录再开启。';
      }

      renderShortcutStatus(container.querySelector('.local-hotkey-toggle-status'), state.shortcutStatus?.toggleWindow);
      renderShortcutStatus(container.querySelector('.local-hotkey-switch-status'), state.shortcutStatus?.quickSwitchProfile);
    }

    async function loadState() {
      try {
        state = await prefsApi.get();
      } catch {}
      syncForm();
    }

    async function savePatch(patch, toastText = '') {
      try {
        state = await prefsApi.update(patch);
        syncForm();
        if (toastText) shell.feedback(toastText, 'success');
      } catch (error) {
        shell.feedback(`保存偏好失败：${error.message}`, 'error');
      }
    }

    shell.registerTool({
      id: 'companion',
      label: '桌面伴侣',
      iconSvg: ICON_SVG,
      title: '桌面伴侣与系统托盘',
      subtitle: '管理托盘常驻、防闪屏主题/窗口记忆、开机静默自启、全局快捷键与 2.4G 低电量提醒。',
      render(mountEl) {
        container = mountEl;
        mountEl.innerHTML = `
          <div class="local-companion-settings-grid">
            <section class="local-companion-card">
              <h2>系统托盘与后台常驻</h2>
              <label class="local-pref-row">
                <div>
                  <strong>关闭窗口时最小化到系统托盘</strong>
                  <p>开启后点击窗口右上角关闭按钮将隐藏到系统托盘（WebHID 连接保持活跃，空闲期零轮询发包）；可通过托盘右键菜单彻底退出。</p>
                </div>
                <input type="checkbox" class="local-pref-min-tray">
              </label>
              <label class="local-pref-row">
                <div>
                  <strong>开机静默自启动（--minimized）</strong>
                  <p>登录 Windows 后直接驻留系统托盘，不主动弹出主窗口。</p>
                </div>
                <input type="checkbox" class="local-pref-autolaunch">
              </label>
              <label class="local-pref-row">
                <div>
                  <strong>打开窗口时自动预读键盘配置</strong>
                  <p>开启后，启动打开主窗口时若检测到单个已接入的雷电68，将自动静默连接并立即预读配置；未接入或多设备时保持静默，不弹窗打扰。</p>
                </div>
                <input type="checkbox" class="local-pref-autoconnect">
              </label>
              <div class="local-pref-notice local-pref-portable-note"></div>
            </section>

            <section class="local-companion-card">
              <h2>外观、窗口记忆与本地资料</h2>
              <div class="local-pref-row">
                <div>
                  <strong>主题外观（防闪屏持久化）</strong>
                  <p>写入 data/preferences.json，主进程启动时即匹配对应标题栏与底色，消除浅色主题启动黑屏闪烁。</p>
                </div>
                <select class="local-pref-theme" aria-label="持久化外观主题">
                  <option value="system">跟随系统</option>
                  <option value="dark">深色</option>
                  <option value="light">浅色</option>
                </select>
              </div>
              <div class="local-pref-row">
                <div>
                  <strong>已记忆窗口尺寸</strong>
                  <p>下次启动自动恢复并校验多屏可见区域。</p>
                </div>
                <span class="local-pref-bounds local-mono-pill">--</span>
              </div>
              <div class="local-pref-row">
                <div>
                  <strong>本地资料与方案目录</strong>
                  <p>包含 preferences.json、profiles/*.json 与 diagnostics.jsonl。</p>
                </div>
                <button type="button" class="local-btn-secondary local-pref-open-dir">打开本地资料目录</button>
              </div>
            </section>

            <section class="local-companion-card">
              <h2>全局快捷键</h2>
              <p class="local-muted-note">使用 Electron 快捷键格式（例如 <code>CommandOrControl+Alt+T</code>、<code>Alt+Shift+P</code>），留空保存即关闭对应热键。</p>
              <div class="local-pref-hotkey-group">
                <label>
                  <span>显示 / 隐藏主窗口</span>
                  <input type="text" class="local-pref-hotkey-toggle" maxlength="64" placeholder="例如 CommandOrControl+Alt+T">
                  <small class="local-hotkey-status local-hotkey-toggle-status"></small>
                </label>
                <label>
                  <span>快捷轮换已保存配置方案（需已连接且非忙态）</span>
                  <input type="text" class="local-pref-hotkey-switch" maxlength="64" placeholder="可选，例如 CommandOrControl+Alt+P">
                  <small class="local-hotkey-status local-hotkey-switch-status"></small>
                </label>
              </div>
              <div class="local-pref-hotkey-actions">
                <button type="button" class="local-btn-primary local-pref-save-hotkeys">保存并生效快捷键</button>
                <button type="button" class="local-btn-secondary local-pref-reset-hotkeys">恢复默认热键</button>
              </div>
            </section>

            <section class="local-companion-card">
              <h2>2.4G 无线低电量轻提示</h2>
              <label class="local-pref-row">
                <div>
                  <strong>开启 2.4G 低电量系统轻提示</strong>
                  <p>仅在 2.4G 无线模式读取到低电量时发送一次静默系统通知，电量回升后自动重置。</p>
                </div>
                <input type="checkbox" class="local-pref-lowbat">
              </label>
              <div class="local-pref-row">
                <div>
                  <strong>提醒电量阈值</strong>
                  <p>剩余电量低于或等于该百分比时提醒。</p>
                </div>
                <select class="local-pref-lowbat-threshold" aria-label="低电量提醒阈值">
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                  <option value="20">20%（推荐）</option>
                  <option value="30">30%</option>
                </select>
              </div>
            </section>
          </div>
        `;

        mountEl.querySelector('.local-pref-theme').addEventListener('change', e => {
          const choice = e.currentTarget.value;
          shell.setThemeChoice(choice, true);
          savePatch({themeChoice: choice}, '主题偏好已保存');
        });
        mountEl.querySelector('.local-pref-min-tray').addEventListener('change', e => {
          savePatch({minimizeToTray: e.currentTarget.checked}, e.currentTarget.checked ? '已开启关闭最小化到托盘' : '已关闭最小化到托盘');
        });
        mountEl.querySelector('.local-pref-autolaunch').addEventListener('change', e => {
          savePatch({autoLaunch: e.currentTarget.checked}, e.currentTarget.checked ? '已开启开机静默自启' : '已关闭开机自启');
        });
        mountEl.querySelector('.local-pref-autoconnect').addEventListener('change', e => {
          savePatch({autoConnectOnLaunch: e.currentTarget.checked}, e.currentTarget.checked ? '已开启启动自动预读配置' : '已关闭启动自动预读配置');
        });
        mountEl.querySelector('.local-pref-lowbat').addEventListener('change', e => {
          savePatch({lowBatteryAlert: e.currentTarget.checked}, '低电量提醒设置已更新');
        });
        mountEl.querySelector('.local-pref-lowbat-threshold').addEventListener('change', e => {
          savePatch({lowBatteryThreshold: Number(e.currentTarget.value)}, '低电量提醒阈值已更新');
        });
        mountEl.querySelector('.local-pref-open-dir').addEventListener('click', () => {
          prefsApi.openDataDir();
        });
        mountEl.querySelector('.local-pref-save-hotkeys').addEventListener('click', () => {
          const toggleWindow = mountEl.querySelector('.local-pref-hotkey-toggle').value.trim();
          const quickSwitchProfile = mountEl.querySelector('.local-pref-hotkey-switch').value.trim();
          savePatch({globalShortcuts: {toggleWindow, quickSwitchProfile}}, '全局快捷键配置已更新');
        });
        mountEl.querySelector('.local-pref-reset-hotkeys').addEventListener('click', () => {
          savePatch({globalShortcuts: {toggleWindow: 'CommandOrControl+Alt+T', quickSwitchProfile: ''}}, '已恢复默认全局快捷键');
        });
      },
      onShow() {
        loadState();
      }
    });

    window.addEventListener('thunder68-theme-change', e => {
      if (state?.preferences && e.detail?.themeChoice) {
        state.preferences.themeChoice = e.detail.themeChoice;
        syncForm();
      }
    });

    window.thunder68Local?.onCompanionAction?.(action => {
      if (!action || typeof action !== 'object') return;
      if (action.type === 'open-tool' && action.toolId) {
        shell.activateTool(action.toolId);
      } else if (action.type === 'apply-profile' && action.id) {
        const profilesApi = window.thunder68Profiles;
        const reportResult = payload => {
          window.thunder68Local?.reportCompanionActionResult?.({
            requestId: action.requestId || '',
            type: 'apply-profile',
            ...payload
          });
        };
        if (!profilesApi?.applyProfileById) {
          reportResult({stage: 'dispatched', ok: false, error: '配置方案库模块尚未就绪，请打开主窗口重试。'});
          return;
        }
        Promise.resolve(profilesApi.applyProfileById(action.id, {
          onComplete: finalRes => {
            reportResult({
              stage: 'completed',
              ok: Boolean(finalRes?.ok),
              outcome: finalRes?.outcome || (finalRes?.ok ? 'success' : 'error'),
              reason: finalRes?.reason || '',
              profileName: finalRes?.profileName || '',
              message: finalRes?.message || ''
            });
          }
        })).then(res => {
          reportResult({
            stage: 'dispatched',
            ok: Boolean(res?.ok),
            profileName: res?.profileName || '',
            error: res?.error || ''
          });
        }).catch(err => {
          reportResult({
            stage: 'dispatched',
            ok: false,
            error: err?.message || '触发方案切换失败。'
          });
        });
      } else if (action.type === 'preferences-changed' && action.preferences) {
        if (state) state.preferences = action.preferences;
        syncForm();
      }
    });

    loadState();
  }

  if (window.thunder68Shell) mountCompanionPanel();
  else window.addEventListener('thunder68-shell-ready', mountCompanionPanel, {once: true});
})();
