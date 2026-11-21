const settingsKey = 'dsh-deltaforce:settings:v1';
const sessionKey = Symbol.for('dsh-deltaforce:document');
const defaults = Object.freeze({ enabled: true, audio: true, volume: 0.45 });

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(settingsKey));
    return {
      enabled: stored?.enabled !== false,
      audio: stored?.audio !== false,
      volume: Number.isFinite(stored?.volume) ? Math.max(0, Math.min(1, stored.volume)) : defaults.volume,
    };
  } catch {
    return { ...defaults };
  }
}

function apply(ctx) {
  const session = window[sessionKey] ??= { autoHandled: false, active: null, settings: readSettings() };
  let owned;
  let disposed = false;

  function start(manual = false) {
    if (disposed || (!manual && !session.settings.enabled) || session.active) return;
    const playback = { stop: () => {} };
    session.active = owned = playback;
    function clear() {
      if (session.active === playback) session.active = null;
      if (owned === playback) owned = undefined;
    }
    try {
      playback.stop = createSplash(session.settings, clear);
    } catch {
      clear();
    }
  }

  function autoStart() {
    if (disposed || session.autoHandled || !document.body) return;
    session.autoHandled = true;
    start();
  }

  ctx.effect(() => {
    const controller = new AbortController();
    if (document.body) autoStart();
    else document.addEventListener('DOMContentLoaded', autoStart, { once: true, signal: controller.signal });
    return () => {
      disposed = true;
      controller.abort();
      owned?.stop();
    };
  }, 'dsh-deltaforce:startup');

  ctx.inject(['slots'], (panelCtx) => {
    const slots = panelCtx.slots;
    const React = require('react');
    const h = React.createElement;
    function Panel() {
      const [settings, setSettings] = React.useState(() => session.settings);
      const [storageError, setStorageError] = React.useState(false);
      function update(key, value) {
        const next = { ...session.settings, [key]: value };
        session.settings = next;
        setSettings(next);
        try {
          localStorage.setItem(settingsKey, JSON.stringify(next));
          setStorageError(false);
        } catch {
          setStorageError(true);
        }
      }
      function checkbox(key, label) {
        return h('label', { style: { display: 'block', marginBlockEnd: '12px' } },
          h('input', { type: 'checkbox', checked: settings[key], onChange: (event) => update(key, event.target.checked) }),
          ' ', label);
      }
      return h('section', { 'aria-label': '启动动画设置', style: { padding: '12px 0' } },
        checkbox('enabled', '随 DSH 启动播放'),
        checkbox('audio', '播放声音'),
        h('label', { style: { display: 'block', marginBlockEnd: '12px' } },
          `音量 ${Math.round(settings.volume * 100)}% `,
          h('input', {
            type: 'range', min: 0, max: 100, value: Math.round(settings.volume * 100), disabled: !settings.audio,
            onChange: (event) => update('volume', Number(event.target.value) / 100),
          })),
        h('button', { type: 'button', onClick: () => start(true) }, '重播启动动画'),
        storageError ? h('p', { role: 'status' }, '设置仅在本次窗口生效。') : null);
    }
    slots.inject('settings.plugins.tab', (slotCtx) => {
      const scopedSlots = slotCtx?.slots ?? slots;
      return scopedSlots.register({
        name: 'settings.plugins.tab',
        key: 'dsh-deltaforce',
        id: 'dsh-deltaforce',
        order: 90,
        label: () => 'Cinematic Boot',
        inject: () => ({}),
      }, () => h(Panel));
    });
  });
}

return { name: 'dsh-deltaforce-client', apply };
