# Kingdoms Harvest art pipeline (commands verified against the repo scripts)

Run from the repo root (a worktree, never p-kh's checkout). Root tooling: `npm ci --ignore-scripts` installs sharp without the puppeteer failure on Windows.

## Where assets live and who loads them
| Asset | Path | Loader |
|---|---|---|
| Hub pickups | `client/public/assets/b/pickups/<id>.webp` | `client/src/game/hub/hubPickups.js` (`PICKUP_TEXTURES`) |
| Hub sky/base/fg, buildings, workers | `client/public/assets/b/{hub,buildings,workers}/` | `client/src/game/hub/hubLayout.js` texture list |
| Combat B heroes/enemies/bg | `client/public/assets/b/{heroes,enemies,bg}/` | combat B scene |
| UI pieces (frames, buttons, portrait ring) | `client/public/assets/b/ui/` | ui_kit_b components |
| UI icons | ONE sheet `client/public/assets/sprites/grim_icons.png` + map `client/src/config/grimIconSheet.generated.js` (generated, never hand-edit) | `SpriteIcon` in `client/src/utils/spriteMap.js` |
| Old React portraits/enemies | `client/public/assets/game/{heroes,enemies}/<id>.png` | HeroPanel, CombatInstancePanel, WaveDefensePanel |
| AI raw outputs | `art-b/**/raw/*.png` (gitignored, one line per set at the end of `.gitignore`) | — |

Same path + name + format = swap with no code change. A NEW asset needs a loader entry (Phaser texture list or `<img>`/SpriteIcon) and goes through a feature.

## Generate (Gemini)
**Owner rule: the Gemini API key is not used for KH art. Generate only with the free web tooling `node scripts/gen_art_web.js` (same `--manifest`/`--only`/`--force`/`--ref` CLI as `gen_art_b.js`; Edge profile `D:/Proyectos/_ops/gemini-web-profile`, already signed in).** Never propose an API top-up for KH art.
- Stage bodies must say: never call `gen_art_b.js` for generation, never copy or read `server/.env`, never `--login`; on exit 3 (no session) or 4 (Gemini daily limit) commit what exists and `kanban_block(kind=needs_input, reason="gen_art_web exit <n>: faltan <ids>")`. Tell it to ignore older spec lines that mention `GEMINI_API_KEY`.
- Before dispatching, confirm the web session yourself: copy `<profile>/Default/Network/Cookies` to scratch and query it with sqlite3 for `SID` / `__Secure-1PSID` on `.google.com` (the live file is locked while Edge runs).
- The web model differs from the set already in the repo: pass an existing sheet from `art-b/gr/refs/` as `--ref`, and put the reference row on the contact sheet so p-kh judges the match. Web pose sheets come out at 1376x768 (not 2752x1536), which is enough for 640 px heroes.
- Cap generations per stage in the body (net + regenerations) and ask for the count in the summary.
- `gen_art_web.js` uploads only the FIRST entry of a manifest item's `refs`; put the most important reference first and have the worker note the others as not uploaded.
- References must be the current B v2 art: `client/public/assets/b/heroes|enemies/<id>_*.webp` or the v2 raws in `art-b/gr/raw`. Never `art-b/raw` (v1) — `make_refs.js` reads it by default, and with a v1 ref Gemini draws a different character (warrior became an armoured knight with a lantern, bruto a green ogre). If the script cannot pick the ref, build it with sharp directly (montage on #d0d0d0). Also spell out the v2 design literally in the prompt (warrior: stout bearded landsknecht, feathered wide-brimmed hat, red-and-ochre slashed doublet over a breastplate; bruto: goat-headed beastman, curled ram horns, grey skin with yellow-green pustules, rusted cleaver). Before sending a pose sheet to p-kh, compare it side by side with the existing sprites in vision; an identity swap is obvious at a glance and saves an Opus turn.
- Second poses of an existing design (enemy `hit` after `idle`): pass the character's own approved idle as `--ref`, not the style reference, so the design stays identical and only the pose changes. Ask p-kh specifically whether each hit pose reads as a hit; the web model tends to return a near-copy of the idle (only the mouth changes) or to cover the head with the effect.
- Typical web defects to list as suspicions on the contact sheet: enemies drawn frontal instead of facing left, extra hands on 'ghostly' characters, a hatched floor/shadow strip under the feet, outputs larger than requested that get cropped to the target height.
- Manual web recipe and automation notes: `references/gemini-web-image-gen.md`.
- The Edge profile is single-user (`launchPersistentContext` + `lockfile`). When two workers may generate in parallel, each body must say: before every generation, `powershell -NoProfile -c "(Get-CimInstance Win32_Process -Filter \"name='msedge.exe'\" | ? { $_.CommandLine -match 'gemini-web-profile' }).Count"` must be 0, else wait 2 min (up to 30), then `kanban_block(kind=transient)`.
- Owner requests for "more frames / personality": do not do frame-by-frame with Gemini (character identity drifts between images and flickers in motion; art-direction-b rule 6). Offer (a) code motion — anticipation, squash/stretch, recoil, per-class motion profile, reduced-motion safe, within the round budget — and (b) extra key poses generated together in ONE pose sheet with the existing sheet as `--ref`. Pilot on one hero + one enemy in its own worktree, with new files (`motion.js`, `poseMap.js`) so it does not collide with a feature editing `artMap.js`, and before/after Playwright videos as owner evidence. Spine/skeletal stays deferred (art-direction option C).

### API path (legacy, kept only to read old specs: `GEMINI_API_KEY` in server/.env, ~0.14 USD/image at 2K)
- After any API run in old branches, check that no commit carries the key: `git log -p <base>..HEAD | grep -c -E "AIza[0-9A-Za-z_-]{20}"` must print 0.
- HTTP 402 meant the AI Studio credit was used up, not a key or code bug.

### Script usage (both scripts share it)
- Regen of rejected icons: replace only those cells in the sheet (and the candidate map if coordinates move), and build a comparison sheet of the regenerated icons next to the ones they were confused with, at 24/32/48 px.
- One image: `node scripts/gen_art_b.js --kind prop --aspect 1:1 --prompt "<object only>" --out art-b/<set>/raw/<id>.png`. The B style block is prepended automatically.
- Kinds: `prop` = single centered object, no floor (icons, pickups); `actor` = characters on a light background; `scene` = full backgrounds; `ui` = UI piece sheet.
- Flags: `--ref <img>` style reference (refs in `art-b/gr/refs/`), `--model <id>`, `--size 1K` cheaper.
- Batch: `node scripts/gen_art_b.js --manifest art-b/<set>/manifest.json --only id1,id2 --force`. The same `--manifest` flag works with `gen_art_web.js` for the free web path.
- A new set (no `art-b/<set>/manifest.json` yet) needs one created before either script can run: copy the format of an existing sibling (`art-b/tramos/manifest.json` or `art-b/hub/manifest.json` — fields `prompt`, `aspect`, `ref`, `out` per item), filling prompts/aspects from the feature's design.md/tasks.md art section. Grep `tasks.md` for the task id (e.g. `T11`) to get the exact asset list and output paths before writing it.

## Cut out / convert
`node scripts/process_art_b.js <in.png> <out.webp> --height 256` removes a flat background. Flags: `--scene` (keep background), `--crop x,y,w,h`, `--tol N`, `--flip`, `--pad N`. `art-b/process.sh` reprocesses the hub set.

## Icon sheet
One PNG per icon in `art-inbox/icon_<name>.png` (names from the list in `scripts/assemble_icon_sheet.js`), then `node scripts/assemble_icon_sheet.js`. `scripts/gen_icons.sh [names]` generates in the OLD grimdark style; for style B, use `gen_art_b.js --kind prop` with output in art-inbox. ui_kit_b stage C moves the sheet to `assets/b/ui/icons.webp` (192 px cells).

## Verify (put the output in Evidencia)
Check alpha-0 corners with sharp:
```
node -e "require('sharp')(process.argv[1]).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>{const a=(x,y)=>data[(y*info.width+x)*4+3];console.log([a(0,0),a(info.width-1,0),a(0,info.height-1),a(info.width-1,info.height-1)])})" <file.webp>
```
Expect `[0,0,0,0]`. Building tiers use `scripts/verify_tiers_b.js <id>` (R13 alpha-0 border, R14 foot on the bottom edge, R15 aspect within the limit of the base sprite, R16 horizontal centre `dcx` <= 6 %).

When a sprite fails only the transparent-border check, do not regenerate it. The raw PNG is kept in `art-b/<set>/raw/`, so fix the processing: crop to content, erode the semi-transparent halo, pad 2 px or more on the sides and top, keep the foot on the bottom edge. Then re-verify the whole set. Repeated regeneration costs credit and does not fix a cutout halo. Regenerate only on shape failures, such as the aspect ratio being too narrow.

A passing verifier does not prove that the cutout worked. After reprocessing adds a transparent margin (`--margin`/`--pad`), an R13 check on the outer border passes even when the whole flat background is still there as an opaque box. Measure alpha inside the margin: the share of pixels with alpha > 8 on row 6 (or on the first row of the content bbox) is 5–25 % for a real cutout and about 99 % for an uncut box. Scratch script: `D:/Proyectos/_ops/gem_refs/corners.js`. Send failures back with "fix the cutout and make R13 measure inside the bbox; it must fail on the bad ones and pass on the rest", never relaxing the rule.

Build a contact sheet on a dark or checkered background with `scripts/contact_sheet_b.js` (an uncut box shows up there as a grey rectangle) into `<worktree>/evidencia/`, with the existing reference sprites as a second row, and capture the scene at 412x860. Sheets are `.webp`; convert to PNG with sharp before loading them in vision.

## p-kh art rules (what the art gate checks)
One object per icon; no text, drawn frames or floor strip; dark objects get a lit rim; green only for magic/corruption (the Mácula); success states use brass-light + text, not green; `gear` (settings) is intentionally a key; building icons are only used at >=40 px with their name visible, never as bare 24/32 px icons; legacy enemy art is accepted until combate_b. Source: `docs/art-direction/ui-kit-b.md` §6.1 (icons) and §7 (gate).

### Building tiers (bajo/medio/alto + obra)
- The current `<id>.webp` is the low tier and is never overwritten. Medium, high and `obra` (under reconstruction, shown while `is_building`) share foot and anchor with it.
- Run a pilot on one building (barn) first. Gate it with p-kh before generating the rest, because the verdict becomes prompt rules for every other building.
- p-kh prompt rules:
  - upgrade through materials, not shape: wood → wood + stone + iron → dressed stone + carved wood + brass + one warm orange light;
  - keep the low tier's functional feature ("keep the open barn door with sacks");
  - "as wide and low as the reference", with no tall banners and no "imposing/majestic";
  - "no green anywhere: no moss, no lichen, no ivy"; roofs in slate, umber, rust or ochre;
  - heraldry small and flat, with no emblem;
  - the `obra` of a stone building shows a half-built wall section.

## Show the game to the owner (screenshots)
1. Start Vite from the worktree on a free port, calling node directly so no winpty shim or orphan is left: `"/c/Program Files/nodejs/node.exe" node_modules/vite/bin/vite.js --port 5190 --strictPort --host 127.0.0.1 </dev/null > D:/Proyectos/_ops/vite5190.log 2>&1` (terminal background, workdir `client/`). Start the server the same way only if the screen needs live data.
2. `browser_exec(local=True, session="kh")`: emulate mobile with `cdp('Emulation.setDeviceMetricsOverride', width=412, height=900, deviceScaleFactor=2, mobile=True)`, open the URL, click "Entrar al Bastión" and then "Saltar" (tutorial) through `js()`, wait, and capture. Repeat at 1366x768 for desktop after a reload, because changing the viewport does not re-layout the Phaser canvas. Open panels such as "Construir" the same way.
3. Copy each capture to `D:\Proyectos\_ops\capturas\<n>_<view>.png`, inspect with vision, and deliver with `MEDIA:`.
4. Report what already works, what cannot be seen yet (e.g. the test account has every building at level 1, so only the low tier shows) and the visual bugs you spotted. Offer to bundle the bugs as an SDD fix feature instead of patching them inline.
5. Stop every dev server you started (match the port in the node command line) before ending the turn.
6. Before/after videos from a worker (Playwright `.webm`): send the owner ONE side-by-side mp4 instead of two files: `ffmpeg -y -loglevel error -i antes.webm -i despues.webm -filter_complex "[0:v]drawtext=text='ANTES':x=20:y=20:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6,setpts=PTS-STARTPTS[a];[1:v]drawtext=text='DESPUES':x=20:y=20:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6,setpts=PTS-STARTPTS[b];[a][b]hstack=inputs=2:shortest=1,scale=824:-2" -c:v libx264 -pix_fmt yuv420p -crf 26 -an <scratch>/x.mp4 </dev/null` (h264 plays inline on Telegram; webm does not). Grab a frame (`-ss 5 -frames:v 1 x.png`) and check it in vision before sending.

## Persistent live phone preview (owner watches the integrated build)
The owner wants a phone-sized window showing the app as it is being built. Show the **integration branch**, not a worker's half-done tree. Offer a second tab pointed at a worker's worktree only if the owner asks for one.
1. Create a dedicated worktree: `git worktree add --detach ../<repo>-wt/_preview <integration-branch>`.
2. Point its `client/node_modules` and `server/node_modules` at the main checkout with a junction: `powershell -NoProfile -Command "New-Item -ItemType Junction -Path ('<wt>\' + '<dir>' + '\node_modules') -Target ('<main>\' + '<dir>' + '\node_modules')"`. `cmd //c mklink /J` silently did nothing from git-bash. Check the result with `ls client/node_modules/.bin | grep vite`.
3. Give it its own `server/.env`. Copy only the non-secret keys (`NODE_ENV`, `DEVICE_AUTH_ENABLED`, `TICK_INTERVAL_MS`), then add `PORT=3101`, `BOT_POLLING=false` and a dummy `BOT_TOKEN`. env.js requires `BOT_TOKEN`, and the server exits with "Variable de entorno requerida" without it.
   - Never copy the real token, `DATABASE_URL` or `WEBAPP_URL`.
   - The SQLite DB under `_preview/server/data` stays separate.
4. Add `client/vite.preview.config.js`: it imports `vite.config.js` and overrides the port (5180, `strictPort`) and the `/api` and `/socket.io` proxy targets (→ :3101).
   - Exclude it, and the preview logs, via `git rev-parse --git-path info/exclude`, so the worktree stays clean.
   - Keep 5173/3001 free for the workers.
5. Run `node --watch src/index.js` (server) and `node node_modules/vite/bin/vite.js --config vite.preview.config.js` (client), both as terminal background jobs with `</dev/null`.
   - Verify with `curl` on `:5180/` and `:5180/api/health`.
   - A 500 through the proxy means the server died: read its log.
6. Show it in the app next to the chat with `desktop_preview(action="open", url="D:/Proyectos/_ops/preview/celular.html")`. That file is a phone frame that iframes `http://localhost:5180`, with size buttons 412×860 / 360×740 / 390×844 and a reload button. In-browser alternative: `http://localhost:5180` with DevTools device mode, which also emulates touch.
7. Relaunch or refresh after merges with `bash D:/Proyectos/_ops/preview/arrancar.sh`. It checks out the integration branch in `_preview` and starts whatever is down.

## Checking that the app fits a phone screen
For systematic checks, use `references/mobile-visual-qa.md`: the 5-phone capture set, real Chrome on the emulator, and filing bugs as fixes. The CDP notes below are for a quick one-off check inside browser_exec.
- Emulate each target size with `Emulation.setDeviceMetricsOverride` (360×740, 390×844, 412×860/915, plus one 20:9). Reload after every change, then enter the hub ("Entrar al Bastión", then "Saltar").
- Capture with `cdp('Page.captureScreenshot', format='png')` and write the base64 to the workspace. It is more reliable than `capture_screenshot()`, which can time out on the Phaser page.
- Also dump the canvas rects (`getBoundingClientRect`) and every element that overflows `innerWidth`/`innerHeight`.
- Two canvases, the second with top = viewport height, is the dev-only React StrictMode double mount of `PhaserGame`. It is not a layout bug in production. Mention it, and do not chase it as the cause.
- Emulation does not reproduce the real-phone clipping:
  - `h-screen`/`100vh` includes the area under the browser or Telegram bars, which hides the bottom row; use `100dvh` or Telegram's `viewportStableHeight`;
  - without `viewport-fit=cover` and `env(safe-area-inset-*)`, the notch covers the top HUD.

  When everything fits in emulation, say so, and name these two as the likely real-device causes. Ask the owner for a real-phone screenshot, then propose a client-only `sdd:false` fix feature, tested at all four sizes.
- Reference metrics for portrait mobile games: design ~1000 px wide, about 1000×1800; scale to width and let the height stretch up to a 2.1 aspect ratio; draw the background under the notch and inset the HUD by the safe area. Derivation: game-reference-analysis skill, `references/unity-screen-metrics.md`.

Owner's manual testing guide: `docs/art-direction/guia-manual-arte.md` (copy in `D:\Proyectos\_arte-pruebas\GUIA.md`).

