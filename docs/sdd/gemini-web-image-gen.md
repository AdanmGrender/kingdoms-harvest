# Generating art through the Gemini web app (API out of credit / 402)

## Which web surface
- AI Studio (aistudio.google.com) does NOT avoid paying. Its image models (Pro and Lite alike) need a linked paid API key; without one, a run fails with "The caller does not have permission". Do not offer it as a free route.
- gemini.google.com (the consumer app, signed in with the owner's Google account) generates images for free. It runs a different model from the API (Nano Banana Pro), so flag every web-made image as a possible style mismatch at the p-kh art gate.
- Automating the free consumer app may break Google's terms and can get the account rate-limited. Tell the owner, keep 20–40 s pauses between images, stop on any daily-limit message, and recommend the API with credit for big batches.

## Manual flow (Central, desktop preview pane)
1. Open gemini.google.com with `desktop_preview` (the owner logs in; never type credentials).
2. `drive_preview`: Cargas y herramientas → Crear imagen → Relación de aspecto. Use 1:1 for compact buildings, 4:3 for wide and low ones (farm plot), and 3:4 for tall ones (mill).
3. Cargas y herramientas → Archivos opens the native Windows Open dialog. Use `computer_use` list_windows → capture(ax/som) → click the file's ListItem element, which opens it directly. Multi-file `set_value` did not attach anything. Desktop actions need the owner's consent; if one comes back BLOCKED, stop and ask.
4. Type the prompt with `submit=true`, prefixed "Edit the attached image." and carrying the same style block and p-kh rules as the API prompts. Wait about 30 s.
5. Make more variants of the same building in the same chat, saying "Start again from my ORIGINAL uploaded image, NOT from your previous result". This avoids a re-upload and drift. Start a new chat for each new building.
6. To get the result, hover `.conversation-container:last-child model-response img`, click "Copiar imagen" (its ref gains a `-1` suffix on later images in the same chat), then run `powershell -NoProfile -STA -File D:/Proyectos/_ops/gem_refs/clip.ps1 -out <path>.png`. It prints `OK WxH`. Avoid the download button: its native Save dialog vanishes or saves the wrong image. Check `md5sum` across outputs to catch duplicates.
7. Look at each result with vision (subject kept, no green, materials upgraded), then copy it into `art-b/<set>/raw/<id>.png`. Move any replaced raw to `raw/_reemplazados/`, because nothing is deleted. Process and verify (see kh-art-pipeline.md), then hand the rest to the implementer.
- KH scripts run from a worktree need `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules`, because sharp and playwright are installed only in the main checkout.

## Automated flow (`scripts/gen_art_web.js`, tooling feature)
- The owner asked to turn the manual flow into pipeline tooling. Dispatch it as an `sdd:false` implementer task in its own worktree, with acceptance criteria in the body:
  - same CLI as `gen_art_b.js`;
  - Playwright `launchPersistentContext` with `channel:'msedge'`, `headless:false`, and the profile in `D:/Proyectos/_ops/gemini-web-profile`, outside the repo and gitignored;
  - `filechooser` + `setFiles` for uploads and `download.saveAs` for results, so no native dialogs;
  - `run_log` lines tagged `via:'web'`;
  - `gen_art_b.js` only prints the web command on 402/429 and never falls back on its own;
  - the end-to-end test writes to a scratch folder, never over a feature's raw files.
- Login gate: the worker blocks with `needs_input` and the owner signs in to Google in the window that `--login` opens. Central never types credentials.
- Before unblocking after a login, verify that the session really exists. A visible-avatar selector gave a false "✓ sesión iniciada" and closed the window before the owner could log in. Two checks:
  - Read-only, Python sqlite on `<profile>/Default/Network/Cookies`: there must be a google.com cookie named `SID` or `__Secure-1PSID`.
  - A headless Playwright probe opens gemini.google.com and counts the sign-in link against the account link.
- Make `hasSession()` require the session cookie as well as the avatar.
- After the owner signs in, the tab is often left on accounts.google.com or myaccount.google.com, so a loop that only looks for the avatar on Gemini times out even though the login worked. Inside the wait loop, if the session cookie exists and the URL is not gemini.google.com, navigate back to the Gemini URL before checking. Running `--login` again on a profile that already has a session must answer "already logged in" with exit 0.
- Trust the cookie check plus the headless probe over the `--login` exit code: a timeout exit can still mean the login succeeded.
- Only one Edge process can hold a persistent profile. If a window from an earlier run is still open, a new launch fails. Find it with `Get-CimInstance Win32_Process` filtered on the profile path in the command line, and have the owner use or close that window.
