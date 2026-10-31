const { spawnSync } = require('child_process');
const cmd = `(Get-CimInstance Win32_Process -Filter "name='msedge.exe'" | ? { $_.CommandLine -match 'gemini-web-profile' }).Count`;
const r = spawnSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' });
console.log((r.stdout || '').trim() || '0?', r.stderr ? r.stderr.slice(0, 200) : '');
