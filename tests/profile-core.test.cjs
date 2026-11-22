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
  const keyValues = Array.from({length: 68}, (_, i) => ({
    id: i === 0 ? 'W' : i === 1 ? 'A' : i === 2 ? 'S' : i === 3 ? 'D' : `K${i}`,
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
  badTravel.keyValues[1].sensitivity = 0;
  const resRange = profileCore.validateProfileConfig(badTravel);
  assert.equal(resRange.valid, false);
  assert.ok(resRange.errors.length >= 2);

  const dupKey = makeValidConfig();
  dupKey.keyValues[1].id = dupKey.keyValues[0].id;
  assert.equal(profileCore.validateProfileConfig(dupKey).valid, false);

  const badLight = makeValidConfig();
  badLight.lightness.brightness = 150;
  assert.equal(profileCore.validateProfileConfig(badLight).valid, false);
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

  assert.equal(payload.mask, false);
  assert.deepEqual(payload.mapPendingKey, []);
  assert.deepEqual(payload.calibrationMap, {keyLogs: [], calibrationInterval: null, calibrationData: []});
  assert.equal(payload.topMenuIndex, 2);
  assert.equal(payload.settings.firmwareVersion, '1.3.5');
  assert.equal(payload.settings.batteryInfo, '5a');
  assert.equal(payload.settings.deviceSN, 'LIVE-SN');
  assert.equal(payload.keyValues.length, 68);
});

test('diffProfileConfigs accurately summarizes travel, RT, remap, lighting, superkey, and macro changes', () => {
  const office = profileCore.sanitizeProfileConfig(makeValidConfig());
  const fps = profileCore.sanitizeProfileConfig(makeValidConfig());

  fps.keyValues[0].travelValue = 0.1; // W
  fps.keyValues[0].isRTEnabled = true;
  fps.keyValues[0].sensitivity = 0.02;
  fps.keyValues[1].travelValue = 0.1; // A
  fps.keyValues[1].isRTEnabled = true;
  fps.keyValues[1].isIndependentSensitivity = true;
  fps.keyValues[1].triggerSensitivity = 0.04;
  fps.keyValues[1].resetSensitivity = 0.08;
  fps.buttonMap.mappingData[0].CapsLock = {uid: '00 29', value: 'Esc'};
  fps.lightness.brightness = 40;
  fps.superkeys.socdKeys.push({keyboard: ['A'], keys: ['D'], behaviorMode: 1, socdTravelValue: 0.2});
  fps.macroMap.defaultMacros[0].actionList.push({code: 'KeyA', isDown: true, duration: 10});

  const diff = profileCore.diffProfileConfigs(office, fps);
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.travelChanges.length, 2);
  assert.equal(diff.rtChanges.length, 2);
  assert.equal(diff.remapChanges.length, 1);
  assert.equal(diff.lightingChanges.length, 1);
  assert.equal(diff.superkeyChanges.length, 1);
  assert.equal(diff.macroChanges.length, 1);
  assert.match(diff.summaryText, /触发行程 2 键/);
  assert.match(diff.summaryText, /快速触发 RT 2 键/);
  assert.match(diff.summaryText, /改键 1 处/);

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
