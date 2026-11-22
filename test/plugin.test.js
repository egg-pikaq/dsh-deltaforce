import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { byteRange } from '../src/index.js';

test('range parsing serves only bounded single ranges', () => {
  assert.deepEqual(byteRange('bytes=4-7', 10), { start: 4, end: 7 });
  assert.deepEqual(byteRange('bytes=4-9999', 10), { start: 4, end: 9 });
  assert.deepEqual(byteRange('bytes=4-', 10), { start: 4, end: 9 });
  assert.deepEqual(byteRange('bytes=-4', 10), { start: 6, end: 9 });
  assert.deepEqual(byteRange('bytes=-99', 10), { start: 0, end: 9 });
  for (const header of ['bytes=-', 'bytes=-0', 'bytes=9-4', 'bytes=10-', 'bytes=0-1,3-4', 'items=0-3', 'bytes=9007199254740993-']) {
    assert.equal(byteRange(header, 10), undefined, header);
  }
  assert.equal(byteRange('bytes=0-', 0), undefined);
});

const splashSource = await readFile(new URL('../src/splash.js', import.meta.url), 'utf8');

test('fallback tolerates a frame timestamp from before the media error', () => {
  let scheduled;
  let clock = 100;
  let releaseCount = 0;
  const listeners = new Map();
  const phases = [];
  const frame = {
    querySelector() { return {}; },
  };
  frame.querySelector = (selector) => {
    if (selector === 'video') return {
      addEventListener: (event, fn) => listeners.set(event, fn),
      play() { return Promise.resolve(); },
      pause() {},
      removeAttribute() {},
      load() {},
    };
    if (selector === 'button') return { focus() {}, addEventListener() {} };
    return { style: {} };
  };
  const root = {
    dataset: { set mode(value) { phases.push(value); }, get mode() { return phases.at(-1); } },
    isConnected: false, classList: { add() {} },
    setAttribute() {}, append() {}, contains() { return false; },
    getBoundingClientRect() { return { width: 800 }; },
    remove() { this.isConnected = false; },
  };
  const window = {
    matchMedia() { return { matches: true }; },
    addEventListener() {},
  };
  const document = {
    createElement: (() => {
      const nodes = [root, {}, frame];
      return () => nodes.shift();
    })(),
    body: { append() { root.isConnected = true; } },
  };
  const sandbox = vm.createContext({
    stylesheet: '', sequenceMarkup: '', introDuration: 100, tailDuration: 50,
    prepareSequence: () => ({ paint() {} }),
    createRadar: () => () => {}, window, document, AbortController,
    performance: { now: () => clock },
    getComputedStyle: () => ({ position: 'fixed' }),
    setTimeout: () => 1, clearTimeout() {}, cancelAnimationFrame() {},
    requestAnimationFrame(callback) { scheduled = callback; return 1; },
  });
  const createSplash = vm.runInContext(splashSource + '\ncreateSplash;', sandbox);
  createSplash({ audio: false, volume: 0 }, () => releaseCount++);
  scheduled(101);
  clock = 205;
  scheduled(204);
  assert.equal(root.dataset.mode, 'loading');
  clock = 240;
  listeners.get('error')();
  scheduled(239);
  assert.equal(root.dataset.mode, 'fallback');
  assert.equal(root.isConnected, true);
  assert.equal(releaseCount, 0);
  clock = 10241;
  scheduled(clock);
  assert.equal(root.dataset.mode, 'tail');
  assert.equal(root.isConnected, true);
  scheduled(10292);
  assert.equal(root.isConnected, false);
  assert.deepEqual(phases, ['intro', 'loading', 'fallback', 'tail']);
  assert.equal(releaseCount, 1);
});

test('the bundled PCM duration matches the complete intro timeline', async () => {
  const timeline = JSON.parse(await readFile(new URL('../src/intro-cues.json', import.meta.url), 'utf8'));
  const audio = await readFile(new URL('../assets/intro.wav', import.meta.url));
  assert.equal(audio.toString('ascii', 0, 4), 'RIFF');
  assert.equal(audio.toString('ascii', 36, 40), 'data');
  assert.equal(audio.readUInt32LE(40) / audio.readUInt32LE(28) * 1000, timeline.duration);
  assert.deepEqual(timeline.cues.map(({ kind }) => kind), ['orbit', 'authorization', 'identity', 'uplink', 'sync', 'verified', 'welcome']);
});

const clientSource = await readFile(new URL('../src/client.js', import.meta.url), 'utf8');

test('disposing a client releases its overlay and reapplying skips auto-play on the same document', () => {
  const cleanups = [];
  let started = 0;
  let stopped = 0;
  const sandbox = vm.createContext({
    window: {}, document: { body: {} }, AbortController,
    localStorage: { getItem() { return null; } },
    createSplash(settings, clear) {
      started++;
      return () => { stopped++; clear(); };
    },
  });
  const ctx = {
    effect(callback) { cleanups.push(callback()); },
    inject() {},
  };
  const load = () => vm.runInContext(`(() => {${clientSource}})()`, sandbox);
  load().apply(ctx);
  load().apply(ctx);
  assert.equal(started, 1);
  cleanups.shift()();
  assert.equal(stopped, 1);
  load().apply(ctx);
  assert.equal(started, 1);
});

test('a scene handoff eases across 940 ms and reduced motion cuts immediately', async () => {
  const source = await readFile(new URL('../src/sequence.js', import.meta.url), 'utf8');
  const stageMix = vm.runInNewContext(source + '\nstageMix;', { terminalScreenMarkup: '' });
  const samples = [-1, 0, 100, 470, 800, 940, 1000].map((ms) => stageMix(ms, false));
  assert.equal(samples[0], 0);
  assert.equal(samples[1], 0);
  assert.ok(samples[2] > 0 && samples[2] < .2);
  assert.equal(samples[3], .5);
  assert.ok(samples[4] > .8 && samples[4] < 1);
  assert.equal(samples[5], 1);
  assert.equal(samples[6], 1);
  assert.equal(stageMix(469, true), 0);
  assert.equal(stageMix(470, true), 1);
});

test('emblem builds, holds, reverses along the same timeline and loops', async () => {
  const source = await readFile(new URL('../src/terminal-screen.js', import.meta.url), 'utf8');
  const time = vm.runInNewContext(source + '\nassemblyTime;');
  assert.equal(time(0), 0);
  assert.equal(time(3100), 3100);
  assert.equal(time(4350), 3100);
  assert.equal(time(5350), 2100);
  assert.equal(time(7450), 0);
  assert.equal(time(8400), 0);
  assert.equal(time(9000), time(600));
});
