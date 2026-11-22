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

    if (!copy.lightness || typeof copy.lightness !== 'object') {
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
    }

    const baseSuper = createDefaultSuperkeys();
    copy.superkeys = {
      ...baseSuper,
      ...(copy.superkeys && typeof copy.superkeys === 'object' ? copy.superkeys : {})
    };

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

  function validateProfileConfig(config) {
    const errors = [];
    const warnings = [];
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return {valid: false, errors: ['配置体必须为 JSON 对象。'], warnings};
    }

    if (!Array.isArray(config.keyValues)) {
      errors.push('缺少 keyValues 键程数组。');
    } else {
      if (config.keyValues.length !== EXPECTED_KEY_COUNT) {
        errors.push(`键位数量异常：预期 ${EXPECTED_KEY_COUNT} 键，实际为 ${config.keyValues.length} 键。`);
      }
      const seenIds = new Set();
      for (let i = 0; i < config.keyValues.length; i++) {
        const key = config.keyValues[i];
        if (!key || typeof key !== 'object') {
          errors.push(`keyValues[${i}] 不是有效对象。`);
          continue;
        }
        const id = typeof key.id === 'string' ? key.id.trim() : '';
        if (!id) {
          errors.push(`keyValues[${i}] 缺少有效按键 id。`);
          continue;
        }
        if (seenIds.has(id)) {
          errors.push(`存在重复按键 id：${id}。`);
        }
        seenIds.add(id);

        const travel = Number(key.travelValue);
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
          const val = Number(key[field]);
          const isFieldActive = rtEnabled && (independentRt ? field !== 'sensitivity' : field === 'sensitivity');
          if (!Number.isFinite(val) || val < 0 || val > MAX_TRAVEL_MM || (val < MIN_TRAVEL_MM && (val !== 0 || isFieldActive))) {
            errors.push(`按键 ${id} 的 ${field} 超范围（${key[field]}，允许 ${MIN_TRAVEL_MM}–${MAX_TRAVEL_MM} mm）。`);
          }
        }
      }
    }

    if (!config.buttonMap || !Array.isArray(config.buttonMap.mappingData) || config.buttonMap.mappingData.length !== 4) {
      errors.push('buttonMap.mappingData 必须包含 4 层按键映射对象。');
    } else if (config.buttonMap.mappingData.some(layer => !layer || typeof layer !== 'object' || Array.isArray(layer))) {
      errors.push('buttonMap.mappingData 中存在非对象层数据。');
    }

    if (!config.lightness || typeof config.lightness !== 'object') {
      errors.push('缺少 lightness 灯效配置。');
    } else {
      const brightness = Number(config.lightness.brightness);
      const speed = Number(config.lightness.speed);
      const effectId = Number(config.lightness.effectId);
      if (!Number.isFinite(brightness) || brightness < 0 || brightness > 100) {
        errors.push(`灯效亮度超出范围（${config.lightness.brightness}，允许 0–100）。`);
      }
      if (!Number.isFinite(speed) || speed < 0 || speed > 100) {
        errors.push(`灯效速度超出范围（${config.lightness.speed}，允许 0–100）。`);
      }
      if (!Number.isFinite(effectId) || effectId < 0 || effectId > 99) {
        errors.push(`灯效模式编号无效（${config.lightness.effectId}）。`);
      }
    }

    if (!config.macroMap || !Array.isArray(config.macroMap.defaultMacros)) {
      errors.push('缺少 macroMap.defaultMacros 宏配置数组。');
    } else if (config.macroMap.defaultMacros.length > 32) {
      errors.push(`宏数量超出上限（${config.macroMap.defaultMacros.length} > 32）。`);
    } else if (config.macroMap.defaultMacros.some(m => !m || !Array.isArray(m.actionList))) {
      errors.push('存在缺少 actionList 的宏条目。');
    }

    if (!config.superkeys || typeof config.superkeys !== 'object') {
      errors.push('缺少 superkeys 超级按键配置。');
    } else {
      for (const arrKey of ['socdKeys', 'endKeys', 'tglKeys', 'mtKeys', 'mptKeys', 'dskKeys']) {
        if (!Array.isArray(config.superkeys[arrKey])) {
          errors.push(`superkeys.${arrKey} 必须为数组。`);
        }
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
      mask: false,
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

    const summaryParts = [];
    if (travelChanges.length) summaryParts.push(`触发行程 ${travelChanges.length} 键`);
    if (rtChanges.length) summaryParts.push(`快速触发 RT ${rtChanges.length} 键`);
    if (remapChanges.length) summaryParts.push(`改键 ${remapChanges.length} 处`);
    if (lightingChanges.length) summaryParts.push(`灯效 ${lightingChanges.length} 项`);
    if (superkeyChanges.length) summaryParts.push(`超级按键 ${superkeyChanges.length} 类`);
    if (macroChanges.length) summaryParts.push(`宏 ${macroChanges.length} 组`);

    const hasChanges = summaryParts.length > 0;
    return {
      hasChanges,
      travelChanges,
      rtChanges,
      remapChanges,
      lightingChanges,
      superkeyChanges,
      macroChanges,
      changedKeyIds: [...changedKeySet],
      summaryText: hasChanges ? summaryParts.join(' · ') : '两套方案的核心配置完全一致'
    };
  }

  return {
    PROFILE_SCHEMA_VERSION,
    ROLLBACK_PROFILE_ID,
    EXPECTED_KEY_COUNT,
    MIN_TRAVEL_MM,
    MAX_TRAVEL_MM,
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
    diffProfileConfigs
  };
});
