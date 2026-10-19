import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return; }
  try { const body = await readFile(path); response.writeHead(200, { 'Content-Type': ({ '.js':'text/javascript', '.html':'text/html', '.css':'text/css' })[extname(path)] || 'application/octet-stream' }); response.end(body); }
  catch { response.writeHead(404).end(); }
}).listen(5197, '127.0.0.1');
