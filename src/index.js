import { open } from 'node:fs/promises';

export const name = 'dsh-deltaforce';
const media = [
  ['boot.mp4', 'video/mp4'],
  ['intro.wav', 'audio/wav'],
  ['orbital-finale.png', 'image/png'],
];

export function byteRange(header, size) {
  const match = typeof header === 'string' && /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) return;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || start >= size || end < start) return;
  return { start, end };
}

export function apply(ctx) {
  ctx.inject(['webServer', 'connection'], (carrier) => {
    for (const [filename, type] of media) {
      carrier.effect(() => registerMedia(carrier, filename, type), `${name}:${filename}`);
    }
  });
}

function registerMedia(carrier, filename, type) {
  const source = new URL(`../assets/${filename}`, import.meta.url);
  return carrier.webServer.register({
    kind: 'exact',
    path: `/plugins/dsh-deltaforce/cinematic/${filename}`,
    async handler(request, response) {
      const reject = carrier.connection.requestRejection(request);
      if (reject !== undefined) {
        response.writeHead(reject).end();
        return;
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' }).end();
        return;
      }

      let file;
      try {
        file = await open(source, 'r');
        const info = await file.stat();
        if (response.destroyed) return;
        if (!info.isFile() || info.size === 0) {
          response.writeHead(404).end();
          return;
        }
        const headers = {
          'content-type': type,
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        };
        const supplied = request.headers.range;
        const range = supplied === undefined ? undefined : byteRange(supplied, info.size);
        if (supplied !== undefined && !range) {
          response.writeHead(416, { ...headers, 'content-range': `bytes */${info.size}` }).end();
          return;
        }
        const { start, end } = range ?? { start: 0, end: info.size - 1 };
        headers['content-length'] = end - start + 1;
        if (range) headers['content-range'] = `bytes ${start}-${end}/${info.size}`;
        response.writeHead(range ? 206 : 200, headers);
        if (request.method === 'HEAD') {
          response.end();
          return;
        }
        const stream = file.createReadStream({ start, end });
        file = undefined;
        response.once('close', () => stream.destroy());
        stream.once('error', () => response.destroy());
        stream.pipe(response);
      } catch (error) {
        if (response.destroyed) return;
        if (response.headersSent) response.destroy();
        else response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
      } finally {
        await file?.close().catch(() => {});
      }
    },
  });
}
