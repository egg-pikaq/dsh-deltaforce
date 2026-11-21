const tailDuration = 3350;
const sequenceMarkup = `
  <div class="cin-sequence" aria-hidden="true">
    <div class="cin-orbit">
      <div class="cin-stars"></div>
      <div class="cin-planet"></div>
      <div class="cin-orbit-title"><span>HAAVK</span><strong>天空属于哈夫克</strong></div>
    </div>
    <div class="cin-console">
      <div class="cin-console-grid"></div>
      <div class="cin-data-rain"></div>
      <div class="cin-console-scan"></div>
      <div class="cin-console-sweep"></div>
      <div class="cin-console-arc"></div>
      <div class="cin-console-header"><strong>HAAVK</strong><span>超算平台</span></div>
      <div class="cin-console-stream"></div>
      <div class="cin-console-panel">
        <strong class="cin-console-label"></strong>
        <span class="cin-console-spoken" lang="en"></span>
        <div class="cin-console-identity">
          <span>身份资料 / OPERATOR RECORD</span>
          <b>GUEST NODE</b>
        </div>
      </div>
      <div class="cin-console-footer"><span class="cin-console-count"></span><div><i></i></div></div>
    </div>
  </div>`;

function prepareSequence(frame, reduced) {
  const scene = frame.querySelector('.cin-sequence');
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
  const panel = frame.querySelector('.cin-console-panel');
  const label = frame.querySelector('.cin-console-label');
  const spoken = frame.querySelector('.cin-console-spoken');
  const count = frame.querySelector('.cin-console-count');
  const stream = frame.querySelector('.cin-console-stream');
  const meter = frame.querySelector('.cin-console-footer i');
  let lastIndex = -1;
  let lastTick = -1;
  let animation;

  return {
    paint(elapsed) {
      const t = Math.max(0, elapsed);
      const index = introCues.findLastIndex((cue) => t >= cue.at);
      if (index !== lastIndex) {
        const cue = introCues[index];
        scene.dataset.scene = cue.kind;
        label.textContent = cue.label ?? '';
        spoken.textContent = cue.spoken ?? '';
        count.textContent = `0${index} / 0${introCues.length - 1}`;
        if (!reduced && index > 0) {
          animation?.cancel();
          animation = panel.animate([
            { opacity: 0, transform: 'translateY(5px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ], { duration: 230, easing: 'ease-out' });
        }
        lastIndex = index;
      }
      const tick = Math.floor(t / 140);
      if (tick !== lastTick && (introCues[index].kind === 'uplink' || introCues[index].kind === 'sync')) {
        stream.textContent = Array.from({ length: 5 }, (_, row) => {
          const word = (0x1fe3 + tick * 97 + row * 313).toString(16).toUpperCase();
          return `${word.slice(-4)}  ${(row + tick) % 2 ? 'SYNC' : 'LINK'}`;
        }).join('\n');
        lastTick = tick;
      }
      meter.style.transform = `scaleX(${Math.min(1, t / introDuration)})`;
    },
    stop() { animation?.cancel(); },
  };
}
