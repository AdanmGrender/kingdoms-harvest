---
name: kh-art-pipeline-b
description: Use when making Kingdoms Harvest art (direction B).
version: 1.0.0
author: p-kh
license: MIT
metadata:
  hermes:
    tags: [kingdoms-harvest, ai-art, gemini, phaser, game-art]
    related_skills: [local-docker-services, spike]
---

# Kingdoms Harvest — art pipeline, direction B

Gemini 3 Pro Image generation + cutout + Phaser review loop.
Repo D:\Proyectos\kingdoms-harvest, integration branch feat/art-direction-b. Contract + phases:
`docs/art-direction-b.md`. The repo runs an SDD harness (skill sdd-agent-harness): art for a feature
is specified in `specs/<feature>/design.md` (manifest `art-b/<area>/manifest.json` + `process.sh`),
and contact sheets/screenshots go to `specs/<feature>/evidencia/` as the task's evidence.
The game is an IDLE outside combat: the hub is the most-viewed screen, so art must show production
(animated workers, collectible objects in the scene, building look per level tier, storms on the
sky). Lore v2 names: `docs/lore.md` + `docs/lore-glosario.md` (source: `scripts/lore_v2_apply.js`,
display strings only, never ids). Changing visible game text: see `references/lore-text-migration.md`. Reference scene:
`spikes/001-combat-b` (`node spikes/001-combat-b/server.js` → http://localhost:8765).

## When to Use

Any new art for Kingdoms Harvest (heroes, enemies, backgrounds, UI) or tweaking the combat spike.

## Owner standing preferences

- Quality bar = the first combat spike samples: keep that engraving look everywhere and favour
  sharpness over saving pixels. Scenes render at device resolution (canvas × DPR, capped 3,
  `pixelArt: false`, antialias on) — the game-wide `Scale.RESIZE` + `pixelArt: true` config renders at
  CSS px with NEAREST filtering, which is why everything looked blurry on phones.
- Size art for DPR 2-3: hub layers up to 1536 px wide (other backgrounds ≤ 1080), never upscaled.
- The old pixel/diorama hub (`WorldScene` hubMode) is retired — do not keep legacy fallbacks or mix
  pixel sprites into B scenes.

## Style (owner decision 2026-10-16)

Grimdark Renaissance (Warhammer-Fantasy-like TRAITS, never its IP): woodcut/engraving ink,
cross-hatching, earthy palette + sickly green magic, heroic oversized proportions, landsknechte,
matchlocks, decaying half-timbered towns, dark humour. Preset `grimdark` in gen_art_b.js (default);
`ink` = the older clean gothic style. Never put franchise, faction or real artist names in prompts.
Active manifest: `art-b/gr/manifest.json`, processing `art-b/gr/process.sh`, refs `art-b/gr/refs/*.webp`
(raw 2K output in art-b/gr/raw is gitignored). Fonts: IM Fell English / SC.

## Procedure

1. Add items to `art-b/gr/manifest.json` (`id, kind: actor|scene|ui, aspect, prompt, refs`).
   Style ref: `art-b/gr/refs/anchor.webp` (or `mage_idle.webp` when the anchor's greatsword leaks).
   HEROES: one `kind: ui`, `aspect: 16:9` POSE SHEET per character — "exactly TWO full-body figures
   of the SAME character side by side... LEFT idle, RIGHT attack... no inset panels". Do NOT make
   attack poses by editing an idle ref (gives 4 legs / 2 heads / ghost weapons).
   Enemies: idle actor + hit pose (editing worked for the brute).
   BUILDINGS/PROPS: several per `16:9` sheet (2-3 per sheet, explicit gap, no figures) and crop by
   connected components; a single building with refs tends to come back with inset panels or a kit of
   loose parts. Workers: one 2-pose sheet per kind, like heroes.
2. Generate: `node scripts/gen_art_b.js --manifest art-b/gr/manifest.json [--only a,b] [--force]`
   (default model gemini-3-pro-image, 2K; ~25 s and ~0.13 USD per image; key GEMINI_API_KEY in
   server/.env — never print it).
3. Process: add lines to `art-b/gr/process.sh` and run `NODE="/c/Program Files/nodejs/node.exe" bash art-b/gr/process.sh`.
   Split pose sheets with `--crop` at the empty-column gap (scan columns for non-bg pixels);
   `--flip` if an attack faces left, `--erase x,y,w,h` for prop insets, `--fade-right 0.18` when
   smoke/FX is cut by the sheet edge. Heroes `--height 640`, enemies `--height 720`, scenes
   `--scene --width 1080`, UI `--crop` from connected-component bboxes.
   Output webp under `client/public/assets/b/`.
4. Review EVERY asset on a dark contact sheet (Playwright page via `goto(file:///...html)`) before
   integrating. Expect ~1 in 4 to need regeneration.
5. Raw 2K files are gitignored except the anchor; commit processed webp only.

## Pitfalls

- gemini-3-pro-image returns JPEG even for .png names → gen_art_b normalizes to PNG with sharp;
  pngjs alone cannot read the raw files.
- Reference leakage: extra heads/feet from the ref, or the ref character copied into a new subject.
  The prompt forbids it; process_art_b drops detached blobs (`--keep-ratio`), but still eyeball.
- Facing direction is not reliable (heroes must face right, enemies left) → check, use `--flip`.
- Enclosed background pockets (between staff and robe) survive a border flood-fill → process_art_b
  removes large near-bg blobs (`holes=` in its log). Watch for false holes on light-grey armour.
- UI sheets: measure component bboxes programmatically (connected components on non-bg pixels)
  instead of guessing crop coords; the ring frame has an opaque centre → CSS mask it.
- Portrait crops from full-body sprites: compute background-position from the head location
  (scan alpha rows); the topmost pixels are often a staff/weapon, not the head.
- Playwright: `page.setContent` cannot load file:// images (write an .html and `goto` it).
  For real GPU in headless use `channel: 'chromium', args: ['--use-angle=d3d11','--enable-gpu']`;
  swiftshader makes screenshots take seconds each.
- Fonts: Google Fonts is blocked by the server CSP; use bundled `client/public/fonts/fonts.css`.
- The engraving style pulls a parchment/vignette background onto single-figure actors → colour
  flood-fill fails (bbox = whole image). Pose sheets come out flat; fallback is rembg:
  `uv run --python 3.12 --with "rembg[cpu]" --with pillow python ...` (write output to a Windows path,
  not /tmp).
- ICONS: a 1:1 sheet of 3x3 icons comes back cleanly separated → cut by grid + grey key (|R-G|,|G-B|<14 and
  R>170 → transparent) + trim. Use the simplified-woodcut prompt (`art-b/uikit/manifest.json`, icon_test_b_bold):
  one object per icon (crossed pairs break at 24 px), no baked glow (leaves a pale ring after cutout — glow via
  CSS), dark objects need a warm rim highlight or they vanish on dark chrome, forbid sickly green on common
  items. Judge on a contact sheet at 24/32/48 px over the real chrome colour. UI brief: `docs/art-direction/ui-kit-b.md`.
- BACKGROUNDS UNDER UI (menu key art, panel textures): before prompting "calm zones", measure where the
  real layout puts title/buttons in screenshots at 360x740/360x800/412x915 (MainMenu centres its block:
  ~25-75 % of height) and give the band as explicit % of height; with `cover` on 9:16 art those phones fit
  by height, so image % = screen %. "Calm upper/lower thirds" put the subject right behind the buttons.
  Judge on the in-app screenshots, not only on the contact sheet. Prompt that worked: subject "small and
  distant... fits inside the lowest quarter (nothing above 76 % of the height)" + "between 22 % and 76 % open,
  calm sky, very low contrast". A flat-wash sky band looks empty in the raw file but reads fine under the
  menu's ink 0.7 overlay; don't ask for dense hatching there (it puts noise back behind the text).
- Phaser depth: the focus dim layer must sit ABOVE all idle actors and the focused pair above it
  (dim 2000, focused 2100+, FX 2500+); actors use depth = y (~1000-1400).
