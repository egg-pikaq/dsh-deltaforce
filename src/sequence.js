const tailDuration = 3350;
const stageFadeMs = 620;
const preludeMedia = '/plugins/dsh-deltaforce/cinematic/';
const stageArtwork = {
  identity: 'prelude-identity.jpg',
  uplink: 'prelude-uplink.jpg',
  sync: 'prelude-core.jpg',
  verified: 'prelude-core.jpg',
  welcome: 'prelude-core.jpg',
};

const sequenceMarkup = `
  <div class="cin-sequence" aria-hidden="true">
    <div class="cin-orbit">
      <div class="cin-stars"></div>
      <div class="cin-planet"></div>
      <div class="cin-finale-backdrop"></div>
      <div class="cin-orbit-title"><span>HAAVK</span><strong>天空属于哈夫克</strong></div>
    </div>
    <div class="cin-console">
      <div class="cin-stages"></div>
      <div class="cin-console-grid"></div>
      <div class="cin-data-rain"></div>
      <div class="cin-console-scan"></div>
      <div class="cin-console-sweep"></div>
      <div class="cin-console-header"><strong>HAAVK</strong><span>COMPUTE PLATFORM</span></div>
      <div class="cin-console-footer"><span class="cin-console-count"></span><div><i></i></div></div>
    </div>
  </div>`;

function stageMix(elapsed, reduced) {
  const p = reduced ? 1 : Math.min(1, Math.max(0, elapsed / stageFadeMs));
  return p * p * (3 - 2 * p);
}

function makeStage(cue, reduced) {
  const node = document.createElement('div');
  node.className = 'cin-stage';
  node.dataset.kind = cue.kind;
  node.innerHTML = `
    <div class="cin-stage-visual">
      <canvas class="cin-console-hud"></canvas>
      <div class="cin-stage-light"></div>
    </div>
    <div class="cin-console-panel">
      <strong class="cin-console-label"></strong>
      <span class="cin-console-spoken" lang="en"></span>
    </div>`;
  const visual = node.querySelector('.cin-stage-visual');
  const panel = node.querySelector('.cin-console-panel');
  panel.querySelector('strong').textContent = cue.label;
  panel.querySelector('span').textContent = cue.spoken;
  if (cue.kind === 'identity') {
    const record = document.createElement('div');
    record.className = 'cin-console-identity';
    record.innerHTML = '<span>OPERATOR RECORD</span><b>GUEST NODE</b>';
    panel.append(record);
  }
  let image;
  if (stageArtwork[cue.kind]) {
    image = document.createElement('img');
    image.alt = '';
    image.decoding = 'async';
    image.src = preludeMedia + stageArtwork[cue.kind];
    visual.prepend(image);
  }
  return { node, visual, panel, image, art: false, paintHud: prepareHud(visual.querySelector('canvas'), reduced) };
}

function prepareSequence(frame, reduced) {
  const scene = frame.querySelector('.cin-sequence');
  const count = frame.querySelector('.cin-console-count');
  const meter = frame.querySelector('.cin-console-footer i');
  scene.dataset.scene = introCues[0].kind;
  const stages = [null, ...introCues.slice(1).map((cue) => makeStage(cue, reduced))];
  frame.querySelector('.cin-stages').append(...stages.slice(1).map(({ node }) => node));

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

  let current = 0;
  let outgoing = 0;
  let lastMix = -1;

  function hide(index) {
    stages[index]?.node.classList.remove('cin-visible');
  }

  function paintStage(index, t) {
    const stage = stages[index];
    if (!stage) return;
    const cue = introCues[index];
    const span = (introCues[index + 1]?.at ?? introDuration) - cue.at;
    const elapsed = Math.max(0, t - cue.at);
    const art = Boolean(stage.image?.complete && stage.image.naturalWidth);
    if (art !== stage.art) {
      stage.art = art;
      stage.node.classList.toggle('cin-art-ready', art);
    }
    if (!art) stage.paintHud(cue.kind, elapsed, span);
    if (!reduced && art) stage.visual.style.setProperty('--beat', Math.min(1, elapsed / span));
  }

  return {
    paint(elapsed) {
      const t = Math.max(0, elapsed);
      const index = introCues.findLastIndex((cue) => t >= cue.at);
      if (index !== current) {
        hide(outgoing);
        outgoing = index === current + 1 ? current : 0;
        if (!outgoing) hide(current);
        current = index;
        stages[current]?.node.classList.add('cin-visible');
        scene.dataset.scene = introCues[index].kind;
        count.textContent = `0${index} / 0${introCues.length - 1}`;
        lastMix = -1;
      }
      const mix = outgoing ? stageMix(t - introCues[index].at, reduced) : 1;
      const stage = stages[current];
      if (stage && mix !== lastMix) {
        // Composite the incoming plate over a fully opaque outgoing plate.
        // Fade text separately so two live titles never compete.
        stage.visual.style.opacity = mix;
        stage.panel.style.opacity = Math.max(0, Math.min(1, (mix - .20) / .70));
        const old = stages[outgoing];
        if (old) {
          old.visual.style.opacity = 1;
          old.panel.style.opacity = Math.max(0, 1 - mix / .30);
        }
        lastMix = mix;
      }
      if (mix === 1 && outgoing) {
        hide(outgoing);
        outgoing = 0;
      }
      paintStage(outgoing, t);
      paintStage(current, t);
      meter.style.transform = `scaleX(${Math.min(1, t / introDuration)})`;
    },
  };
}
