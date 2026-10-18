import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capturePage } from './capture.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.API_TOKEN; // 설정하면 Authorization: Bearer <token> 필요

let active = 0;
const MAX_CONCURRENT = 2;

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(400);
    res.end();
  });
});

async function handle(req, res) {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/health') {
    res.writeHead(200).end('ok');
    return;
  }
  if (u.pathname !== '/capture' && req.method === 'GET') {
    try {
      const rel = u.pathname === '/' ? 'index.html' : path.normalize(decodeURIComponent(u.pathname)).replace(/^[/\\]+/, '');
      if (rel.startsWith('..')) throw new Error('bad path');
      const data = await readFile(path.join(PUBLIC, rel));
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
    return;
  }
  if (u.pathname !== '/capture' || req.method !== 'GET') {
    res.writeHead(404).end('not found');
    return;
  }
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end('unauthorized');
    return;
  }
  const target = u.searchParams.get('url');
  if (!target) {
    res.writeHead(400).end('url 파라미터가 필요합니다');
    return;
  }
  if (active >= MAX_CONCURRENT) {
    res.writeHead(429).end('잠시 후 다시 시도해주세요');
    return;
  }
  active++;
  try {
    const { png, height, truncated } = await capturePage(target, {
      width: Number(u.searchParams.get('width')) || undefined,
      mobile: u.searchParams.get('desktop') !== '1',
    });
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': png.length,
      'X-Page-Height': String(height),
      'X-Truncated': String(truncated),
    });
    res.end(png);
  } catch (e) {
    res.writeHead(422, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(e.message));
  } finally {
    active--;
  }
}

server.listen(PORT, () => console.log(`capture server on :${PORT}`));
