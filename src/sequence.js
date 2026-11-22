const tailDuration = 3350;
const stageFadeMs = 940;
const preludeMedia = '/plugins/dsh-deltaforce/cinematic/';

const sequenceMarkup = `
  <div class="cin-sequence" aria-hidden="true">
    <div class="cin-orbit">
      <div class="cin-stars"></div>
      <div class="cin-planet"></div>
      <div class="cin-finale-backdrop"></div>
      <div class="cin-orbit-title"><span>HAAVK</span><strong>天空属于哈夫克</strong></div>
    </div>
    <div class="cin-console">
      <div class="cin-chamber">
        <img class="cin-chamber-art" src="${preludeMedia}prelude-identity.jpg" alt="">
        <div class="cin-projector">
          <div class="cin-projector-glass"></div>
          ${terminalScreenMarkup}
          <div class="cin-projector-scan"></div>
        </div>
      </div>
      <div class="cin-console-grid"></div>
      <div class="cin-data-rain"></div>
      <div class="cin-console-header"><strong>HAAVK</strong><span>COMPUTE PLATFORM</span></div>
      <div class="cin-console-identity"><span>OPERATOR RECORD</span><b>GUEST NODE</b></div>
      <div class="cin-stages"></div>
      <div class="cin-console-footer"><span class="cin-console-count"></span><div><i></i></div></div>
    </div>
  </div>`;

function stageMix(elapsed, reduced) {
  if (reduced) return Number(elapsed >= stageFadeMs / 2);
  const p = Math.min(1, Math.max(0, elapsed / stageFadeMs));
  return p * p * (3 - 2 * p);
}

function cueMix(t, at, reduced) {
  return stageMix(t - at + stageFadeMs / 2, reduced);
}

function prepareSequence(frame, reduced) {
  const scene = frame.querySelector('.cin-sequence');
  const chamber = frame.querySelector('.cin-chamber');
  const room = frame.querySelector('.cin-chamber-art');
  const projector = frame.querySelector('.cin-projector');
  const record = frame.querySelector('.cin-console-identity');
  const count = frame.querySelector('.cin-console-count');
  const meter = frame.querySelector('.cin-console-footer i');
  const sequence = frame.querySelector('.cin-stages');
  const panels = introCues.slice(1).map((cue) => {
    const node = document.createElement('div');
    node.className = 'cin-console-panel';
    node.dataset.kind = cue.kind;
    const title = document.createElement('strong');
    title.className = 'cin-console-label';
    title.textContent = cue.label;
    const words = document.createElement('span');
    words.className = 'cin-console-spoken';
    words.lang = 'en';
    words.textContent = cue.spoken;
    node.append(title, words);
    return node;
  });
  sequence.append(...panels);
  scene.dataset.scene = introCues[0].kind;

  if (!reduced) {
    const rain = frame.querySelector('.cin-data-rain');
    for (let i = 0; i < 24; i++) {
      const streak = document.createElement('i');
      const start = i < 12 ? 7 : 70;
      streak.style.setProperty('--rain-x', `${start + i % 12 * 2.65}%`);
      streak.style.setProperty('--rain-height', `${5 + i * 7 % 16}vh`);
      streak.style.setProperty('--rain-duration', `${2400 + i * 283 % 2100}ms`);
      streak.style.setProperty('--rain-delay', `-${(i * 739 + 810) % 3400}ms`);
      rain.append(streak);
    }
  }

  const cueTimes = Object.fromEntries(introCues.map(({ kind, at }) => [kind, at]));
  const paintTerminal = prepareTerminal(projector, cueTimes, reduced);
  let lastIndex = -1;

  return {
    paint(elapsed) {
      const t = Math.max(0, elapsed);
      const index = introCues.findLastIndex((cue) => t >= cue.at);
      if (index !== lastIndex) {
        scene.dataset.scene = introCues[index].kind;
        count.textContent = `0${index} / 0${panels.length}`;
        lastIndex = index;
      }

      const progress = Math.min(1, t / introDuration);
      chamber.classList.toggle('cin-chamber-ready', room.complete && room.naturalWidth > 0);
      if (!reduced) projector.style.setProperty('--scan', `${50 - 50 * Math.cos(t * Math.PI / 1750)}%`);
      projector.style.setProperty('--lock', cueMix(t, cueTimes.verified, reduced));
      paintTerminal(t);

      record.style.opacity = cueMix(t, cueTimes.identity, reduced) * (1 - cueMix(t, cueTimes.uplink, reduced));

      for (const [i, panel] of panels.entries()) {
        const enter = cueMix(t, introCues[i + 1].at, reduced);
        const leave = introCues[i + 2] ? cueMix(t, introCues[i + 2].at, reduced) : 0;
        const opacity = Math.max(0, Math.min(1, (enter - leave - .43) / .57));
        panel.style.opacity = opacity;
        panel.style.visibility = opacity > 0 ? 'visible' : 'hidden';
        if (!reduced) panel.style.transform = `translateY(${4 * (1 - enter) - 4 * leave}px)`;
      }
      meter.style.transform = `scaleX(${progress})`;
    },
  };
}
