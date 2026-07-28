/**
 * Serves dist/ the way a static host would, so the built site can be checked
 * before it goes anywhere.
 *
 *   pnpm preview                    localhost only, port 4173
 *   pnpm preview --port 5000        another port (a bare number works too)
 *   pnpm preview --host             every interface, for a phone on the same wifi
 *   pnpm preview --host 192.168.1.5 one interface
 *   pnpm preview --mount /gallery/demos
 *                                   serve it under a subpath, like the real host does
 *
 * Same flags as vite, including the default: nothing is exposed to the network
 * until --host says so.
 */

import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';
import {dirname, extname, join, normalize} from 'node:path';

const dist = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const args = process.argv.slice(2);

/** `--name value` if a value follows, plain `--name` reads as true. */
function flag(name) {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return undefined;

  const next = args[at + 1];
  return next && !next.startsWith('-') ? next : true;
}

const host = flag('host') === true ? '0.0.0.0' : (flag('host') ?? 'localhost');
const port = Number(flag('port') ?? args.find(arg => /^\d+$/.test(arg)) ?? 4173);
/** Prefix the site is served under, e.g. /gallery/demos. Empty means the root. */
const mount = flag('mount') === true ? '' : String(flag('mount') ?? '').replace(/\/$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  if (mount) {
    if (pathname === mount) {
      response.writeHead(302, {location: mount + '/'}).end();
      return;
    }

    if (!pathname.startsWith(mount + '/')) {
      response.writeHead(404).end('Not found (the site is under ' + mount + '/)');
      return;
    }

    pathname = pathname.slice(mount.length);
  }

  let path = join(dist, normalize(pathname));

  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  try {
    await stat(path);
  } catch {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, {'content-type': TYPES[extname(path)] ?? 'application/octet-stream'});
  createReadStream(path).pipe(response);
}).listen(port, host, () => {
  const local = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`  Local:    http://${local}:${port}${mount}/`);

  if (host !== '0.0.0.0') {
    // An explicit address is already reachable; only the default needs the hint
    if (local === 'localhost' || local.startsWith('127.')) {
      console.log('  Network:  use --host to expose');
    }
    return;
  }

  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`  Network:  http://${address.address}:${port}${mount}/`);
      }
    }
  }
});
