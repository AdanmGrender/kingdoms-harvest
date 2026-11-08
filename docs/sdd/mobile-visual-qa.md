# Mobile visual QA → fix features (KH, reusable for any web/Phaser client)

Use when the owner asks to hunt visual bugs, check the app on phones, or prove a layout fix. Tooling lives outside the repo in `D:/Proyectos/_ops/capturas/` (LEEME.md there). It reuses the main checkout's `node_modules` through `createRequire`.

## 1. Capture set (Playwright, fast, no browser bars)
`node D:/Proyectos/_ops/capturas/capturar.mjs --tag <tag> [--url http://localhost:5173] [--pantallas hub,shop] [--disp 360x740,...]`
- Output: `<date>_<tag>/`, with one PNG per phone and screen, `hoja_<screen>.png` (all phones side by side), `index.html` and `reporte.json` (elements outside the viewport, console errors).
- It cannot see `100vh` clipping, the notch or the keyboard, because headless has no browser chrome. Use the emulator for those.
- 429s in the console come from the server rate limit while the script switches phones. They are not a game bug; say so instead of filing them.

## 2. Real Chrome on an Android emulator
`bash D:/Proyectos/_ops/capturas/emulador.sh captura <name>` creates or starts AVD `kh_pixel7` (Pixel 7, 1080×2400 @420 dpi = 412×915 CSS). It sets up `adb reverse` for the preview ports and writes `emulador/<date>_<name>.png`. Never touch other AVDs the owner already has.
- **SDK install from git-bash:** `sdkmanager` hangs on license and stdin prompts. Put the commands in a `.bat` with `< y.txt` (a file of `y` lines) and run `cmd /c 'D:\Android\instalar.bat' </dev/null` in the background. Judge success by the installed folders (`platform-tools`, `emulator`, `system-images`), not by the exit code: a final "file is being used by another process" on the log redirect is harmless.
- **Vite must listen on IPv4:** set `host: true` in the preview config. `adb reverse` lands on 127.0.0.1, while Vite defaults to `::1` only, and Chrome shows the offline dinosaur. The same setting also lets the owner open `http://<pc-ip>:5180` from their real phone over wifi. Redact LAN IPs in logs.
- **Chrome first-run screen:** `adb shell 'echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line'`, then `adb shell am set-debug-app --persistent com.android.chrome`, `force-stop`, and `am start -a android.intent.action.VIEW -d http://localhost:5180/ com.android.chrome`. A notifications dialog may still appear; dismiss it with a tap.
- **Navigate:** `adb shell input tap X Y` uses physical px (CSS × 2.625 on this AVD). Capture with `adb exec-out screencap -p > f.png`.
- **Read small areas:** crop with PIL (e.g. the bottom 500 px) before vision. Full 1080×2400 frames get downscaled, and thin clipped rows vanish.
- **Test a worker branch:** `adb reverse tcp:5180 tcp:5173` temporarily, then restore it with `adb reverse tcp:5180 tcp:5180` at the end.

## 3. Finding bugs (Central)
1. Run vision on each `hoja_<screen>.png` with a concrete checklist: clipped/overlapping, truncated text, duplicated words, English labels, placeholder icons ("!"), off-palette colours.
2. Stitch suspicious regions into ONE image (PIL crops stacked with magenta separators, e.g. `zoom_qa.png`) and ask vision to read the exact text. Downscaled sheets hide the duplicated or truncated words.
3. **Write findings to `<run>/HALLAZGOS.md` right after each vision batch.** Vision output is dropped at context compaction; anything not on disk has to be re-run.
4. Ground each finding in code before filing it: grep the component for the label, then cite `file:line`.
5. Group the findings into fixes by mechanism, not by screen:
   - **viewport/layout root cause** (vh, safe-area, aspect cap, canvas) → `sdd:true` (explorer brief → spec → `[GATE]` impl);
   - **texts** → `sdd:false`, pinned to Haiku;
   - **overlaps/cuts** → `sdd:false`, Sonnet, with before/after captures.
   - Restyle items (palette, contrast) go under "Fuera de alcance", attached to the existing restyle feature, not a new fix.
6. Give each fix the next free feature id in HALLAZGOS.md, and have each branch append its own `feature_list.json` entry (expect the end-of-array conflict at merge).

## 4. Showing motion/animation to the owner
A full-scene video at phone size hides subtle code motion. Recipe:
1. Serve the demo on a free port (not 5173/3001/5180/3101): `"/c/Program Files/nodejs/node.exe" node_modules/vite/bin/vite.js --port 5174 --strictPort </dev/null` in the worktree's `client/` (background).
2. Record with Playwright at 2× (viewport + `recordVideo.size` 824×1720), wait for the demo's done flag (`window.__demo.done`), `video.saveAs(out)`; run with `NODE_PATH=<main checkout>/node_modules`.
3. Find the groups' bounding boxes from one frame (`ffmpeg -ss 4.5 -i big.webm -frames:v 1 f.png` + vision), then one clip per group: `ffmpeg -ss 1 -t 10 -i big.webm -vf "crop=W:H:X:Y,scale=1236:-2:flags=lanczos,setpts=2.5*PTS,minterpolate=fps=50:mi_mode=blend,format=yuv420p" -c:v libx264 -crf 20 -an heroes_lento.mp4`. Check a frame of each clip before sending (the crop must include feet and heads).
4. Send the clips via `MEDIA:` with a "what to look at" list (breathing, weight shift, anticipation, recoil, fall, victory hop) and say honestly if the motion is too subtle.
5. Stop the server: the background PID is a shim; kill the PID that `netstat -ano | grep ":5174 " | grep LISTEN` shows, with `powershell.exe -NoProfile -Command "Stop-Process -Id <pid> -Force"`, then re-check the port is free.

## 5. Dispatch details
- **Worktrees:** create them from the integration HEAD and junction `client` and `server` `node_modules` with a `.ps1` file (`New-Item -ItemType Junction`, looped over names), run via `powershell -NoProfile -ExecutionPolicy Bypass -File`. Inline `powershell -Command` from bash mangles the backslashes and `$`, and `cmd //c mklink /J` silently does nothing.
- **Before/after evidence in a worker:** copy the preview's `vite.preview.config.js` to an uncommitted `vite.worker.config.js` on :5173 that still proxies to the preview server :3101 (no second server). Then run `capturar.mjs --url http://localhost:5173 --tag <fix>_antes|_despues`, and copy the `despues` sheets to `specs/<fix>/evidencia/` with a README of one line per finding. Stop Vite before completing.
- **Visual review:** the Haiku reviewer cannot see images. Central views the `despues` sheets with vision (use `region` crops to zoom) before offering the merge.
- **Acceptance criterion for the layout fix:** the bottom row is fully visible in emulator Chrome, and `reporte.json` shows 0 ⚠ for the affected screens.
- **Emulator paths:** the SDK lives under `D:/Android/Sdk` (`platform-tools/adb.exe`, `emulator/emulator.exe`), not under `%LOCALAPPDATA%`; it is not on PATH, so give workers absolute paths. Emulator fps (`fps_emulador_*.json`) are indicative only — the AVD translates GPU calls; confirm a perf problem on a physical phone (`adb` over USB) before acting on it.
- **Merge order:** when a structural fix and small fixes touch the same file, merge the small ones first and bring the structural branch up to date before its implementation starts.
