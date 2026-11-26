/* Local profile snapshot sanitization, validation, Diff, and official import payload builder (UMD). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.thunder68ProfileCore = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PROFILE_SCHEMA_VERSION = 1;
  const ROLLBACK_PROFILE_ID = '_auto-rollback';
  const EXPECTED_KEY_COUNT = 68;
  const MIN_TRAVEL_MM = 0.01;
  const MAX_TRAVEL_MM = 4.0;
  const PROFILE_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  const HEX_UID_RE = /^[0-9a-fA-F]{2}(?:\s+[0-9a-fA-F]{2})+$/;
  const BINARY_BYTE_RE = /^[01]{8}$/;

  // Official DAREU Thunder68 68-key layout ID whitelist (15 + 15 + 14 + 14 + 10 = 68).
  const OFFICIAL_THUNDER68_KEY_IDS = Object.freeze([
    'Esc', '!1', '@2', '#3', '$4', '%5', '^6', '&7', '*8', '(9', ')0', '_-', '+=', 'Backspace', 'Insert',
    'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '{[', '}]', '|\\', 'Del',
    'Caps Lock', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ':;', '"\'', 'Enter', 'PgUp',
    'ShiftL', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<,', '>.', '?/', 'ShiftR', 'Arrowup', 'PgDn',
    'CtrlL', 'WinL', 'AltL', 'Spacebar', 'AltR', 'Fn', 'CtrlR', 'ArrowL', 'ArrowD', 'ArrowR'
  ]);
  const OFFICIAL_THUNDER68_KEY_ID_SET = new Set(OFFICIAL_THUNDER68_KEY_IDS);

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function coerceStrictNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return NaN;
      const num = Number(trimmed);
      return Number.isFinite(num) ? num : NaN;
    }
    return NaN;
  }

  const VOLATILE_CONFIG_KEYS = Object.freeze([
    'mask',
    'maskMacro',
    'maskTrigger',
    'hintText',
    'hintSource',
    'mapPendingKey',
    'mapPendingSuperKey',
    'calibrationMap',
    'dragFlag',
    'mouseDownX',
    'mouseDownY',
    'mouseUpX',
    'mouseUpY',
    'keyboardBelowClickValue',
    'keyboardBelowClickUid',
    'belowUpdateFlag',
    'userCombineKeys',
    'showConfigureUI',
    'topMenuIndex'
  ]);

  const VOLATILE_SETTINGS_KEYS = Object.freeze([
    'deviceSN',
    'batteryInfo',
    'firmwareVersion',
    'moduleVersion',
    'dongleVersion'
  ]);

  function deepClone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function roundMm(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
  }

  function isValidProfileId(id) {
    return typeof id === 'string' && PROFILE_ID_RE.test(id);
  }

  function createProfileId(name, now = Date.now()) {
    const slug = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28);
    const suffix = Math.floor(Number(now) || Date.now()).toString(36);
    const base = slug ? `${slug}-${suffix}` : `profile-${suffix}`;
    return base.slice(0, 64);
  }

  function normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    const seen = new Set();
    const result = [];
    for (const raw of tags) {
      const tag = String(raw || '').trim().slice(0, 20);
      if (!tag) continue;
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(tag);
      if (result.length >= 6) break;
    }
    return result;
  }

  function createDefaultSuperkeys() {
    return {
      mappingData: {},
      socdKeys: [],
      endKeys: [],
      tglKeys: [],
      mtKeys: [],
      mptKeys: [],
      dskKeys: []
    };
  }

  function createDefaultMacros() {
    return Array.from({length: 16}, (_, idx) => ({
      name: `M${idx + 1}`,
      storeIndex: `77 ${idx.toString(16).padStart(2, '0').toUpperCase()}`,
      actionList: []
    }));
  }

  function sanitizeProfileConfig(rawConfig) {
    if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
      return null;
    }
    const copy = deepClone(rawConfig);
    for (const key of VOLATILE_CONFIG_KEYS) {
      delete copy[key];
    }

    if (copy.settings && typeof copy.settings === 'object' && !Array.isArray(copy.settings)) {
      for (const key of VOLATILE_SETTINGS_KEYS) {
        delete copy.settings[key];
      }
    } else {
      copy.settings = {
        sleeptime: 60,
        game_disable_list: [false, false, false, false, false, false, false, false],
        rate: 1000,
        theme: 0,
        themeIndex: 0,
        language: 1
      };
    }

    if (!copy.buttonMap || typeof copy.buttonMap !== 'object') {
      copy.buttonMap = {layerIndex: 0, mappingData: [{}, {}, {}, {}], bottomTabIndex: 0};
    } else {
      if (!Array.isArray(copy.buttonMap.mappingData)) {
        copy.buttonMap.mappingData = [{}, {}, {}, {}];
      }
      if (typeof copy.buttonMap.layerIndex !== 'number') copy.buttonMap.layerIndex = 0;
      if (typeof copy.buttonMap.bottomTabIndex !== 'number') copy.buttonMap.bottomTabIndex = 0;
    }

    if (!copy.triggerMode || typeof copy.triggerMode !== 'object') {
      copy.triggerMode = {triggerIndex: 0};
    }

    if (!isPlainObject(copy.lightness)) {
      copy.lightness = {
        effectId: 9,
        speed: 50,
        hexcolor: '#ffffff',
        brightness: 75,
        color: '#E64E20',
        progress: '100',
        frontBrightness: 75,
        frontEffectId: 4,
        frontSpeed: 0,
        frontColor: '#E64E20',
        frontHexColor: '#ffffff',
        mappingData: {}
      };
    } else {
      for (const field of ['effectId', 'brightness', 'speed']) {
        copy.lightness[field] = coerceStrictNumber(copy.lightness[field]);
      }
      for (const field of ['frontEffectId', 'frontBrightness', 'frontSpeed']) {
        if (copy.lightness[field] !== undefined && copy.lightness[field] !== null && copy.lightness[field] !== '') {
          copy.lightness[field] = coerceStrictNumber(copy.lightness[field]);
        }
      }
    }

    if (isPlainObject(copy.settings)) {
      for (const field of ['rate', 'sleeptime']) {
        if (copy.settings[field] !== undefined && copy.settings[field] !== null && copy.settings[field] !== '') {
          const num = coerceStrictNumber(copy.settings[field]);
          if (Number.isFinite(num)) copy.settings[field] = num;
        }
      }
    }

    if (isPlainObject(copy.triggerMode) && copy.triggerMode.triggerIndex !== undefined && copy.triggerMode.triggerIndex !== null) {
      const idx = coerceStrictNumber(copy.triggerMode.triggerIndex);
      if (Number.isFinite(idx)) copy.triggerMode.triggerIndex = idx;
    }

    const baseSuper = createDefaultSuperkeys();
    copy.superkeys = {
      ...baseSuper,
      ...(isPlainObject(copy.superkeys) ? copy.superkeys : {})
    };
    if (Array.isArray(copy.superkeys.mtKeys)) {
      copy.superkeys.mtKeys = copy.superkeys.mtKeys.map(item => (
        isPlainObject(item) && item.sliderValue !== undefined
          ? {...item, sliderValue: coerceStrictNumber(item.sliderValue)}
          : item
      ));
    }
    if (Array.isArray(copy.superkeys.socdKeys)) {
      copy.superkeys.socdKeys = copy.superkeys.socdKeys.map(item => {
        if (!isPlainObject(item)) return item;
        const next = {...item};
        if (next.behaviorMode !== undefined) next.behaviorMode = coerceStrictNumber(next.behaviorMode);
        if (next.socdTravelValue !== undefined) next.socdTravelValue = coerceStrictNumber(next.socdTravelValue);
        return next;
      });
    }
    if (Array.isArray(copy.superkeys.mptKeys)) {
      copy.superkeys.mptKeys = copy.superkeys.mptKeys.map(item => (
        isPlainObject(item) && Array.isArray(item.mptDis)
          ? {...item, mptDis: item.mptDis.map(coerceStrictNumber)}
          : item
      ));
    }

    if (!copy.macroMap || typeof copy.macroMap !== 'object') {
      copy.macroMap = {selectIndex: 0, defaultMacros: createDefaultMacros()};
    } else {
      if (!Array.isArray(copy.macroMap.defaultMacros)) {
        copy.macroMap.defaultMacros = createDefaultMacros();
      }
      if (typeof copy.macroMap.selectIndex !== 'number') copy.macroMap.selectIndex = 0;
    }

    if (!copy.fastTrigger || typeof copy.fastTrigger !== 'object') {
      copy.fastTrigger = {
        mappingData: {},
        travelValue: 1.5,
        isRTEnabled: false,
        sensitivity: 1.5,
        isIndependentSensitivity: false,
        triggerSensitivity: 1.5,
        resetSensitivity: 1.5
      };
    }

    if (Array.isArray(copy.keyValues)) {
      copy.keyValues = copy.keyValues.map(item => {
        if (!item || typeof item !== 'object') return item;
        const normalized = {...item};
        if (normalized.travelValue !== undefined && normalized.travelValue !== null) {
          const v = roundMm(normalized.travelValue);
          if (v !== null) normalized.travelValue = v;
        }
        for (const field of ['sensitivity', 'triggerSensitivity', 'resetSensitivity']) {
          if (normalized[field] === null || normalized[field] === undefined || normalized[field] === '') {
            if (normalized[field] === '') normalized[field] = null;
            continue;
          }
          const v = roundMm(normalized[field]);
          if (v !== null) normalized[field] = v;
        }
        normalized.isRTEnabled = Boolean(normalized.isRTEnabled);
        normalized.isIndependentSensitivity = Boolean(normalized.isIndependentSensitivity);
        return normalized;
      });
    }

    if (typeof copy.fastTriggerShow !== 'boolean') copy.fastTriggerShow = true;
    if (typeof copy.fastTriggerRTShow !== 'boolean') copy.fastTriggerRTShow = true;
    if (!copy.selectedGameProfile || typeof copy.selectedGameProfile !== 'object') {
      copy.selectedGameProfile = {category: '', id: ''};
    }

    return copy;
  }

  function validateProfileConfig(config, options = {}) {
    const errors = [];
    const warnings = [];
    if (!isPlainObject(config)) {
      return {valid: false, errors: ['配置体必须为 JSON 对象。'], warnings};
    }

    const liveKeySet = options && options.allowedKeyIds
      ? new Set(Array.from(options.allowedKeyIds).filter(id => typeof id === 'string' && id.length > 0))
      : null;
    const isAllowedKeyId = id => (
      typeof id === 'string'
      && OFFICIAL_THUNDER68_KEY_ID_SET.has(id)
      && (!liveKeySet || liveKeySet.size === 0 || liveKeySet.has(id))
    );

    if (!Array.isArray(config.keyValues)) {
      errors.push('缺少 keyValues 键程数组。');
    } else {
      if (config.keyValues.length !== EXPECTED_KEY_COUNT) {
        errors.push(`键位数量异常：预期 ${EXPECTED_KEY_COUNT} 键，实际为 ${config.keyValues.length} 键。`);
      }
      const seenIds = new Set();
      for (let i = 0; i < config.keyValues.length; i++) {
        const key = config.keyValues[i];
        if (!isPlainObject(key)) {
          errors.push(`keyValues[${i}] 不是有效对象。`);
          continue;
        }
        const id = typeof key.id === 'string' ? key.id : '';
        if (!id || !id.trim()) {
          errors.push(`keyValues[${i}] 缺少有效按键 id。`);
          continue;
        }
        if (!isAllowedKeyId(id)) {
          errors.push(`keyValues[${i}] 包含未知或非雷电68 键名：${id}。`);
          continue;
        }
        if (seenIds.has(id)) {
          errors.push(`存在重复按键 id：${id}。`);
        }
        seenIds.add(id);

        const travel = coerceStrictNumber(key.travelValue);
        if (!Number.isFinite(travel) || travel < MIN_TRAVEL_MM || travel > MAX_TRAVEL_MM) {
          errors.push(`按键 ${id} 触发行程超范围（${key.travelValue}，允许 ${MIN_TRAVEL_MM}–${MAX_TRAVEL_MM} mm）。`);
        }
        if (typeof key.isRTEnabled !== 'boolean') {
          errors.push(`按键 ${id} 的 isRTEnabled 必须为布尔值。`);
        }
        const rtEnabled = Boolean(key.isRTEnabled);
        const independentRt = Boolean(key.isIndependentSensitivity);
        for (const field of ['sensitivity', 'triggerSensitivity', 'resetSensitivity']) {
          if (key[field] === undefined || key[field] === null) continue;
          const val = coerceStrictNumber(key[field]);
          const isFieldActive = rtEnabled && (independentRt ? field !== 'sensitivity' : field === 'sensitivity');
          if (!Number.isFinite(val) || val < 0 || val > MAX_TRAVEL_MM || (val < MIN_TRAVEL_MM && (val !== 0 || isFieldActive))) {
            errors.push(`按键 ${id} 的 ${field} 超范围（${key[field]}，允许 ${MIN_TRAVEL_MM}–${MAX_TRAVEL_MM} mm）。`);
          }
        }
      }
    }

    if (!isPlainObject(config.buttonMap) || !Array.isArray(config.buttonMap.mappingData) || config.buttonMap.mappingData.length !== 4) {
      errors.push('buttonMap.mappingData 必须包含 4 层按键映射对象。');
    } else {
      for (let layerIdx = 0; layerIdx < 4; layerIdx++) {
        const layer = config.buttonMap.mappingData[layerIdx];
        if (!isPlainObject(layer)) {
          errors.push(`buttonMap.mappingData[${layerIdx}] 不是有效映射对象。`);
          continue;
        }
        for (const [keyId, entry] of Object.entries(layer)) {
          if (!isAllowedKeyId(keyId)) {
            errors.push(`buttonMap 第 ${layerIdx + 1} 层包含非法按键名：${keyId}。`);
            continue;
          }
          if (!isPlainObject(entry) || typeof entry.uid !== 'string' || !HEX_UID_RE.test(entry.uid.trim())) {
            errors.push(`buttonMap 第 ${layerIdx + 1} 层按键 ${keyId} 缺少有效十六进制 uid。`);
          }
        }
      }
    }

    if (!isPlainObject(config.lightness)) {
      errors.push('缺少 lightness 灯效配置。');
    } else {
      const brightness = coerceStrictNumber(config.lightness.brightness);
      const speed = coerceStrictNumber(config.lightness.speed);
      const effectId = coerceStrictNumber(config.lightness.effectId);
      if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) {
        errors.push(`灯效亮度超出范围（${config.lightness.brightness}，允许 0–100）。`);
      }
      if (!Number.isFinite(speed) || speed < 0 || speed > 100) {
        errors.push(`灯效速度超出范围（${config.lightness.speed}，允许 0–100）。`);
      }
      if (!Number.isInteger(effectId) || effectId < 0 || effectId > 99) {
        errors.push(`灯效模式编号无效（${config.lightness.effectId}）。`);
      }
      if (config.lightness.frontBrightness !== undefined && config.lightness.frontBrightness !== null && config.lightness.frontBrightness !== '') {
        const fb = coerceStrictNumber(config.lightness.frontBrightness);
        if (!Number.isFinite(fb) || fb < 0 || fb > 100) {
          errors.push(`前灯箱亮度超出范围（${config.lightness.frontBrightness}，允许 0–100）。`);
        }
      }
      if (config.lightness.frontSpeed !== undefined && config.lightness.frontSpeed !== null && config.lightness.frontSpeed !== '') {
        const fs = coerceStrictNumber(config.lightness.frontSpeed);
        if (!Number.isFinite(fs) || fs < 0 || fs > 100) {
          errors.push(`前灯箱速度超出范围（${config.lightness.frontSpeed}，允许 0–100）。`);
        }
      }
      if (config.lightness.frontEffectId !== undefined && config.lightness.frontEffectId !== null && config.lightness.frontEffectId !== '') {
        const fe = coerceStrictNumber(config.lightness.frontEffectId);
        if (!Number.isInteger(fe) || fe < 0 || fe > 99) {
          errors.push(`前灯箱模式编号无效（${config.lightness.frontEffectId}）。`);
        }
      }
    }

    if (!isPlainObject(config.macroMap) || !Array.isArray(config.macroMap.defaultMacros)) {
      errors.push('缺少 macroMap.defaultMacros 宏配置数组。');
    } else if (config.macroMap.defaultMacros.length > 32) {
      errors.push(`宏数量超出上限（${config.macroMap.defaultMacros.length} > 32）。`);
    } else {
      for (let mIdx = 0; mIdx < config.macroMap.defaultMacros.length; mIdx++) {
        const macro = config.macroMap.defaultMacros[mIdx];
        if (!isPlainObject(macro) || !Array.isArray(macro.actionList)) {
          errors.push(`macroMap.defaultMacros[${mIdx}] 缺少有效 actionList。`);
          continue;
        }
        for (let aIdx = 0; aIdx < macro.actionList.length; aIdx++) {
          const act = macro.actionList[aIdx];
          if (!isPlainObject(act)) {
            errors.push(`宏 ${macro.name || `M${mIdx + 1}`} 第 ${aIdx + 1} 步动作结构无效。`);
            continue;
          }
          if (typeof act.code !== 'string' || !act.code.trim()) {
            errors.push(`宏 ${macro.name || `M${mIdx + 1}`} 第 ${aIdx + 1} 步缺少按键 code。`);
          }
          if (typeof act.isDown !== 'boolean') {
            errors.push(`宏 ${macro.name || `M${mIdx + 1}`} 第 ${aIdx + 1} 步的 isDown 必须为布尔值。`);
          }
          const duration = coerceStrictNumber(act.duration);
          if (!Number.isFinite(duration) || duration < 0 || duration > 600000) {
            errors.push(`宏 ${macro.name || `M${mIdx + 1}`} 第 ${aIdx + 1} 步时长无效（${act.duration}）。`);
          }
        }
      }
    }

    if (!isPlainObject(config.superkeys)) {
      errors.push('缺少 superkeys 超级按键配置。');
    } else {
      if (config.superkeys.mappingData !== undefined) {
        if (!isPlainObject(config.superkeys.mappingData)) {
          errors.push('superkeys.mappingData 必须为对象。');
        } else {
          for (const keyId of Object.keys(config.superkeys.mappingData)) {
            if (!isAllowedKeyId(keyId)) {
              errors.push(`superkeys.mappingData 包含非法按键名：${keyId}。`);
            }
          }
        }
      }
      for (const arrKey of ['socdKeys', 'endKeys', 'tglKeys', 'mtKeys', 'mptKeys', 'dskKeys']) {
        if (!Array.isArray(config.superkeys[arrKey])) {
          errors.push(`superkeys.${arrKey} 必须为数组。`);
        }
      }
      const primaryKeyOf = (item, allowString) => {
        if (Array.isArray(item.keyboard)) return item.keyboard[0];
        return allowString && typeof item.keyboard === 'string' ? item.keyboard : null;
      };
      const isNonEmptyStr = v => typeof v === 'string' && v.trim().length > 0;

      if (Array.isArray(config.superkeys.mtKeys)) {
        config.superkeys.mtKeys.forEach((item, idx) => {
          if (!isPlainObject(item)) { errors.push(`superkeys.mtKeys[${idx}] 结构无效。`); return; }
          const kb = primaryKeyOf(item, false);
          if (!isAllowedKeyId(kb)) errors.push(`superkeys.mtKeys[${idx}] 引用非法按键：${kb}。`);
          if (!Array.isArray(item.originalKeys) || !isNonEmptyStr(item.originalKeys[0]) || !isNonEmptyStr(item.originalKeys[1])) {
            errors.push(`superkeys.mtKeys[${idx}] 缺少有效的 originalKeys（需 2 项）。`);
          }
          const slider = coerceStrictNumber(item.sliderValue);
          if (!Number.isInteger(slider) || slider < 0 || slider > 65535) {
            errors.push(`superkeys.mtKeys[${idx}] 的 sliderValue 无效（${item.sliderValue}）。`);
          }
        });
      }
      if (Array.isArray(config.superkeys.tglKeys)) {
        config.superkeys.tglKeys.forEach((item, idx) => {
          if (!isPlainObject(item)) { errors.push(`superkeys.tglKeys[${idx}] 结构无效。`); return; }
          const kb = primaryKeyOf(item, false);
          if (!isAllowedKeyId(kb)) errors.push(`superkeys.tglKeys[${idx}] 引用非法按键：${kb}。`);
          if (!Array.isArray(item.originalKeys) || !isNonEmptyStr(item.originalKeys[0])) {
            errors.push(`superkeys.tglKeys[${idx}] 缺少有效的 originalKeys[0]。`);
          }
        });
      }
      if (Array.isArray(config.superkeys.mptKeys)) {
        config.superkeys.mptKeys.forEach((item, idx) => {
          if (!isPlainObject(item)) { errors.push(`superkeys.mptKeys[${idx}] 结构无效。`); return; }
          const kb = primaryKeyOf(item, false);
          if (!isAllowedKeyId(kb)) errors.push(`superkeys.mptKeys[${idx}] 引用非法按键：${kb}。`);
          if (!Array.isArray(item.originalKeys) || item.originalKeys.length < 3 || !item.originalKeys.slice(0, 3).every(isNonEmptyStr)) {
            errors.push(`superkeys.mptKeys[${idx}] 缺少有效的 originalKeys（需 3 项）。`);
          }
          if (!Array.isArray(item.mptDis) || item.mptDis.length < 3 || !item.mptDis.slice(0, 3).every(d => {
            const n = coerceStrictNumber(d);
            return Number.isFinite(n) && n >= MIN_TRAVEL_MM && n <= MAX_TRAVEL_MM;
          })) {
            errors.push(`superkeys.mptKeys[${idx}] 的 mptDis 行程参数无效。`);
          }
        });
      }
      if (Array.isArray(config.superkeys.endKeys)) {
        config.superkeys.endKeys.forEach((item, idx) => {
          if (!isPlainObject(item)) { errors.push(`superkeys.endKeys[${idx}] 结构无效。`); return; }
          const kb = primaryKeyOf(item, true);
          if (!isAllowedKeyId(kb)) errors.push(`superkeys.endKeys[${idx}] 引用非法按键：${kb}。`);
          if (!Array.isArray(item.originalKeys) || !isNonEmptyStr(item.originalKeys[1])) {
            errors.push(`superkeys.endKeys[${idx}] 缺少有效的 originalKeys[1]。`);
          }
        });
      }
      if (Array.isArray(config.superkeys.socdKeys)) {
        config.superkeys.socdKeys.forEach((item, idx) => {
          if (!isPlainObject(item)) { errors.push(`superkeys.socdKeys[${idx}] 结构无效。`); return; }
          const kb = primaryKeyOf(item, true);
          if (!isAllowedKeyId(kb)) errors.push(`superkeys.socdKeys[${idx}] 主键非法：${kb}。`);
          const peer = Array.isArray(item.keys) ? item.keys[0] : null;
          if (!isAllowedKeyId(peer)) errors.push(`superkeys.socdKeys[${idx}] 配对键非法：${peer}。`);
          const mode = coerceStrictNumber(item.behaviorMode);
          if (!Number.isInteger(mode) || mode < 0 || mode > 255) {
            errors.push(`superkeys.socdKeys[${idx}] 的 behaviorMode 无效（${item.behaviorMode}）。`);
          }
          const travel = coerceStrictNumber(item.socdTravelValue);
          if (!Number.isFinite(travel) || travel < MIN_TRAVEL_MM || travel > MAX_TRAVEL_MM) {
            errors.push(`superkeys.socdKeys[${idx}] 的 socdTravelValue 超范围（${item.socdTravelValue}）。`);
          }
        });
      }
      if (Array.isArray(config.superkeys.dskKeys)) {
        config.superkeys.dskKeys.forEach((item, idx) => {
          if (!isPlainObject(item)) { errors.push(`superkeys.dskKeys[${idx}] 结构无效。`); return; }
          const kb = primaryKeyOf(item, false);
          if (!isAllowedKeyId(kb)) errors.push(`superkeys.dskKeys[${idx}] 引用非法按键：${kb}。`);
          if (!Array.isArray(item.originalKeys) || item.originalKeys.length < 1) {
            errors.push(`superkeys.dskKeys[${idx}] 缺少 originalKeys 数组。`);
          }
          if (!Array.isArray(item.rowBinary) || item.rowBinary.length < 4 || !item.rowBinary.slice(0, 4).every(b => typeof b === 'string' && BINARY_BYTE_RE.test(b))) {
            errors.push(`superkeys.dskKeys[${idx}] 的 rowBinary 必须为 4 组 8 位二进制字符串。`);
          }
        });
      }
    }

    if (errors.length > 12) {
      const extra = errors.length - 12;
      errors.splice(12);
      errors.push(`…另有 ${extra} 项校验错误`);
    }

    return {valid: errors.length === 0, errors, warnings};
  }

  function summarizeProfileConfig(config) {
    const keyValues = Array.isArray(config?.keyValues) ? config.keyValues : [];
    const travels = keyValues.map(k => Number(k?.travelValue)).filter(Number.isFinite);
    const avgTravel = travels.length ? Math.round((travels.reduce((a, b) => a + b, 0) / travels.length) * 100) / 100 : null;
    const minTravel = travels.length ? Math.min(...travels) : null;
    const maxTravel = travels.length ? Math.max(...travels) : null;
    const rtEnabledCount = keyValues.filter(k => k?.isRTEnabled).length;

    let remapCount = 0;
    if (Array.isArray(config?.buttonMap?.mappingData)) {
      for (const layer of config.buttonMap.mappingData) {
        if (layer && typeof layer === 'object') remapCount += Object.keys(layer).length;
      }
    }

    const sk = config?.superkeys || {};
    const superkeyCount = ['socdKeys', 'endKeys', 'tglKeys', 'mtKeys', 'mptKeys', 'dskKeys']
      .reduce((sum, key) => sum + (Array.isArray(sk[key]) ? sk[key].length : 0), 0);

    const macros = Array.isArray(config?.macroMap?.defaultMacros) ? config.macroMap.defaultMacros : [];
    const macroActiveCount = macros.filter(m => Array.isArray(m?.actionList) && m.actionList.length > 0).length;

    return {
      keyCount: keyValues.length,
      avgTravel,
      minTravel,
      maxTravel,
      rtEnabledCount,
      remapCount,
      superkeyCount,
      macroActiveCount,
      effectId: Number.isFinite(Number(config?.lightness?.effectId)) ? Number(config.lightness.effectId) : null,
      brightness: Number.isFinite(Number(config?.lightness?.brightness)) ? Number(config.lightness.brightness) : null
    };
  }

  function createProfileEnvelope({id, name, tags = [], notes = '', source = 'snapshot', config, createdAt, updatedAt}) {
    const cleanName = String(name || '').trim().slice(0, 60) || '未命名方案';
    const nowIso = new Date().toISOString();
    const safeId = isValidProfileId(id) ? id : createProfileId(cleanName);
    const sanitizedConfig = sanitizeProfileConfig(config);
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: safeId,
      name: cleanName,
      tags: normalizeTags(tags),
      notes: String(notes || '').trim().slice(0, 300),
      source: ['snapshot', 'imported', 'rollback'].includes(source) ? source : 'snapshot',
      createdAt: typeof createdAt === 'string' && createdAt ? createdAt : nowIso,
      updatedAt: typeof updatedAt === 'string' && updatedAt ? updatedAt : nowIso,
      summary: summarizeProfileConfig(sanitizedConfig),
      config: sanitizedConfig
    };
  }

  function parseImportedProfileJson(rawData, fallbackName = '导入方案') {
    let parsed = rawData;
    if (typeof rawData === 'string') {
      try {
        parsed = JSON.parse(rawData);
      } catch (error) {
        return {ok: false, profile: null, errors: [`JSON 解析失败：${error.message}`]};
      }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {ok: false, profile: null, errors: ['文件内容不是有效的 JSON 对象。']};
    }

    const isEnvelope = parsed.schemaVersion === PROFILE_SCHEMA_VERSION && parsed.config && typeof parsed.config === 'object';
    const rawConfig = isEnvelope ? parsed.config : parsed;
    const sanitized = sanitizeProfileConfig(rawConfig);
    const validation = validateProfileConfig(sanitized);
    if (!validation.valid) {
      return {ok: false, profile: null, errors: validation.errors};
    }

    const name = isEnvelope && parsed.name ? String(parsed.name) : fallbackName;
    const profile = createProfileEnvelope({
      id: createProfileId(name),
      name,
      tags: isEnvelope ? parsed.tags : ['导入'],
      notes: isEnvelope ? parsed.notes : '',
      source: 'imported',
      config: sanitized
    });
    return {ok: true, profile, errors: []};
  }

  function buildOfficialImportPayload(profileConfig, currentLiveConfig = null) {
    const sanitized = sanitizeProfileConfig(profileConfig);
    const liveSettings = currentLiveConfig?.settings && typeof currentLiveConfig.settings === 'object'
      ? currentLiveConfig.settings
      : {};
    const mergedSettings = {
      sleeptime: 60,
      game_disable_list: [false, false, false, false, false, false, false, false],
      rate: 1000,
      theme: 0,
      themeIndex: 0,
      language: 1,
      firmwareVersion: liveSettings.firmwareVersion || 'unknown',
      moduleVersion: liveSettings.moduleVersion || 'unknown',
      dongleVersion: liveSettings.dongleVersion || 'unknown',
      deviceSN: liveSettings.deviceSN || '',
      batteryInfo: liveSettings.batteryInfo || '65',
      ...(sanitized?.settings || {})
    };
    // Always preserve live hardware identity & battery telemetry so React UI does not lose state.
    for (const key of VOLATILE_SETTINGS_KEYS) {
      if (liveSettings[key] !== undefined) mergedSettings[key] = liveSettings[key];
    }

    return {
      topMenuIndex: typeof currentLiveConfig?.topMenuIndex === 'number' ? currentLiveConfig.topMenuIndex : 0,
      dragFlag: false,
      mouseDownX: 0,
      mouseDownY: 0,
      mouseUpY: -800,
      mouseUpX: -800,
      mapPendingKey: [],
      mapPendingSuperKey: [],
      keyboardBelowClickValue: -1,
      keyboardBelowClickUid: -1,
      belowUpdateFlag: false,
      userCombineKeys: null,
      hintText: '',
      hintSource: '',
      // Keep mask: true during USER_IMPORT_WHOLE_CONFIG so UI busy guard stays active until hardware end-frame unlocks it.
      mask: true,
      maskMacro: false,
      maskTrigger: false,
      showConfigureUI: false,
      calibrationMap: {keyLogs: [], calibrationInterval: null, calibrationData: []},
      ...sanitized,
      settings: mergedSettings
    };
  }

  function diffProfileConfigs(configA, configB) {
    const a = configA || {};
    const b = configB || {};

    const mapA = new Map((Array.isArray(a.keyValues) ? a.keyValues : []).map(k => [k.id, k]));
    const mapB = new Map((Array.isArray(b.keyValues) ? b.keyValues : []).map(k => [k.id, k]));
    const allIds = [...new Set([...mapA.keys(), ...mapB.keys()])];

    const travelChanges = [];
    const rtChanges = [];
    const changedKeySet = new Set();

    for (const id of allIds) {
      const ka = mapA.get(id);
      const kb = mapB.get(id);
      if (!ka || !kb) {
        changedKeySet.add(id);
        travelChanges.push({
          id,
          from: ka ? roundMm(ka.travelValue) : null,
          to: kb ? roundMm(kb.travelValue) : null
        });
        continue;
      }
      const ta = roundMm(ka.travelValue);
      const tb = roundMm(kb.travelValue);
      if (ta !== tb) {
        travelChanges.push({id, from: ta, to: tb});
        changedKeySet.add(id);
      }

      const rtA = Boolean(ka.isRTEnabled);
      const rtB = Boolean(kb.isRTEnabled);
      const indepA = Boolean(ka.isIndependentSensitivity);
      const indepB = Boolean(kb.isIndependentSensitivity);
      const sensA = roundMm(ka.sensitivity);
      const sensB = roundMm(kb.sensitivity);
      const trigA = roundMm(indepA ? ka.triggerSensitivity : ka.sensitivity);
      const trigB = roundMm(indepB ? kb.triggerSensitivity : kb.sensitivity);
      const rstA = roundMm(indepA ? ka.resetSensitivity : ka.sensitivity);
      const rstB = roundMm(indepB ? kb.resetSensitivity : kb.sensitivity);

      const rtDiffers = rtA !== rtB || (rtB && (indepA !== indepB || sensA !== sensB || trigA !== trigB || rstA !== rstB));
      if (rtDiffers) {
        rtChanges.push({
          id,
          fromEnabled: rtA,
          toEnabled: rtB,
          fromIndependent: indepA,
          toIndependent: indepB,
          fromSensitivity: sensA,
          toSensitivity: sensB,
          fromTrigger: trigA,
          toTrigger: trigB,
          fromReset: rstA,
          toReset: rstB
        });
        changedKeySet.add(id);
      }
    }

    const remapChanges = [];
    const layersA = Array.isArray(a.buttonMap?.mappingData) ? a.buttonMap.mappingData : [{}, {}, {}, {}];
    const layersB = Array.isArray(b.buttonMap?.mappingData) ? b.buttonMap.mappingData : [{}, {}, {}, {}];
    for (let layer = 0; layer < 4; layer++) {
      const la = layersA[layer] || {};
      const lb = layersB[layer] || {};
      const keys = new Set([...Object.keys(la), ...Object.keys(lb)]);
      for (const id of keys) {
        const va = la[id];
        const vb = lb[id];
        const uidA = va?.uid || '';
        const uidB = vb?.uid || '';
        const nameA = va?.value || va?.name || uidA || '默认';
        const nameB = vb?.value || vb?.name || uidB || '默认';
        if (uidA !== uidB || nameA !== nameB) {
          remapChanges.push({
            layer,
            id,
            fromUid: uidA || null,
            toUid: uidB || null,
            fromName: nameA,
            toName: nameB
          });
          changedKeySet.add(id);
        }
      }
    }

    const lightingChanges = [];
    for (const [field, label] of [
      ['effectId', '主键灯效模式'],
      ['brightness', '主键亮度'],
      ['speed', '主键速度'],
      ['color', '主键颜色'],
      ['frontEffectId', '前灯箱模式'],
      ['frontBrightness', '前灯箱亮度']
    ]) {
      const va = a.lightness?.[field];
      const vb = b.lightness?.[field];
      if (va !== vb && (va !== undefined || vb !== undefined)) {
        lightingChanges.push({field, label, from: va ?? null, to: vb ?? null});
      }
    }

    const superkeyChanges = [];
    for (const [key, label] of [
      ['socdKeys', 'SOCD'],
      ['dskKeys', 'DKS'],
      ['mtKeys', 'MT'],
      ['tglKeys', 'TGL'],
      ['mptKeys', 'MPT'],
      ['endKeys', 'END']
    ]) {
      const arrA = Array.isArray(a.superkeys?.[key]) ? a.superkeys[key] : [];
      const arrB = Array.isArray(b.superkeys?.[key]) ? b.superkeys[key] : [];
      if (JSON.stringify(arrA) !== JSON.stringify(arrB)) {
        superkeyChanges.push({kind: key, label, fromCount: arrA.length, toCount: arrB.length});
      }
    }

    const macroChanges = [];
    const macrosA = Array.isArray(a.macroMap?.defaultMacros) ? a.macroMap.defaultMacros : [];
    const macrosB = Array.isArray(b.macroMap?.defaultMacros) ? b.macroMap.defaultMacros : [];
    const macroLen = Math.max(macrosA.length, macrosB.length);
    for (let i = 0; i < macroLen; i++) {
      const ma = macrosA[i];
      const mb = macrosB[i];
      if (JSON.stringify(ma?.actionList || []) !== JSON.stringify(mb?.actionList || [])) {
        macroChanges.push({
          index: i,
          name: mb?.name || ma?.name || `M${i + 1}`,
          fromActions: ma?.actionList?.length || 0,
          toActions: mb?.actionList?.length || 0
        });
      }
    }

    const settingsChanges = [];
    const rateA = a.settings?.rate;
    const rateB = b.settings?.rate;
    if (rateA !== rateB && (rateA !== undefined || rateB !== undefined)) {
      settingsChanges.push({
        field: 'rate',
        label: '回报率',
        from: rateA !== undefined && rateA !== null ? `${rateA} Hz` : '--',
        to: rateB !== undefined && rateB !== null ? `${rateB} Hz` : '--'
      });
    }
    const sleepA = a.settings?.sleeptime;
    const sleepB = b.settings?.sleeptime;
    if (sleepA !== sleepB && (sleepA !== undefined || sleepB !== undefined)) {
      settingsChanges.push({
        field: 'sleeptime',
        label: '休眠时间',
        from: sleepA !== undefined && sleepA !== null ? `${sleepA} 分钟` : '--',
        to: sleepB !== undefined && sleepB !== null ? `${sleepB} 分钟` : '--'
      });
    }
    const gdlA = Array.isArray(a.settings?.game_disable_list) ? a.settings.game_disable_list.map(Boolean) : null;
    const gdlB = Array.isArray(b.settings?.game_disable_list) ? b.settings.game_disable_list.map(Boolean) : null;
    if (gdlA && gdlB && JSON.stringify(gdlA) !== JSON.stringify(gdlB)) {
      const fmtList = list => `已启用 ${list.filter(Boolean).length}/${list.length} 项`;
      settingsChanges.push({
        field: 'game_disable_list',
        label: '游戏模式禁用组合键',
        from: fmtList(gdlA),
        to: fmtList(gdlB)
      });
    } else if ((gdlA && !gdlB) || (!gdlA && gdlB)) {
      const fmtList = list => list ? `已启用 ${list.filter(Boolean).length}/${list.length} 项` : '--';
      settingsChanges.push({
        field: 'game_disable_list',
        label: '游戏模式禁用组合键',
        from: fmtList(gdlA),
        to: fmtList(gdlB)
      });
    }
    const trigModeA = a.triggerMode?.triggerIndex;
    const trigModeB = b.triggerMode?.triggerIndex;
    if (trigModeA !== trigModeB && (trigModeA !== undefined || trigModeB !== undefined)) {
      settingsChanges.push({
        field: 'triggerMode',
        label: '触发模式',
        from: trigModeA !== undefined && trigModeA !== null ? `模式 ${trigModeA}` : '--',
        to: trigModeB !== undefined && trigModeB !== null ? `模式 ${trigModeB}` : '--'
      });
    }

    const summaryParts = [];
    if (travelChanges.length) summaryParts.push(`触发行程 ${travelChanges.length} 键`);
    if (rtChanges.length) summaryParts.push(`快速触发 RT ${rtChanges.length} 键`);
    if (remapChanges.length) summaryParts.push(`改键 ${remapChanges.length} 处`);
    if (lightingChanges.length) summaryParts.push(`灯效 ${lightingChanges.length} 项`);
    if (superkeyChanges.length) summaryParts.push(`超级按键 ${superkeyChanges.length} 类`);
    if (macroChanges.length) summaryParts.push(`宏 ${macroChanges.length} 组`);
    if (settingsChanges.length) summaryParts.push(`系统/触发模式 ${settingsChanges.length} 项`);

    const hasChanges = summaryParts.length > 0;
    return {
      hasChanges,
      travelChanges,
      rtChanges,
      remapChanges,
      lightingChanges,
      superkeyChanges,
      macroChanges,
      settingsChanges,
      changedKeyIds: [...changedKeySet],
      summaryText: hasChanges ? summaryParts.join(' · ') : '两套方案的核心配置完全一致'
    };
  }

  function evaluateProfileApplyState({
    elapsedMs = 0,
    sawMask = false,
    busy = false,
    sentDelta = 0,
    deviceOpened = true,
    sendError = '',
    disconnected = false
  } = {}) {
    if (disconnected || !deviceOpened) {
      return {done: true, outcome: 'error', reason: 'disconnected'};
    }
    if (sendError) {
      return {done: true, outcome: 'error', reason: 'hid-send-error'};
    }
    if (sawMask && !busy && sentDelta > 0 && elapsedMs >= 800) {
      return {done: true, outcome: 'success', reason: 'confirmed'};
    }
    if (!sawMask && sentDelta === 0 && elapsedMs >= 3500) {
      return {done: true, outcome: 'error', reason: 'no-write-started'};
    }
    if (sawMask && !busy && sentDelta === 0 && elapsedMs >= 2000) {
      return {done: true, outcome: 'error', reason: 'no-packets-sent'};
    }
    if (elapsedMs >= 20000 || (!sawMask && sentDelta > 0 && elapsedMs >= 6000)) {
      return {done: true, outcome: 'warning', reason: 'timeout-unconfirmed'};
    }
    return {done: false, outcome: 'pending', reason: 'waiting'};
  }

  return {
    PROFILE_SCHEMA_VERSION,
    ROLLBACK_PROFILE_ID,
    EXPECTED_KEY_COUNT,
    MIN_TRAVEL_MM,
    MAX_TRAVEL_MM,
    OFFICIAL_THUNDER68_KEY_IDS,
    VOLATILE_CONFIG_KEYS,
    VOLATILE_SETTINGS_KEYS,
    isValidProfileId,
    createProfileId,
    normalizeTags,
    sanitizeProfileConfig,
    validateProfileConfig,
    summarizeProfileConfig,
    createProfileEnvelope,
    parseImportedProfileJson,
    buildOfficialImportPayload,
    diffProfileConfigs,
    evaluateProfileApplyState
  };
});
