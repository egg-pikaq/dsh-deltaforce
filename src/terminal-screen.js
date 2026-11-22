const terminalRows = [
  ['authorization', 120, 'command', '> BOOT PROFILE'],
  ['authorization', 1070, 'system', '[READY] TERMINAL ONLINE'],
  ['identity', 70, 'command', '> VERIFY GUEST NODE'],
  ['identity', 600, 'system', 'PASSCODE  ••••••••'],
  ['identity', 1320, 'pass', '[PASS] IDENTITY VERIFIED'],
  ['uplink', 110, 'command', '> ESTABLISH UPLINK'],
  ['uplink', 1240, 'pass', '[OK] RELAY LOCKED'],
  ['sync', 110, 'command', '> ALIGN COMPUTE CORE'],
  ['sync', 1360, 'pass', '[OK] CLOCKS ALIGNED'],
  ['verified', 190, 'pass', '[PASS] CHECKSUM VALID'],
  ['welcome', 190, 'pass', '[OK] SESSION ESTABLISHED'],
];

const terminalScreenMarkup = `
  <div class="cin-terminal-rain"></div>
  <div class="cin-terminal-emblem">
    <i class="cin-emblem-seed"></i>
    <i class="cin-emblem-piece cin-emblem-spine"></i>
    <i class="cin-emblem-piece cin-emblem-left"></i>
    <i class="cin-emblem-piece cin-emblem-right"></i>
    <div class="cin-emblem-word"><span>H</span><span>A</span><span>A</span><span>V</span><span>K</span></div>
  </div>
  <div class="cin-terminal-log"></div>`;

function assemblyTime(elapsed) {
  const build = 3100;
  const hold = 1250;
  const phase = Math.max(0, elapsed) % 8400;
  return Math.max(0, Math.min(build, phase, 2 * build + hold - phase));
}

function assemblyPiece(time, begins, span) {
  const p = Math.max(0, Math.min(1, (time - begins) / span));
  return p * p * (3 - 2 * p);
}

function prepareTerminal(projector, cueTimes, reduced) {
  const rain = projector.querySelector('.cin-terminal-rain');
  if (!reduced) {
    const digits = '01AE7F29C48D';
    for (let column = 0; column < 21; column++) {
      const drop = document.createElement('span');
      drop.textContent = Array.from({ length: 6 + column % 6 }, (_, i) => {
        return digits[(column * 13 + i * 7 + i * i) % digits.length];
      }).join('\n');
      drop.style.setProperty('--column', `${2 + column * 4.75}%`);
      drop.style.setProperty('--fall', `${2500 + column * 617 % 3500}ms`);
      drop.style.setProperty('--delay', `-${column * 809 % 4100}ms`);
      rain.append(drop);
    }
  }

  const log = projector.querySelector('.cin-terminal-log');
  const lines = terminalRows.map(([kind, offset, tone, text]) => ({
    at: cueTimes[kind] + offset,
    tone,
    text,
  }));
  const seed = projector.querySelector('.cin-emblem-seed');
  const pieces = [...projector.querySelectorAll('.cin-emblem-piece')];
  const letters = [...projector.querySelectorAll('.cin-emblem-word span')];
  let cursor = 0;
  let row;
  let shown = -1;

  function paintLog(elapsed) {
    while (cursor < lines.length && elapsed >= lines[cursor].at) {
      const entry = lines[cursor];
      if (!row) {
        row = document.createElement('div');
        row.className = 'cin-terminal-row';
        row.dataset.tone = entry.tone;
        log.append(row);
        shown = -1;
      }
      const count = reduced ? entry.text.length :
        Math.min(entry.text.length, Math.floor((elapsed - entry.at) / 23) + 1);
      if (count !== shown) {
        row.textContent = entry.text.slice(0, count);
        shown = count;
        log.scrollTop = log.scrollHeight;
      }
      if (count < entry.text.length) break;
      cursor++;
      row = undefined;
    }
  }

  function paintEmblem(elapsed) {
    const time = reduced ? 3100 : assemblyTime(elapsed);
    seed.style.opacity = assemblyPiece(time, 40, 380) * (1 - assemblyPiece(time, 620, 420));
    pieces.forEach((piece, index) => {
      const progress = assemblyPiece(time, 430 + index * 170, 960);
      piece.style.setProperty('--assemble', progress);
      piece.style.opacity = progress;
    });
    letters.forEach((letter, index) => {
      const progress = assemblyPiece(time, 1640 + index * 135, 740);
      letter.style.setProperty('--assemble', progress);
      letter.style.opacity = progress;
    });
  }

  return (elapsed) => {
    paintLog(elapsed);
    paintEmblem(Math.max(0, elapsed - 860));
  };
}
