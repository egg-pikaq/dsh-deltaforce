import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const [style, sequenceStyle, cues, sequence, particles, splash, client] = await Promise.all([
  read('src/splash.css'),
  read('src/sequence.css'),
  read('src/intro-cues.json'),
  read('src/sequence.js'),
  read('src/particles.js'),
  read('src/splash.js'),
  read('src/client.js'),
]);
const bundle = `window.__ModuleLoader__.load({
  id: 'dsh-deltaforce',
  factory(require) {
    'use strict';
    const stylesheet = ${JSON.stringify(style + '\n' + sequenceStyle)};
    const { duration: introDuration, cues: introCues } = ${JSON.stringify(JSON.parse(cues))};
${sequence}
${particles}
${splash}
${client}
  },
});
`;
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/client.js', root), bundle);
