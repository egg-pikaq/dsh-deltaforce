const mediaPath = '/plugins/dsh-deltaforce/cinematic/';
const fallbackSeconds = 10;
const startupGrace = 1400;
const voiceGrace = 1200;
const hardLimit = 42000;
const steps = [
  [0, '正在初始化显示链路'],
  [0.19, '正在校准全息网格'],
  [0.41, '正在同步控制节点'],
  [0.65, '正在检查系统状态'],
  [0.88, '启动序列完成'],
];

function createSplash(settings, onRelease) {
  const root = document.createElement('div');
  root.id = 'dsh-deltaforce-splash';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'DSH 启动动画');
  const style = document.createElement('style');
  style.textContent = stylesheet;
  const frame = document.createElement('div');
  frame.className = 'cin-frame';
  frame.innerHTML = `
    <video class="cin-film" playsinline preload="auto" aria-hidden="true"></video>
    <audio preload="auto" aria-hidden="true"></audio>
    <div class="cin-grade" aria-hidden="true"></div>
    <div class="cin-scan" aria-hidden="true"></div>
    <div class="cin-grid" aria-hidden="true"></div>
    <div class="cin-mark" aria-hidden="true"><i></i><i></i><i></i></div>
    <canvas class="cin-radar" aria-hidden="true"></canvas>
    <div class="cin-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="cin-header">DSH <span>／</span> CINEMATIC BOOT</div>
    <div class="cin-data" aria-hidden="true"></div>
    <div class="cin-caption"><strong></strong><span></span></div>
    <div class="cin-progress" aria-hidden="true"><i></i></div>
    ${sequenceMarkup}
    <button type="button" class="cin-skip">跳过 <kbd>Esc</kbd></button>`;
  root.append(style, frame);

  const video = frame.querySelector('video');
  const voice = frame.querySelector('audio');
  const button = frame.querySelector('button');
  const title = frame.querySelector('.cin-caption strong');
  const caption = frame.querySelector('.cin-caption span');
  const data = frame.querySelector('.cin-data');
  const progressBar = frame.querySelector('.cin-progress i');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const radar = createRadar(frame.querySelector('canvas'), reduced);
  const sequence = prepareSequence(frame, reduced);
  const controller = new AbortController();
  const previousFocus = document.activeElement;
  const withSound = settings.audio && settings.volume > 0;
  const mountedAt = performance.now();
  let mode = 'intro';
  let stageAt = mountedAt;
  let voiceClock = withSound ? 'waiting' : 'wall';
  let voiceTime = 0;
  let voiceAdvanceAt = mountedAt;
  let videoFailed = false;
  let fallbackOffset = 0;
  let finished = false;
  let released = false;
  let frameId = 0;
  let graceTimer = 0;
  let hardTimer = 0;
  let fadeTimer = 0;
  let lastMediaTime = 0;
  let lastMediaAdvance = mountedAt;
  let lastStep = -1;
  let lastSignal = -1;

  function setMode(next) {
    mode = root.dataset.mode = next;
    stageAt = performance.now();
  }

  function mediaClear(media) {
    try {
      media.pause();
      media.removeAttribute('src');
      media.load();
    } catch {}
  }

  function release() {
    if (released) return;
    released = true;
    clearTimeout(fadeTimer);
    clearTimeout(hardTimer);
    const restoreFocus = root.contains(document.activeElement);
    mediaClear(voice);
    mediaClear(video);
    root.remove();
    if (restoreFocus && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      try { previousFocus.focus({ preventScroll: true }); } catch {}
    }
    onRelease();
  }

  function finish(animate = false) {
    if (released) return;
    if (!finished) {
      finished = true;
      controller.abort();
      cancelAnimationFrame(frameId);
      clearTimeout(graceTimer);
      sequence.stop();
      try { video.pause(); } catch {}
      try { voice.pause(); } catch {}
    }
    if (!animate || reduced || !root.isConnected) {
      release();
      return;
    }
    if (fadeTimer) return;
    root.classList.add('cin-exit');
    fadeTimer = setTimeout(release, 420);
  }

  function useVoiceWall() {
    if (finished || mode !== 'intro' || voiceClock === 'wall') return;
    stageAt = voiceClock === 'media' ? performance.now() - voiceTime : mountedAt;
    voiceClock = 'wall';
    mediaClear(voice);
  }

  function measureIntro(now) {
    if (voiceClock === 'waiting' && now - mountedAt >= voiceGrace) useVoiceWall();
    if (voiceClock === 'media') {
      const t = voice.currentTime * 1000;
      if (t > voiceTime) {
        voiceTime = t;
        voiceAdvanceAt = now;
      } else if (now - voiceAdvanceAt > 900) {
        useVoiceWall();
      }
    }
    if (voiceClock === 'media') return voiceTime;
    if (voiceClock === 'waiting') return 0;
    return Math.max(0, now - stageAt);
  }

  function fallback() {
    if (finished || (mode !== 'loading' && mode !== 'video')) return;
    if (mode === 'video') fallbackOffset = Math.min(8.5, lastMediaTime);
    setMode('fallback');
    clearTimeout(graceTimer);
    mediaClear(video);
  }

  function playFilm(allowAudio) {
    video.muted = !allowAudio;
    const rejected = () => {
      if (finished || mode !== 'loading') return;
      if (allowAudio) playFilm(false);
      else fallback();
    };
    try {
      void Promise.resolve(video.play()).catch(rejected);
    } catch {
      rejected();
    }
  }

  function startFilm() {
    mediaClear(voice);
    setMode('loading');
    if (videoFailed) {
      fallback();
      return;
    }
    graceTimer = setTimeout(fallback, startupGrace);
    playFilm(withSound);
  }

  function startTail() {
    if (finished || (mode !== 'video' && mode !== 'fallback')) return;
    setMode('tail');
    clearTimeout(graceTimer);
  }

  function paintFilm(now) {
    if (mode === 'video') {
      const time = video.currentTime;
      if (time > lastMediaTime) {
        lastMediaTime = time;
        lastMediaAdvance = now;
      } else if (now - lastMediaAdvance >= startupGrace) {
        fallback();
      }
    }
    const elapsed = mode === 'fallback' ? fallbackOffset + (now - stageAt) / 1000 : lastMediaTime;
    const seconds = mode === 'video' && Number.isFinite(video.duration) && video.duration > 0
      ? video.duration : fallbackSeconds;
    const progress = Math.min(1, Math.max(0, elapsed / seconds));
    const step = steps.findLastIndex(([at]) => progress >= at);
    if (step !== lastStep) {
      lastStep = step;
      title.textContent = step === steps.length - 1 ? 'SYSTEM ONLINE' : 'SYSTEM INITIALIZING';
      caption.textContent = steps[step][1];
    }
    const signal = Math.floor(progress * 28);
    if (signal !== lastSignal) {
      lastSignal = signal;
      data.textContent = `DISPLAY BUS  ${String(signal).padStart(2, '0')} / 28\nFRAME SYNC   ${Math.round(progress * 100)}%\nDSH NODE     ${step === steps.length - 1 ? 'ONLINE' : 'BOOT'}`;
    }
    progressBar.style.transform = `scaleX(${progress})`;
    radar(progress);
    if (mode === 'fallback' && progress >= 1) startTail();
  }

  function paint(now) {
    if (finished) return;
    try {
      if (mode === 'intro') {
        const elapsed = measureIntro(now);
        sequence.paint(elapsed);
        if (elapsed >= introDuration) startFilm();
      } else if (mode === 'tail') {
        if (now - stageAt >= tailDuration) finish(true);
      } else {
        paintFilm(now);
      }
      if (!finished) frameId = requestAnimationFrame(paint);
    } catch {
      finish();
    }
  }

  const signal = controller.signal;
  try {
    hardTimer = setTimeout(finish, hardLimit);
    root.dataset.mode = mode;
    sequence.paint(0);
    document.body.append(root);
    if (getComputedStyle(root).position !== 'fixed' || !root.getBoundingClientRect().width) {
      finish();
      return finish;
    }
    button.focus({ preventScroll: true });
    button.addEventListener('click', () => finish(true), { signal });
    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      finish(true);
    }, { capture: true, signal });
    window.addEventListener('pagehide', () => finish(), { signal });
    video.addEventListener('playing', () => {
      if (finished || mode !== 'loading') return;
      setMode('video');
      lastMediaAdvance = stageAt;
      clearTimeout(graceTimer);
    }, { signal });
    video.addEventListener('ended', startTail, { signal });
    video.addEventListener('error', () => {
      videoFailed = true;
      fallback();
    }, { signal });
    video.volume = settings.volume;
    video.src = mediaPath + 'boot.mp4';
    if (withSound) {
      voice.addEventListener('playing', () => {
        if (finished || mode !== 'intro' || voiceClock !== 'waiting') return;
        voiceClock = 'media';
        voiceAdvanceAt = performance.now();
      }, { signal });
      voice.addEventListener('ended', () => {
        if (!finished && mode === 'intro' && voiceClock === 'media') startFilm();
      }, { signal });
      voice.addEventListener('error', useVoiceWall, { signal });
      voice.volume = settings.volume;
      voice.src = mediaPath + 'intro.wav';
      try { void Promise.resolve(voice.play()).catch(useVoiceWall); } catch { useVoiceWall(); }
    }
    frameId = requestAnimationFrame(paint);
  } catch {
    finish();
  }
  return finish;
}
