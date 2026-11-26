const {test} = require('node:test');
const assert = require('node:assert/strict');
const keyTester = require('../app/key-tester.js');
const {OFFICIAL_THUNDER68_KEY_IDS} = require('../app/profile-core.js');

test('self-authored 68-key layout has exactly 68 keys and balanced 16.0u rows', () => {
  assert.equal(keyTester.LAYOUT_68_ROWS.length, 5);
  let totalKeys = 0;
  for (const row of keyTester.LAYOUT_68_ROWS) {
    totalKeys += row.length;
    const widthSum = row.reduce((sum, key) => sum + key.u, 0);
    assert.equal(widthSum, 16);
  }
  assert.equal(totalKeys, 68);
});

test('key tester tracks simultaneous NKRO peak, ignores OS auto-repeat, and resets cleanly', () => {
  const eng = keyTester.createKeyTesterEngine();
  eng.onKeyDown({code: 'KeyW', timestamp: 100});
  eng.onKeyDown({code: 'KeyA', timestamp: 110});
  eng.onKeyDown({code: 'ShiftLeft', timestamp: 120});
  eng.onKeyDown({code: 'Space', timestamp: 130});
  // OS repeat should be ignored
  const rep = eng.onKeyDown({code: 'KeyW', timestamp: 400, repeat: true});
  assert.equal(rep.ignored, true);

  let snap = eng.snapshot();
  assert.equal(snap.activeCount, 4);
  assert.equal(snap.peakNkro, 4);
  assert.equal(snap.totalPresses, 4);

  eng.onKeyUp({code: 'Space', timestamp: 200});
  eng.releaseAll();
  snap = eng.snapshot();
  assert.equal(snap.activeCount, 0);
  assert.equal(snap.peakNkro, 4);

  eng.reset();
  snap = eng.snapshot();
  assert.equal(snap.peakNkro, 0);
  assert.equal(snap.totalPresses, 0);
});

test('RT chatter detector catches <15ms severe and 15-25ms warning double-triggers', () => {
  const eng = keyTester.createKeyTesterEngine();
  // Normal press & release
  eng.onKeyDown({code: 'KeyD', timestamp: 1000});
  eng.onKeyUp({code: 'KeyD', timestamp: 1050});
  // Severe bounce 8ms after release (< 15ms)
  const severe = eng.onKeyDown({code: 'KeyD', timestamp: 1058});
  assert.equal(severe.chatterSeverity, 'severe');
  assert.equal(severe.bounceMs, 8);
  eng.onKeyUp({code: 'KeyD', timestamp: 1100});

  // Warning bounce 20ms after release (< 25ms)
  const warn = eng.onKeyDown({code: 'KeyD', timestamp: 1120});
  assert.equal(warn.chatterSeverity, 'warn');
  assert.equal(warn.bounceMs, 20);
  eng.onKeyUp({code: 'KeyD', timestamp: 1180});

  // Clean press 60ms after release
  const clean = eng.onKeyDown({code: 'KeyD', timestamp: 1240});
  assert.equal(clean.chatterSeverity, null);

  const snap = eng.snapshot();
  assert.equal(snap.severeChatterCount, 1);
  assert.equal(snap.warnChatterCount, 1);
  assert.equal(snap.chatterEvents.length, 2);
  assert.equal(snap.keyStats.KeyD.minBounceMs, 8);
});

test('FPS counter-strafe / SOCD analyzer measures A/D and W/S overlap, gap, and zero-overlap rate', () => {
  const eng = keyTester.createKeyTesterEngine();

  // Transition 1 (AD overlap): A held, D pressed at 1050, A released at 1080 -> 30ms overlap
  eng.onKeyDown({code: 'KeyA', timestamp: 1000});
  eng.onKeyDown({code: 'KeyD', timestamp: 1050});
  const ov = eng.onKeyUp({code: 'KeyA', timestamp: 1080});
  assert.equal(ov.strafeEvent.type, 'overlap');
  assert.equal(ov.strafeEvent.durationMs, 30);
  eng.onKeyUp({code: 'KeyD', timestamp: 1200});

  // Transition 2 (AD clean gap): D released at 1200, A pressed at 1218 -> 18ms clean gap
  const gap = eng.onKeyDown({code: 'KeyA', timestamp: 1218});
  assert.equal(gap.strafeEvent.type, 'gap');
  assert.equal(gap.strafeEvent.durationMs, 18);
  eng.onKeyUp({code: 'KeyA', timestamp: 1300});

  // Transition 3 (WS perfect 0ms zero-overlap): W released at 2000, S pressed at 2000.5 -> perfect
  eng.onKeyDown({code: 'KeyW', timestamp: 1900});
  eng.onKeyUp({code: 'KeyW', timestamp: 2000});
  const perfect = eng.onKeyDown({code: 'KeyS', timestamp: 2000.5});
  assert.equal(perfect.strafeEvent.type, 'perfect');
  eng.onKeyUp({code: 'KeyS', timestamp: 2100});

  const snap = eng.snapshot();
  assert.equal(snap.socd.AD.transitions, 2);
  assert.equal(snap.socd.AD.overlapCount, 1);
  assert.equal(snap.socd.AD.zeroOverlapCount, 1);
  assert.equal(snap.socd.AD.zeroOverlapRate, 50);
  assert.equal(snap.socd.AD.avgOverlapMs, 30);
  assert.equal(snap.socd.AD.avgGapMs, 18);

  assert.equal(snap.socd.WS.transitions, 1);
  assert.equal(snap.socd.WS.zeroOverlapRate, 100);
  assert.equal(snap.socd.combined.transitions, 3);
  assert.equal(snap.socd.combined.zeroOverlapRate, 66.7);
});

test('findLiveKeyParam maps KeyboardEvent.code to live Thunder68 keyValues entries', () => {
  const keyValues = [
    {id: 'W', travelValue: 0.1, isRTEnabled: true, sensitivity: 0.02},
    {id: 'Esc', travelValue: 1.5, isRTEnabled: false, sensitivity: 0.5},
    {id: 'LShift', travelValue: 0.4, isRTEnabled: true, sensitivity: 0.1}
  ];
  assert.equal(keyTester.findLiveKeyParam('KeyW', keyValues)?.travelValue, 0.1);
  assert.equal(keyTester.findLiveKeyParam('Escape', keyValues)?.id, 'Esc');
  assert.equal(keyTester.findLiveKeyParam('ShiftLeft', keyValues)?.id, 'LShift');
  assert.equal(keyTester.findLiveKeyParam('UnknownKey', keyValues), null);
});

test('findLiveKeyParam achieves 100% 1-to-1 match across all 68 official Thunder68 key IDs (67 testable + Fn)', () => {
  const allLayoutKeys = keyTester.LAYOUT_68_ROWS.flat();
  const testableKeys = allLayoutKeys.filter(k => !k.hardwareOnly);
  assert.equal(allLayoutKeys.length, 68);
  assert.equal(testableKeys.length, 67);
  assert.equal(OFFICIAL_THUNDER68_KEY_IDS.length, 68);

  const liveKeyValues = OFFICIAL_THUNDER68_KEY_IDS.map((id, idx) => ({
    id,
    travelValue: Number((0.1 + (idx % 10) * 0.1).toFixed(2)),
    isRTEnabled: idx % 2 === 0,
    sensitivity: 0.05
  }));

  const matchedIds = new Set();
  for (const key of allLayoutKeys) {
    const found = keyTester.findLiveKeyParam(key.code, liveKeyValues);
    assert.ok(found, `Expected layout key ${key.code} (${key.label}) to match an official Thunder68 key ID`);
    matchedIds.add(found.id);
  }
  assert.equal(matchedIds.size, 68);

  // Explicit assertions for the 12 previously mismatched high-frequency modifier/arrow keys + Arrowup
  const criticalPairs = [
    ['CapsLock', 'Caps Lock'],
    ['ShiftLeft', 'ShiftL'],
    ['ShiftRight', 'ShiftR'],
    ['ControlLeft', 'CtrlL'],
    ['MetaLeft', 'WinL'],
    ['AltLeft', 'AltL'],
    ['Space', 'Spacebar'],
    ['AltRight', 'AltR'],
    ['ControlRight', 'CtrlR'],
    ['ArrowUp', 'Arrowup'],
    ['ArrowLeft', 'ArrowL'],
    ['ArrowDown', 'ArrowD'],
    ['ArrowRight', 'ArrowR']
  ];
  for (const [code, expectedId] of criticalPairs) {
    assert.equal(keyTester.findLiveKeyParam(code, liveKeyValues)?.id, expectedId, `${code} -> ${expectedId}`);
  }
});
