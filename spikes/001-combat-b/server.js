// Servidor estático mínimo del spike: node spikes/001-combat-b/server.js → http://localhost:8765
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const MAP = [
  ['/assets/', path.join(ROOT, 'client/public/assets/')],
  ['/fonts/', path.join(ROOT, 'client/public/fonts/')],
  ['/phaser.min.js', path.join(ROOT, 'client/node_modules/phaser/dist/phaser.min.js')],
  ['/', path.join(__dirname, '/')],
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const [pre, dir] = MAP.find(([p]) => u.startsWith(p));
  const file = dir.endsWith('.js') ? dir : path.join(dir, u.slice(pre.length));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404 ' + u); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(process.env.PORT || 8765, () => console.log('spike en http://localhost:' + (process.env.PORT || 8765)));
