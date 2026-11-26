const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const profileCore = require('../app/profile-core.js');
const {
  resolveProfileFilePath,
  listProfileSummaries,
  readProfileFile,
  saveProfileFile,
  deleteProfileFile
} = require('../app/local-core.cjs');

function makeValidConfig(overrides = {}) {
  const keyValues = profileCore.OFFICIAL_THUNDER68_KEY_IDS.map(id => ({
    id,
    travelValue: 1.5,
    isRTEnabled: false,
    sensitivity: 0.5,
    isIndependentSensitivity: false,
    triggerSensitivity: 0.5,
    resetSensitivity: 0.5
  }));
  return {
    mask: true,
    maskMacro: true,
    hintText: '正在保存',
    hintSource: 'operation',
    mapPendingKey: ['W', 'A'],
    calibrationMap: {keyLogs: [1, 2], calibrationInterval: 99, calibrationData: []},
    buttonMap: {layerIndex: 0, mappingData: [{}, {}, {}, {}], bottomTabIndex: 0},
    triggerMode: {triggerIndex: 0},
    lightness: {effectId: 9, brightness: 75, speed: 50, color: '#E64E20', frontEffectId: 4, frontBrightness: 75},
    superkeys: {mappingData: {}, socdKeys: [], endKeys: [], tglKeys: [], mtKeys: [], mptKeys: [], dskKeys: []},
    settings: {
      sleeptime: 60,
      game_disable_list: [false, false, false, false, false, false, false, false],
      rate: 1000,
      deviceSN: 'SECRET_SN_123',
      batteryInfo: '50',
      firmwareVersion: '1.3.0'
    },
    macroMap: {selectIndex: 0, defaultMacros: [{name: 'M1', storeIndex: '77 00', actionList: []}]},
    fastTrigger: {mappingData: {}, travelValue: 1.5, isRTEnabled: false},
    keyValues,
    fastTriggerShow: true,
    fastTriggerRTShow: true,
    selectedGameProfile: {category: '', id: ''},
    ...overrides
  };
}

test('sanitizeProfileConfig strips volatile runtime and device-identity fields', () => {
  const raw = makeValidConfig();
  const clean = profileCore.sanitizeProfileConfig(raw);
  assert.equal('mask' in clean, false);
  assert.equal('hintText' in clean, false);
  assert.equal('mapPendingKey' in clean, false);
  assert.equal('calibrationMap' in clean, false);
  assert.equal('deviceSN' in clean.settings, false);
  assert.equal('batteryInfo' in clean.settings, false);
  assert.equal('firmwareVersion' in clean.settings, false);
  assert.equal(clean.settings.rate, 1000);
  assert.equal(clean.keyValues.length, 68);
});

test('validateProfileConfig enforces 68-key count, uniqueness, and travel/RT/lighting ranges', () => {
  const valid = profileCore.validateProfileConfig(profileCore.sanitizeProfileConfig(makeValidConfig()));
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);

  const shortKeys = makeValidConfig();
  shortKeys.keyValues = shortKeys.keyValues.slice(0, 60);
  const resShort = profileCore.validateProfileConfig(shortKeys);
  assert.equal(resShort.valid, false);
  assert.match(resShort.errors.join(' '), /68/);

  const badTravel = makeValidConfig();
  badTravel.keyValues[0].travelValue = 9.99;
  badTravel.keyValues[1].isRTEnabled = true;
  badTravel.keyValues[1].sensitivity = 0;
  const resRange = profileCore.validateProfileConfig(badTravel);
  assert.equal(resRange.valid, false);
  assert.ok(resRange.errors.length >= 2);

  // Official firmware readback sets null (or 0) sensitivity on keys with RT disabled (e.g. ArrowR in game presets)
  const gamePresetReadback = makeValidConfig({settings: {sleeptime: 60, rate: 8000}});
  const wKey = gamePresetReadback.keyValues.find(k => k.id === 'W');
  const arrowR = gamePresetReadback.keyValues.find(k => k.id === 'ArrowR');
  const arrowL = gamePresetReadback.keyValues.find(k => k.id === 'ArrowL');
  wKey.isRTEnabled = true;
  wKey.travelValue = 0.2;
  wKey.sensitivity = 0.02;
  wKey.triggerSensitivity = null;
  wKey.resetSensitivity = null;
  arrowR.isRTEnabled = false;
  arrowR.sensitivity = null;
  arrowR.triggerSensitivity = null;
  arrowR.resetSensitivity = null;
  arrowL.isRTEnabled = false;
  arrowL.sensitivity = 0;
  arrowL.triggerSensitivity = 0;
  arrowL.resetSensitivity = 0;
  const sanitizedPreset = profileCore.sanitizeProfileConfig(gamePresetReadback);
  const sanitizedArrowR = sanitizedPreset.keyValues.find(k => k.id === 'ArrowR');
  assert.equal(sanitizedArrowR.sensitivity, null);
  assert.equal(sanitizedArrowR.triggerSensitivity, null);
  assert.equal(sanitizedArrowR.resetSensitivity, null);
  assert.equal(sanitizedPreset.settings.rate, 8000);
  const presetValidation = profileCore.validateProfileConfig(sanitizedPreset);
  assert.equal(presetValidation.valid, true);
  assert.deepEqual(presetValidation.errors, []);

  const dupKey = makeValidConfig();
  dupKey.keyValues[1].id = dupKey.keyValues[0].id;
  assert.equal(profileCore.validateProfileConfig(dupKey).valid, false);

  const badLight = makeValidConfig();
  badLight.lightness.brightness = 150;
  assert.equal(profileCore.validateProfileConfig(badLight).valid, false);
});

test('P0-1 anti-brick validation rejects foreign key IDs, invalid superkeys/macros, and non-numeric lightness', () => {
  assert.equal(profileCore.OFFICIAL_THUNDER68_KEY_IDS.length, 68);
  assert.equal(new Set(profileCore.OFFICIAL_THUNDER68_KEY_IDS).size, 68);

  // Unknown key ID in keyValues
  const badKeyVal = makeValidConfig();
  badKeyVal.keyValues[0].id = 'F13';
  const resBadKey = profileCore.validateProfileConfig(badKeyVal);
  assert.equal(resBadKey.valid, false);
  assert.match(resBadKey.errors.join(' '), /F13/);

  // Unknown key ID and invalid uid in buttonMap
  const badButtonMap = makeValidConfig();
  badButtonMap.buttonMap.mappingData[0].CapsLock = {uid: '00 29', value: 'Esc'}; // should be "Caps Lock"
  badButtonMap.buttonMap.mappingData[1]['Caps Lock'] = {uid: 'not-hex', value: 'Esc'};
  const resBadMap = profileCore.validateProfileConfig(badButtonMap);
  assert.equal(resBadMap.valid, false);
  assert.ok(resBadMap.errors.length >= 2);

  // Invalid superkeys references and substructures
  const badSuper = makeValidConfig();
  badSuper.superkeys.socdKeys.push({keyboard: ['A'], keys: ['BAD_KEY'], behaviorMode: 1, socdTravelValue: 0.2});
  badSuper.superkeys.mtKeys.push({keyboard: ['W'], originalKeys: ['W'], sliderValue: 'bad'});
  badSuper.superkeys.dskKeys.push({keyboard: ['W'], originalKeys: ['W'], rowBinary: ['101', '00000000', '00000000', '00000000']});
  const resBadSuper = profileCore.validateProfileConfig(badSuper);
  assert.equal(resBadSuper.valid, false);
  assert.ok(resBadSuper.errors.length >= 3);

  // Valid superkeys pass
  const goodSuper = makeValidConfig();
  goodSuper.superkeys.socdKeys.push({keyboard: ['A'], keys: ['D'], behaviorMode: 1, socdTravelValue: 0.2});
  goodSuper.superkeys.mtKeys.push({keyboard: ['Caps Lock'], originalKeys: ['Esc', 'Ctrl'], sliderValue: '200'});
  goodSuper.superkeys.dskKeys.push({keyboard: ['Spacebar'], originalKeys: ['Space'], rowBinary: ['00000001', '00000000', '00000000', '00000000']});
  const cleanGoodSuper = profileCore.sanitizeProfileConfig(goodSuper);
  assert.equal(cleanGoodSuper.superkeys.mtKeys[0].sliderValue, 200);
  assert.equal(profileCore.validateProfileConfig(cleanGoodSuper).valid, true);

  // Invalid macro action
  const badMacro = makeValidConfig();
  badMacro.macroMap.defaultMacros[0].actionList.push({code: '', isDown: 'yes', duration: -5});
  assert.equal(profileCore.validateProfileConfig(badMacro).valid, false);

  // Lightness numeric normalization: numeric strings coerce to Number; NaN/empty/float effectId rejected
  const stringLight = makeValidConfig();
  stringLight.lightness.effectId = '10';
  stringLight.lightness.brightness = '80';
  stringLight.lightness.speed = '40';
  const cleanLight = profileCore.sanitizeProfileConfig(stringLight);
  assert.strictEqual(cleanLight.lightness.effectId, 10);
  assert.strictEqual(cleanLight.lightness.brightness, 80);
  assert.strictEqual(cleanLight.lightness.speed, 40);
  assert.equal(profileCore.validateProfileConfig(cleanLight).valid, true);

  const nanLight = makeValidConfig();
  nanLight.lightness.effectId = 'not-a-num';
  nanLight.lightness.brightness = '';
  nanLight.lightness.speed = null;
  const cleanNanLight = profileCore.sanitizeProfileConfig(nanLight);
  assert.equal(Number.isNaN(cleanNanLight.lightness.effectId), true);
  assert.equal(profileCore.validateProfileConfig(cleanNanLight).valid, false);

  const floatEffect = makeValidConfig();
  floatEffect.lightness.effectId = 9.5;
  assert.equal(profileCore.validateProfileConfig(floatEffect).valid, false);
});

test('P0-2 evaluateProfileApplyState separates confirmed success, timeout warning, and error/disconnect', () => {
  // Pending while mask still busy
  assert.equal(
    profileCore.evaluateProfileApplyState({elapsedMs: 1200, sawMask: true, busy: true, sentDelta: 50, deviceOpened: true}).done,
    false
  );
  // Confirmed success only when mask toggled, unlocked, packets sent, no errors, still connected
  const ok = profileCore.evaluateProfileApplyState({elapsedMs: 1500, sawMask: true, busy: false, sentDelta: 85, deviceOpened: true});
  assert.deepEqual(ok, {done: true, outcome: 'success', reason: 'confirmed'});

  // Timeout while mask stays busy -> warning (NEVER success!)
  const timeout = profileCore.evaluateProfileApplyState({elapsedMs: 20050, sawMask: true, busy: true, sentDelta: 40, deviceOpened: true});
  assert.deepEqual(timeout, {done: true, outcome: 'warning', reason: 'timeout-unconfirmed'});

  // Packets sent without observing mask after 6s -> warning (NEVER success!)
  const noMaskWarn = profileCore.evaluateProfileApplyState({elapsedMs: 6200, sawMask: false, busy: false, sentDelta: 12, deviceOpened: true});
  assert.deepEqual(noMaskWarn, {done: true, outcome: 'warning', reason: 'timeout-unconfirmed'});

  // Disconnect -> error
  const disc = profileCore.evaluateProfileApplyState({elapsedMs: 900, sawMask: true, busy: true, sentDelta: 20, deviceOpened: false});
  assert.deepEqual(disc, {done: true, outcome: 'error', reason: 'disconnected'});

  // HID send error -> error
  const err = profileCore.evaluateProfileApplyState({elapsedMs: 500, sawMask: true, busy: true, sentDelta: 10, deviceOpened: true, sendError: 'Transfer failed'});
  assert.deepEqual(err, {done: true, outcome: 'error', reason: 'hid-send-error'});

  // No packets sent and no mask after 3.5s -> error
  const stalled = profileCore.evaluateProfileApplyState({elapsedMs: 3600, sawMask: false, busy: false, sentDelta: 0, deviceOpened: true});
  assert.deepEqual(stalled, {done: true, outcome: 'error', reason: 'no-write-started'});
});

test('buildOfficialImportPayload restores safe runtime defaults and preserves live hardware telemetry', () => {
  const live = makeValidConfig({
    topMenuIndex: 2,
    settings: {
      sleeptime: 30,
      rate: 1000,
      firmwareVersion: '1.3.5',
      dongleVersion: '2.0.1',
      batteryInfo: '5a',
      deviceSN: 'LIVE-SN'
    }
  });
  const sanitized = profileCore.sanitizeProfileConfig(makeValidConfig());
  const payload = profileCore.buildOfficialImportPayload(sanitized, live);

  assert.equal(payload.mask, true);
  assert.deepEqual(payload.mapPendingKey, []);
  assert.deepEqual(payload.calibrationMap, {keyLogs: [], calibrationInterval: null, calibrationData: []});
  assert.equal(payload.topMenuIndex, 2);
  assert.equal(payload.settings.firmwareVersion, '1.3.5');
  assert.equal(payload.settings.batteryInfo, '5a');
  assert.equal(payload.settings.deviceSN, 'LIVE-SN');
  assert.equal(payload.keyValues.length, 68);
});

test('diffProfileConfigs accurately summarizes travel, RT, remap, lighting, superkey, macro, and settings/triggerMode changes', () => {
  const office = profileCore.sanitizeProfileConfig(makeValidConfig());
  const fps = profileCore.sanitizeProfileConfig(makeValidConfig());

  const wFps = fps.keyValues.find(k => k.id === 'W');
  const aFps = fps.keyValues.find(k => k.id === 'A');
  wFps.travelValue = 0.1; // W
  wFps.isRTEnabled = true;
  wFps.sensitivity = 0.02;
  aFps.travelValue = 0.1; // A
  aFps.isRTEnabled = true;
  aFps.isIndependentSensitivity = true;
  aFps.triggerSensitivity = 0.04;
  aFps.resetSensitivity = 0.08;
  fps.buttonMap.mappingData[0]['Caps Lock'] = {uid: '00 29', value: 'Esc'};
  fps.lightness.brightness = 40;
  fps.superkeys.socdKeys.push({keyboard: ['A'], keys: ['D'], behaviorMode: 1, socdTravelValue: 0.2});
  fps.macroMap.defaultMacros[0].actionList.push({code: 'KeyA', isDown: true, duration: 10});
  fps.settings.rate = 8000;
  fps.settings.sleeptime = 30;
  fps.settings.game_disable_list = [true, false, false, false, false, false, false, false];
  fps.triggerMode.triggerIndex = 1;

  const diff = profileCore.diffProfileConfigs(office, fps);
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.travelChanges.length, 2);
  assert.equal(diff.rtChanges.length, 2);
  assert.equal(diff.remapChanges.length, 1);
  assert.equal(diff.lightingChanges.length, 1);
  assert.equal(diff.superkeyChanges.length, 1);
  assert.equal(diff.macroChanges.length, 1);
  assert.equal(diff.settingsChanges.length, 4);
  assert.match(diff.summaryText, /触发行程 2 键/);
  assert.match(diff.summaryText, /快速触发 RT 2 键/);
  assert.match(diff.summaryText, /改键 1 处/);
  assert.match(diff.summaryText, /系统\/触发模式 4 项/);

  const same = profileCore.diffProfileConfigs(office, office);
  assert.equal(same.hasChanges, false);
});

test('parseImportedProfileJson accepts both envelope and raw official config formats', () => {
  const raw = makeValidConfig();
  const fromRaw = profileCore.parseImportedProfileJson(JSON.stringify(raw), '官方导出');
  assert.equal(fromRaw.ok, true);
  assert.equal(fromRaw.profile.name, '官方导出');
  assert.equal(fromRaw.profile.config.keyValues.length, 68);

  const env = profileCore.createProfileEnvelope({name: 'FPS 方案', tags: ['FPS', '0.1mm'], config: raw});
  const fromEnv = profileCore.parseImportedProfileJson(JSON.stringify(env));
  assert.equal(fromEnv.ok, true);
  assert.equal(fromEnv.profile.name, 'FPS 方案');
  assert.deepEqual(fromEnv.profile.tags, ['FPS', '0.1mm']);

  const broken = profileCore.parseImportedProfileJson('{bad json');
  assert.equal(broken.ok, false);
});

test('profile file storage prevents path traversal and persists CRUD atomically', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thunder68-profiles-'));
  try {
    assert.equal(resolveProfileFilePath(tmp, '../evil'), null);
    assert.equal(resolveProfileFilePath(tmp, 'foo/bar'), null);
    assert.equal(resolveProfileFilePath(tmp, 'good_id-1'), path.join(tmp, 'good_id-1.json'));

    const saved = saveProfileFile(tmp, {
      id: 'fps_main',
      name: 'FPS 极速',
      tags: ['FPS'],
      config: makeValidConfig()
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.profile.id, 'fps_main');

    const list = listProfileSummaries(tmp);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'FPS 极速');

    const loaded = readProfileFile(tmp, 'fps_main');
    assert.equal(loaded.config.keyValues.length, 68);
    assert.equal('mask' in loaded.config, false);

    assert.equal(deleteProfileFile(tmp, 'fps_main').ok, true);
    assert.equal(listProfileSummaries(tmp).length, 0);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});
