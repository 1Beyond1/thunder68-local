/* Self-authored offline 68-key matrix tester, RT chatter detector, and FPS counter-strafe/SOCD analyzer (UMD + UI). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.thunder68KeyTester = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CHATTER_SEVERE_MS = 15;
  const CHATTER_WARN_MS = 25;
  const DEFAULT_STRAFE_WINDOW_MS = 350;

  // 100% self-authored standard 68-key (65%) ANSI layout. Each row sums to exactly 16.0u.
  const LAYOUT_68_ROWS = Object.freeze([
    [
      {code: 'Escape', label: 'Esc', u: 1, aliases: ['Esc', 'ESC']},
      {code: 'Digit1', label: '1', u: 1, aliases: ['1', '!1']},
      {code: 'Digit2', label: '2', u: 1, aliases: ['2', '@2']},
      {code: 'Digit3', label: '3', u: 1, aliases: ['3', '#3']},
      {code: 'Digit4', label: '4', u: 1, aliases: ['4', '$4']},
      {code: 'Digit5', label: '5', u: 1, aliases: ['5', '%5']},
      {code: 'Digit6', label: '6', u: 1, aliases: ['6', '^6']},
      {code: 'Digit7', label: '7', u: 1, aliases: ['7', '&7']},
      {code: 'Digit8', label: '8', u: 1, aliases: ['8', '*8']},
      {code: 'Digit9', label: '9', u: 1, aliases: ['9', '(9']},
      {code: 'Digit0', label: '0', u: 1, aliases: ['0', ')0']},
      {code: 'Minus', label: '-', u: 1, aliases: ['-', '_-']},
      {code: 'Equal', label: '=', u: 1, aliases: ['=', '+=']},
      {code: 'Backspace', label: 'Bksp', u: 2, aliases: ['Backspace', 'BackSpace', 'Bksp']},
      {code: 'Insert', label: 'Ins', u: 1, aliases: ['Ins', 'Insert']}
    ],
    [
      {code: 'Tab', label: 'Tab', u: 1.5, aliases: ['Tab']},
      {code: 'KeyQ', label: 'Q', u: 1, aliases: ['Q']},
      {code: 'KeyW', label: 'W', u: 1, aliases: ['W']},
      {code: 'KeyE', label: 'E', u: 1, aliases: ['E']},
      {code: 'KeyR', label: 'R', u: 1, aliases: ['R']},
      {code: 'KeyT', label: 'T', u: 1, aliases: ['T']},
      {code: 'KeyY', label: 'Y', u: 1, aliases: ['Y']},
      {code: 'KeyU', label: 'U', u: 1, aliases: ['U']},
      {code: 'KeyI', label: 'I', u: 1, aliases: ['I']},
      {code: 'KeyO', label: 'O', u: 1, aliases: ['O']},
      {code: 'KeyP', label: 'P', u: 1, aliases: ['P']},
      {code: 'BracketLeft', label: '[', u: 1, aliases: ['[', '{[']},
      {code: 'BracketRight', label: ']', u: 1, aliases: [']', '}]']},
      {code: 'Backslash', label: '\\', u: 1.5, aliases: ['\\', '|\\']},
      {code: 'Delete', label: 'Del', u: 1, aliases: ['Del', 'Delete']}
    ],
    [
      {code: 'CapsLock', label: 'Caps', u: 1.75, aliases: ['Caps', 'CapsLock', 'Caps Lock']},
      {code: 'KeyA', label: 'A', u: 1, aliases: ['A']},
      {code: 'KeyS', label: 'S', u: 1, aliases: ['S']},
      {code: 'KeyD', label: 'D', u: 1, aliases: ['D']},
      {code: 'KeyF', label: 'F', u: 1, aliases: ['F']},
      {code: 'KeyG', label: 'G', u: 1, aliases: ['G']},
      {code: 'KeyH', label: 'H', u: 1, aliases: ['H']},
      {code: 'KeyJ', label: 'J', u: 1, aliases: ['J']},
      {code: 'KeyK', label: 'K', u: 1, aliases: ['K']},
      {code: 'KeyL', label: 'L', u: 1, aliases: ['L']},
      {code: 'Semicolon', label: ';', u: 1, aliases: [';', ':;']},
      {code: 'Quote', label: '\'', u: 1, aliases: ['\'', '"\'']},
      {code: 'Enter', label: 'Enter', u: 2.25, aliases: ['Enter']},
      {code: 'PageUp', label: 'PgUp', u: 1, aliases: ['PgUp', 'PageUp']}
    ],
    [
      {code: 'ShiftLeft', label: 'LShift', u: 2.25, aliases: ['LShift', 'Shift_L', 'Shift', 'ShiftL']},
      {code: 'KeyZ', label: 'Z', u: 1, aliases: ['Z']},
      {code: 'KeyX', label: 'X', u: 1, aliases: ['X']},
      {code: 'KeyC', label: 'C', u: 1, aliases: ['C']},
      {code: 'KeyV', label: 'V', u: 1, aliases: ['V']},
      {code: 'KeyB', label: 'B', u: 1, aliases: ['B']},
      {code: 'KeyN', label: 'N', u: 1, aliases: ['N']},
      {code: 'KeyM', label: 'M', u: 1, aliases: ['M']},
      {code: 'Comma', label: ',', u: 1, aliases: [',', '<,']},
      {code: 'Period', label: '.', u: 1, aliases: ['.', '>.']},
      {code: 'Slash', label: '/', u: 1, aliases: ['/', '?/']},
      {code: 'ShiftRight', label: 'RShift', u: 1.75, aliases: ['RShift', 'Shift_R', 'ShiftR']},
      {code: 'ArrowUp', label: '↑', u: 1, aliases: ['Up', '↑', 'ArrowUp', 'Arrowup']},
      {code: 'PageDown', label: 'PgDn', u: 1, aliases: ['PgDn', 'PageDown']}
    ],
    [
      {code: 'ControlLeft', label: 'LCtrl', u: 1.25, aliases: ['LCtrl', 'Ctrl_L', 'Ctrl', 'CtrlL']},
      {code: 'MetaLeft', label: 'Win', u: 1.25, aliases: ['LWin', 'Win', 'Win_L', 'WinL']},
      {code: 'AltLeft', label: 'LAlt', u: 1.25, aliases: ['LAlt', 'Alt_L', 'Alt', 'AltL']},
      {code: 'Space', label: 'Space', u: 6.25, aliases: ['Space', 'Spacebar']},
      {code: 'AltRight', label: 'RAlt', u: 1, aliases: ['RAlt', 'Alt_R', 'AltR']},
      {code: 'Fn', label: 'Fn', u: 1, aliases: ['Fn'], hardwareOnly: true},
      {code: 'ControlRight', label: 'RCtrl', u: 1, aliases: ['RCtrl', 'Ctrl_R', 'CtrlR']},
      {code: 'ArrowLeft', label: '←', u: 1, aliases: ['Left', '←', 'ArrowLeft', 'ArrowL']},
      {code: 'ArrowDown', label: '↓', u: 1, aliases: ['Down', '↓', 'ArrowDown', 'ArrowD']},
      {code: 'ArrowRight', label: '→', u: 1, aliases: ['Right', '→', 'ArrowRight', 'ArrowR']}
    ]
  ]);

  const KEY_BY_CODE = new Map();
  for (const row of LAYOUT_68_ROWS) {
    for (const key of row) KEY_BY_CODE.set(key.code, key);
  }

  function findLiveKeyParam(code, keyValues) {
    if (!code || !Array.isArray(keyValues) || !keyValues.length) return null;
    const spec = KEY_BY_CODE.get(code);
    const candidates = new Set([code.toLowerCase()]);
    if (spec) {
      candidates.add(spec.label.toLowerCase());
      for (const alias of spec.aliases || []) candidates.add(alias.toLowerCase());
    }
    return keyValues.find(item => typeof item?.id === 'string' && candidates.has(item.id.trim().toLowerCase())) || null;
  }

  function createPairTracker(name, codeA, codeB, labelA, labelB) {
    return {
      name,
      codeA,
      codeB,
      labelA,
      labelB,
      overlapStart: null,
      overlapFrom: null,
      overlapTo: null,
      lastReleasedCode: null,
      lastReleasedAt: null,
      transitions: 0,
      overlapCount: 0,
      zeroOverlapCount: 0,
      totalOverlapMs: 0,
      maxOverlapMs: 0,
      totalGapMs: 0,
      recent: []
    };
  }

  function createKeyTesterEngine(options = {}) {
    const severeMs = typeof options.severeMs === 'number' ? options.severeMs : CHATTER_SEVERE_MS;
    const warnMs = typeof options.warnMs === 'number' ? options.warnMs : CHATTER_WARN_MS;
    const strafeWindowMs = typeof options.strafeWindowMs === 'number' ? options.strafeWindowMs : DEFAULT_STRAFE_WINDOW_MS;

    let activeKeys = new Set();
    let keyStats = new Map();
    let peakNkro = 0;
    let totalPresses = 0;
    let severeChatterCount = 0;
    let warnChatterCount = 0;
    let chatterEvents = [];
    let lastCode = null;
    let pairs = {
      AD: createPairTracker('AD', 'KeyA', 'KeyD', 'A', 'D'),
      WS: createPairTracker('WS', 'KeyW', 'KeyS', 'W', 'S')
    };

    function getOrCreateKeyStat(code) {
      let entry = keyStats.get(code);
      if (!entry) {
        entry = {
          code,
          pressCount: 0,
          tested: false,
          lastDownAt: null,
          lastUpAt: null,
          lastHoldMs: null,
          lastBounceMs: null,
          minBounceMs: null,
          severeCount: 0,
          warnCount: 0
        };
        keyStats.set(code, entry);
      }
      return entry;
    }

    function pairForCode(code) {
      if (code === 'KeyA' || code === 'KeyD') return pairs.AD;
      if (code === 'KeyW' || code === 'KeyS') return pairs.WS;
      return null;
    }

    function labelInPair(pair, code) {
      return code === pair.codeA ? pair.labelA : pair.labelB;
    }

    function pushPairEvent(pair, entry) {
      pair.recent.unshift(entry);
      if (pair.recent.length > 20) pair.recent.length = 20;
    }

    function onKeyDown({code, timestamp, repeat = false}) {
      if (!code || repeat) return {ignored: true};
      if (activeKeys.has(code)) return {ignored: true};
      const ts = Number(timestamp);
      if (!Number.isFinite(ts)) return {ignored: true};

      activeKeys.add(code);
      totalPresses++;
      if (activeKeys.size > peakNkro) peakNkro = activeKeys.size;
      lastCode = code;

      const stat = getOrCreateKeyStat(code);
      stat.pressCount++;
      stat.tested = true;

      let chatterSeverity = null;
      let bounceMs = null;
      if (stat.lastUpAt !== null) {
        bounceMs = Math.max(0, ts - stat.lastUpAt);
      } else if (stat.lastDownAt !== null) {
        bounceMs = Math.max(0, ts - stat.lastDownAt);
      }
      stat.lastDownAt = ts;

      if (bounceMs !== null) {
        const rounded = Math.round(bounceMs * 10) / 10;
        stat.lastBounceMs = rounded;
        if (stat.minBounceMs === null || rounded < stat.minBounceMs) {
          stat.minBounceMs = rounded;
        }
        if (bounceMs < severeMs) {
          chatterSeverity = 'severe';
          stat.severeCount++;
          severeChatterCount++;
          chatterEvents.unshift({code, label: KEY_BY_CODE.get(code)?.label || code, bounceMs: rounded, severity: 'severe', at: ts});
          if (chatterEvents.length > 40) chatterEvents.length = 40;
        } else if (bounceMs < warnMs) {
          chatterSeverity = 'warn';
          stat.warnCount++;
          warnChatterCount++;
          chatterEvents.unshift({code, label: KEY_BY_CODE.get(code)?.label || code, bounceMs: rounded, severity: 'warn', at: ts});
          if (chatterEvents.length > 40) chatterEvents.length = 40;
        }
      }

      // FPS Counter-Strafe / SOCD Pair Tracking
      const pair = pairForCode(code);
      let strafeEvent = null;
      if (pair) {
        const opposite = code === pair.codeA ? pair.codeB : pair.codeA;
        if (activeKeys.has(opposite)) {
          // Both opposing keys held simultaneously -> start overlap timing
          pair.overlapStart = ts;
          pair.overlapFrom = opposite;
          pair.overlapTo = code;
          pair.lastReleasedCode = null;
          pair.lastReleasedAt = null;
        } else if (pair.lastReleasedCode === opposite && pair.lastReleasedAt !== null) {
          const gapMs = Math.max(0, ts - pair.lastReleasedAt);
          if (gapMs <= strafeWindowMs) {
            const roundedGap = Math.round(gapMs * 10) / 10;
            pair.transitions++;
            pair.zeroOverlapCount++;
            pair.totalGapMs += gapMs;
            strafeEvent = {
              pair: pair.name,
              from: labelInPair(pair, opposite),
              to: labelInPair(pair, code),
              type: gapMs <= 1 ? 'perfect' : 'gap',
              durationMs: roundedGap,
              at: ts
            };
            pushPairEvent(pair, strafeEvent);
          }
          pair.lastReleasedCode = null;
          pair.lastReleasedAt = null;
        }
      }

      return {ignored: false, code, bounceMs, chatterSeverity, strafeEvent};
    }

    function onKeyUp({code, timestamp}) {
      if (!code) return {ignored: true};
      const ts = Number(timestamp);
      if (!Number.isFinite(ts)) return {ignored: true};
      if (!activeKeys.has(code)) return {ignored: true};

      activeKeys.delete(code);
      const stat = getOrCreateKeyStat(code);
      stat.lastUpAt = ts;
      if (stat.lastDownAt !== null) {
        stat.lastHoldMs = Math.round(Math.max(0, ts - stat.lastDownAt) * 10) / 10;
      }

      const pair = pairForCode(code);
      let strafeEvent = null;
      if (pair) {
        if (pair.overlapStart !== null) {
          const overlapMs = Math.max(0, ts - pair.overlapStart);
          const roundedOverlap = Math.round(overlapMs * 10) / 10;
          pair.transitions++;
          pair.overlapCount++;
          pair.totalOverlapMs += overlapMs;
          if (overlapMs > pair.maxOverlapMs) pair.maxOverlapMs = overlapMs;
          strafeEvent = {
            pair: pair.name,
            from: labelInPair(pair, pair.overlapFrom),
            to: labelInPair(pair, pair.overlapTo),
            type: 'overlap',
            durationMs: roundedOverlap,
            at: ts
          };
          pushPairEvent(pair, strafeEvent);
          pair.overlapStart = null;
          pair.overlapFrom = null;
          pair.overlapTo = null;
        } else {
          pair.lastReleasedCode = code;
          pair.lastReleasedAt = ts;
        }
      }

      return {ignored: false, code, strafeEvent};
    }

    function releaseAll() {
      activeKeys.clear();
      for (const pair of Object.values(pairs)) {
        pair.overlapStart = null;
        pair.overlapFrom = null;
        pair.overlapTo = null;
      }
    }

    function reset() {
      activeKeys = new Set();
      keyStats = new Map();
      peakNkro = 0;
      totalPresses = 0;
      severeChatterCount = 0;
      warnChatterCount = 0;
      chatterEvents = [];
      lastCode = null;
      pairs = {
        AD: createPairTracker('AD', 'KeyA', 'KeyD', 'A', 'D'),
        WS: createPairTracker('WS', 'KeyW', 'KeyS', 'W', 'S')
      };
    }

    function formatPairStats(pair) {
      const zeroRate = pair.transitions > 0
        ? Math.round((pair.zeroOverlapCount / pair.transitions) * 1000) / 10
        : null;
      const avgOverlapMs = pair.overlapCount > 0
        ? Math.round((pair.totalOverlapMs / pair.overlapCount) * 10) / 10
        : 0;
      const avgGapMs = pair.zeroOverlapCount > 0
        ? Math.round((pair.totalGapMs / pair.zeroOverlapCount) * 10) / 10
        : 0;
      return {
        name: pair.name,
        transitions: pair.transitions,
        overlapCount: pair.overlapCount,
        zeroOverlapCount: pair.zeroOverlapCount,
        zeroOverlapRate: zeroRate,
        avgOverlapMs,
        maxOverlapMs: Math.round(pair.maxOverlapMs * 10) / 10,
        avgGapMs,
        recent: pair.recent.slice()
      };
    }

    function snapshot() {
      const ad = formatPairStats(pairs.AD);
      const ws = formatPairStats(pairs.WS);
      const totalTrans = pairs.AD.transitions + pairs.WS.transitions;
      const totalZero = pairs.AD.zeroOverlapCount + pairs.WS.zeroOverlapCount;
      const totalOvCount = pairs.AD.overlapCount + pairs.WS.overlapCount;
      const totalOvMs = pairs.AD.totalOverlapMs + pairs.WS.totalOverlapMs;
      const totalGapMs = pairs.AD.totalGapMs + pairs.WS.totalGapMs;

      return {
        activeKeys: [...activeKeys],
        activeCount: activeKeys.size,
        peakNkro,
        totalPresses,
        testedCount: [...keyStats.values()].filter(s => s.tested && KEY_BY_CODE.has(s.code)).length,
        severeChatterCount,
        warnChatterCount,
        chatterEvents: chatterEvents.slice(),
        lastCode,
        keyStats: Object.fromEntries([...keyStats.entries()].map(([k, v]) => [k, {...v}])),
        socd: {
          AD: ad,
          WS: ws,
          combined: {
            transitions: totalTrans,
            overlapCount: totalOvCount,
            zeroOverlapCount: totalZero,
            zeroOverlapRate: totalTrans > 0 ? Math.round((totalZero / totalTrans) * 1000) / 10 : null,
            avgOverlapMs: totalOvCount > 0 ? Math.round((totalOvMs / totalOvCount) * 10) / 10 : 0,
            maxOverlapMs: Math.round(Math.max(pairs.AD.maxOverlapMs, pairs.WS.maxOverlapMs) * 10) / 10,
            avgGapMs: totalZero > 0 ? Math.round((totalGapMs / totalZero) * 10) / 10 : 0,
            recent: [...pairs.AD.recent, ...pairs.WS.recent].sort((a, b) => b.at - a.at).slice(0, 16)
          }
        }
      };
    }

    return {onKeyDown, onKeyUp, releaseAll, reset, snapshot};
  }

  // ==================== Browser UI Mount ====================
  const ICON_SVG = '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h2m2 0h2m2 0h4M6 14h4m2 0h6"/><path d="M12 2v2m4-1-1 1.5M8 3l1 1.5"/>';

  function mountKeyTesterUI() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const shell = window.thunder68Shell;
    if (!shell) return;

    const engine = createKeyTesterEngine();
    let container = null;
    let listening = false;
    let suppressBrowserKeys = true;
    let inspectedCode = 'KeyW';
    const keycapElements = new Map();

    const PREVENT_CODES = new Set([
      'Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'AltLeft', 'AltRight', 'PageUp', 'PageDown', 'End', 'Backspace'
    ]);

    function renderSelectedKeyParam(snap) {
      if (!container) return;
      const box = container.querySelector('.local-kt-live-param');
      if (!box) return;
      const spec = KEY_BY_CODE.get(inspectedCode);
      const stat = snap.keyStats[inspectedCode];
      const liveState = window.thunder68Presentation?.state?.();
      const keyValues = liveState?.config?.keyValues;
      const param = findLiveKeyParam(inspectedCode, keyValues);
      const connected = Boolean(shell.getStatus().deviceOpened && Array.isArray(keyValues) && keyValues.length);

      box.replaceChildren();
      const title = document.createElement('div');
      title.className = 'local-kt-param-head';
      const strong = document.createElement('strong');
      strong.textContent = `当前检验按键：${spec ? `${spec.label} (${spec.code})` : inspectedCode}`;
      title.appendChild(strong);

      if (connected) {
        const jumpBtn = document.createElement('button');
        jumpBtn.type = 'button';
        jumpBtn.className = 'local-btn-secondary';
        jumpBtn.textContent = '去快速触发页微调 →';
        jumpBtn.addEventListener('click', () => shell.navigateToOfficialPage(2));
        title.appendChild(jumpBtn);
      }
      box.appendChild(title);

      const grid = document.createElement('div');
      grid.className = 'local-kt-param-grid';
      const addItem = (label, value, highlight = '') => {
        const div = document.createElement('div');
        div.className = 'local-kt-param-item' + (highlight ? ` is-${highlight}` : '');
        const s = document.createElement('span');
        s.textContent = label;
        const b = document.createElement('b');
        b.textContent = value;
        div.append(s, b);
        grid.appendChild(div);
      };

      addItem('触发次数', `${stat?.pressCount ?? 0} 次`);
      addItem('最短回弹间隔', stat?.minBounceMs !== null && stat?.minBounceMs !== undefined ? `${stat.minBounceMs} ms` : '--',
        stat?.minBounceMs !== null && stat?.minBounceMs < CHATTER_SEVERE_MS ? 'severe' : stat?.minBounceMs !== null && stat?.minBounceMs < CHATTER_WARN_MS ? 'warn' : '');
      addItem('连击告警 (<15 / <25ms)', `${stat?.severeCount ?? 0} / ${stat?.warnCount ?? 0}`,
        (stat?.severeCount || 0) > 0 ? 'severe' : (stat?.warnCount || 0) > 0 ? 'warn' : '');

      if (connected && param) {
        const mm = v => Number.isFinite(Number(v)) ? `${Number(v).toFixed(2)} mm` : '--';
        addItem('当前触发行程 (只读)', mm(param.travelValue));
        addItem('快速触发 RT (只读)', param.isRTEnabled ? '开启' : '关闭');
        if (param.isRTEnabled) {
          if (param.isIndependentSensitivity) {
            addItem('按下 / 抬起灵敏度', `${mm(param.triggerSensitivity)} / ${mm(param.resetSensitivity)}`);
          } else {
            addItem('RT 灵敏度 (只读)', mm(param.sensitivity));
          }
        }
      } else {
        addItem('磁轴行程 / RT 参数', '离线模式（连接雷电68后自动只读显示）');
      }
      box.appendChild(grid);
    }

    function updateUI() {
      if (!container) return;
      const snap = engine.snapshot();
      const activeSet = new Set(snap.activeKeys);

      for (const [code, el] of keycapElements.entries()) {
        const stat = snap.keyStats[code];
        el.classList.toggle('is-active', activeSet.has(code));
        el.classList.toggle('is-tested', Boolean(stat?.tested));
        el.classList.toggle('is-chatter-severe', Boolean(stat?.severeCount > 0));
        el.classList.toggle('is-chatter-warn', Boolean(!stat?.severeCount && stat?.warnCount > 0));
        el.classList.toggle('is-inspected', code === inspectedCode);
        const countBadge = el.querySelector('em');
        if (countBadge) {
          countBadge.textContent = stat?.pressCount ? String(stat.pressCount) : '';
        }
      }

      container.querySelector('.local-kt-active-nkro').textContent = String(snap.activeCount);
      container.querySelector('.local-kt-peak-nkro').textContent = String(snap.peakNkro);
      container.querySelector('.local-kt-tested-count').textContent = `${snap.testedCount} / 67`;
      container.querySelector('.local-kt-total-presses').textContent = String(snap.totalPresses);
      container.querySelector('.local-kt-chatter-severe').textContent = String(snap.severeChatterCount);
      container.querySelector('.local-kt-chatter-warn').textContent = String(snap.warnChatterCount);

      // Render chatter list
      const chatterList = container.querySelector('.local-kt-chatter-list');
      chatterList.replaceChildren();
      if (!snap.chatterEvents.length) {
        const empty = document.createElement('p');
        empty.className = 'local-muted-note';
        empty.textContent = '暂未捕捉到 <25ms 的同键二次触发。连击/误触记录仅保存在内存，绝不落盘。';
        chatterList.appendChild(empty);
      } else {
        for (const ev of snap.chatterEvents.slice(0, 12)) {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = `local-kt-chatter-row is-${ev.severity}`;
          row.textContent = `${ev.label} · 间隔 ${ev.bounceMs} ms（${ev.severity === 'severe' ? '<15ms 高危误触' : '<25ms 疑似连击'}）`;
          row.addEventListener('click', () => {
            inspectedCode = ev.code;
            updateUI();
          });
          chatterList.appendChild(row);
        }
      }

      // Render SOCD / Counter-strafe metrics
      for (const pairKey of ['AD', 'WS']) {
        const p = snap.socd[pairKey];
        const card = container.querySelector(`[data-socd-pair="${pairKey}"]`);
        if (!card) continue;
        card.querySelector('.socd-rate').textContent = p.zeroOverlapRate !== null ? `${p.zeroOverlapRate}%` : '--';
        card.querySelector('.socd-overlap').textContent = p.overlapCount > 0 ? `${p.avgOverlapMs} ms (峰值 ${p.maxOverlapMs} ms)` : '0 ms';
        card.querySelector('.socd-gap').textContent = p.zeroOverlapCount > 0 ? `${p.avgGapMs} ms` : '--';
        card.querySelector('.socd-count').textContent = `${p.transitions} 次切换（重叠 ${p.overlapCount}）`;
      }

      const timeline = container.querySelector('.local-kt-socd-timeline');
      timeline.replaceChildren();
      const recent = snap.socd.combined.recent;
      if (!recent.length) {
        const empty = document.createElement('p');
        empty.className = 'local-muted-note';
        empty.textContent = '交替快速按压 A / D 或 W / S 进行 FPS 急停测试，此处将实时显示重叠与空窗时序条。';
        timeline.appendChild(empty);
      } else {
        for (const item of recent.slice(0, 10)) {
          const row = document.createElement('div');
          row.className = `local-kt-socd-bar is-${item.type}`;
          const label = document.createElement('span');
          label.className = 'socd-bar-label';
          label.textContent = `${item.from} → ${item.to}`;
          const track = document.createElement('div');
          track.className = 'socd-bar-track';
          const fill = document.createElement('div');
          fill.className = 'socd-bar-fill';
          fill.style.width = `${Math.min(100, Math.max(6, (item.durationMs / 120) * 100))}%`;
          track.appendChild(fill);
          const val = document.createElement('strong');
          val.textContent = item.type === 'overlap'
            ? `重叠 ${item.durationMs} ms`
            : item.type === 'perfect'
              ? `零重叠 ${item.durationMs} ms`
              : `空窗 ${item.durationMs} ms`;
          row.append(label, track, val);
          timeline.appendChild(row);
        }
      }

      renderSelectedKeyParam(snap);
    }

    const handleKeyDown = event => {
      if (!listening) return;
      if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (suppressBrowserKeys && PREVENT_CODES.has(event.code)) {
        event.preventDefault();
      }
      const res = engine.onKeyDown({
        code: event.code,
        timestamp: event.timeStamp || performance.now(),
        repeat: event.repeat
      });
      if (!res.ignored) {
        if (KEY_BY_CODE.has(event.code)) inspectedCode = event.code;
        updateUI();
      }
    };

    const handleKeyUp = event => {
      if (!listening) return;
      if (suppressBrowserKeys && PREVENT_CODES.has(event.code)) {
        event.preventDefault();
      }
      const res = engine.onKeyUp({
        code: event.code,
        timestamp: event.timeStamp || performance.now()
      });
      if (!res.ignored) updateUI();
    };

    const handleBlur = () => {
      if (!listening) return;
      engine.releaseAll();
      updateUI();
    };

    function attachListeners() {
      if (listening) return;
      listening = true;
      window.addEventListener('keydown', handleKeyDown, true);
      window.addEventListener('keyup', handleKeyUp, true);
      window.addEventListener('blur', handleBlur);
    }

    function detachListeners() {
      if (!listening) return;
      listening = false;
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
      engine.releaseAll();
    }

    shell.registerTool({
      id: 'key-tester',
      label: '按键与手感测试',
      iconSvg: ICON_SVG,
      title: '离线按键测试与磁轴手感校验器',
      subtitle: '纯本地自研 68 键矩阵、RT 连击误触捕捉与 FPS 急停/SOCD 重叠分析（未连键盘亦可用，切离自动释放监听）。',
      render(mountEl) {
        container = mountEl;
        mountEl.innerHTML = `
          <div class="local-kt-layout">
            <div class="local-kt-disclaimer">
              <span>说明：本工具完全离线运行，基于系统标准键盘事件（<code>KeyboardEvent.code</code> + <code>performance.now()</code>）统计触发与急停时序，并非硬件毫米级模拟 ADC 行程波形；所有测试仅驻留内存，绝不写入日志。</span>
              <div class="local-kt-toolbar">
                <label class="local-kt-toggle"><input type="checkbox" class="local-kt-prevent-toggle" checked> 拦截 Tab/空格/方向键默认滚动</label>
                <button type="button" class="local-btn-secondary local-kt-reset-btn">重置统计</button>
              </div>
            </div>

            <div class="local-kt-stats-strip">
              <div class="local-kt-stat"><span>当前同时按下</span><strong class="local-kt-active-nkro">0</strong></div>
              <div class="local-kt-stat"><span>峰值 NKRO 无冲</span><strong class="local-kt-peak-nkro">0</strong></div>
              <div class="local-kt-stat"><span>已测标准键位</span><strong class="local-kt-tested-count">0 / 67</strong></div>
              <div class="local-kt-stat"><span>总触发次数</span><strong class="local-kt-total-presses">0</strong></div>
              <div class="local-kt-stat is-severe"><span>高危连击 (&lt;15ms)</span><strong class="local-kt-chatter-severe">0</strong></div>
              <div class="local-kt-stat is-warn"><span>疑似误触 (&lt;25ms)</span><strong class="local-kt-chatter-warn">0</strong></div>
            </div>

            <section class="local-companion-card local-kt-board-card">
              <div class="local-card-row-head">
                <h2>自研 68 键触发矩阵（点击或按压任意键查看参数）</h2>
                <div class="local-kt-legend">
                  <span><i class="dot active"></i>按下中</span>
                  <span><i class="dot tested"></i>已触发</span>
                  <span><i class="dot warn"></i>&lt;25ms 疑似连击</span>
                  <span><i class="dot severe"></i>&lt;15ms 高危误触</span>
                </div>
              </div>
              <div class="local-kt-matrix" aria-label="68键实时触发矩阵"></div>
              <div class="local-kt-live-param"></div>
            </section>

            <div class="local-kt-analyzers">
              <section class="local-companion-card">
                <div class="local-card-row-head">
                  <h2>RT 误触 / 连击检测器</h2>
                  <span class="local-muted-note">阈值：&lt;15ms 标红 · &lt;25ms 标橙</span>
                </div>
                <div class="local-kt-chatter-list"></div>
              </section>

              <section class="local-companion-card">
                <div class="local-card-row-head">
                  <h2>FPS 急停 / SOCD 重叠分析器</h2>
                  <span class="local-muted-note">统计 A/D、W/S 反向急停重叠与空窗</span>
                </div>
                <div class="local-kt-socd-cards">
                  <div class="local-kt-socd-pair" data-socd-pair="AD">
                    <h3>A ↔ D 横向急停</h3>
                    <div class="socd-metric"><span>零重叠率</span><strong class="socd-rate">--</strong></div>
                    <div class="socd-metric"><span>平均重叠时长</span><strong class="socd-overlap">0 ms</strong></div>
                    <div class="socd-metric"><span>平均空窗时长</span><strong class="socd-gap">--</strong></div>
                    <div class="socd-sub socd-count">0 次切换</div>
                  </div>
                  <div class="local-kt-socd-pair" data-socd-pair="WS">
                    <h3>W ↔ S 纵向急停</h3>
                    <div class="socd-metric"><span>零重叠率</span><strong class="socd-rate">--</strong></div>
                    <div class="socd-metric"><span>平均重叠时长</span><strong class="socd-overlap">0 ms</strong></div>
                    <div class="socd-metric"><span>平均空窗时长</span><strong class="socd-gap">--</strong></div>
                    <div class="socd-sub socd-count">0 次切换</div>
                  </div>
                </div>
                <div class="local-kt-socd-timeline"></div>
              </section>
            </div>
          </div>
        `;

        const matrix = mountEl.querySelector('.local-kt-matrix');
        for (const row of LAYOUT_68_ROWS) {
          const rowEl = document.createElement('div');
          rowEl.className = 'local-kt-row';
          for (const key of row) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'local-kt-key' + (key.hardwareOnly ? ' is-hw-only' : '');
            btn.style.flex = `${key.u} 0 0`;
            btn.dataset.code = key.code;
            btn.title = key.hardwareOnly ? `${key.label}（硬件层修饰键，不向系统上报标准按键码）` : `${key.label} (${key.code})`;
            const lbl = document.createElement('span');
            lbl.textContent = key.label;
            const cnt = document.createElement('em');
            btn.append(lbl, cnt);
            btn.addEventListener('click', () => {
              inspectedCode = key.code;
              updateUI();
            });
            keycapElements.set(key.code, btn);
            rowEl.appendChild(btn);
          }
          matrix.appendChild(rowEl);
        }

        mountEl.querySelector('.local-kt-prevent-toggle').addEventListener('change', e => {
          suppressBrowserKeys = e.currentTarget.checked;
        });
        mountEl.querySelector('.local-kt-reset-btn').addEventListener('click', e => {
          engine.reset();
          e.currentTarget?.blur?.();
          updateUI();
        });
        updateUI();
      },
      onShow() {
        attachListeners();
        updateUI();
      },
      onHide() {
        detachListeners();
      }
    });

    window.addEventListener('thunder68-shell-sync', () => {
      if (shell.getActiveTool() === 'key-tester') updateUI();
    });
  }

  if (typeof window !== 'undefined') {
    if (window.thunder68Shell) mountKeyTesterUI();
    else window.addEventListener('thunder68-shell-ready', mountKeyTesterUI, {once: true});
  }

  return {
    CHATTER_SEVERE_MS,
    CHATTER_WARN_MS,
    DEFAULT_STRAFE_WINDOW_MS,
    LAYOUT_68_ROWS,
    findLiveKeyParam,
    createKeyTesterEngine
  };
});
