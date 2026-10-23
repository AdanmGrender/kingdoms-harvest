'use strict';
/**
 * gen_art_web.js — genera arte B por la WEB gratuita de Gemini (gemini.google.com)
 * con la sesión de Google del owner, cuando la API de gen_art_b.js da 402/429.
 * Es OTRO modelo que la API (gemini-3-pro-image): el estilo puede variar → la
 * puerta de arte de p-kh sigue siendo obligatoria. Ver docs/art-direction-b.md
 * ("Generar por la web (sin crédito API)").
 *
 *   node scripts/gen_art_web.js --login                      (una vez; el owner inicia sesión en la ventana)
 *   node scripts/gen_art_web.js --manifest art-b/x/manifest.json [--only id1,id2] [--force]
 *   node scripts/gen_art_web.js --prompt "..." --out art-b/raw/x.png --aspect 9:16 [--kind prop] [--ref a.png]
 *
 * Mismo CLI y mismo texto de prompt que gen_art_b.js (se importa su buildPrompt).
 * Solo se sube la PRIMERA ref (el chat web no es multi-ref fiable).
 * Perfil de Edge: D:/Proyectos/_ops/gemini-web-profile (fuera del repo; env GEMINI_WEB_PROFILE).
 * Dependencias: playwright + sharp. En un worktree sin node_modules se usa solo
 * el del repo principal (o NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules).
 * Códigos de salida: 0 ok · 1 fallos · 2 uso · 3 sesión no iniciada · 4 límite diario de Gemini.
 * Nunca imprime ni guarda cookies/credenciales: la sesión vive solo en el perfil.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

// ─── Selectores de la UI de Gemini ────────────────────────────────────────────
// ⚠ La UI de gemini.google.com CAMBIA sin aviso (textos, aria-labels, componentes).
// Si el script deja de funcionar, ajustá SOLO este objeto. Los textos admiten
// español e inglés. Ante un fallo, se guarda una captura en DEBUG_DIR.
const SEL = {
  url: 'https://gemini.google.com/app',
  // Avatar de la cuenta = sesión iniciada. Botón "Iniciar sesión" = no iniciada.
  avatar: 'a[href*="accounts.google.com/SignOutOptions"], a[aria-label*="Cuenta de Google" i], a[aria-label*="Google Account" i], button[aria-label*="Cuenta de Google" i], button[aria-label*="Google Account" i]',
  signIn: 'a[href*="accounts.google.com/ServiceLogin"], a[href*="accounts.google.com/AccountChooser"]',
  // Caja de texto del prompt
  prompt: 'rich-textarea div[contenteditable="true"], div.ql-editor[contenteditable="true"], div[role="textbox"][contenteditable="true"]',
  // Menú "Cargas y herramientas" → opciones
  toolsBtn: /cargas y herramientas|uploads? and tools|upload|subir|herramientas|tools/i,
  createImage: /crear (una )?imagen|create image/i,
  uploadFiles: /^\s*(subir )?archivos?\s*$|upload files?|subir archivos?/i,
  aspectBtn: /relaci[oó]n de aspecto|aspect ratio/i,
  sendBtn: 'button[aria-label*="Enviar" i], button[aria-label*="Send" i]',
  // Resultado
  resultImg: 'model-response img',
  downloadBtn: 'button[aria-label*="tamaño completo" i], button[aria-label*="full size" i], button[aria-label*="Descargar imagen" i], button[aria-label*="Download image" i]',
  // Límites: si aparece este texto en la página, se corta
  limitText: /alcanzaste el l[ií]mite|l[ií]mite diario|l[ií]mite de (im[aá]genes|uso)|llegaste al l[ií]mite|(reached|hit) (your|the) (daily )?limit|daily limit|try again tomorrow|vuelve (a intentarlo )?ma[ñn]ana|can't create more images/i,
};

const PROFILE_DIR = process.env.GEMINI_WEB_PROFILE || 'D:/Proyectos/_ops/gemini-web-profile';
const DEBUG_DIR = process.env.GEMINI_WEB_DEBUG_DIR || 'D:/Proyectos/_ops/gemini-web-debug';
const ASPECTS = { '1:1': 1, '3:4': 3 / 4, '4:3': 4 / 3, '9:16': 9 / 16, '16:9': 16 / 9 };
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const GEN_TIMEOUT_MS = 120 * 1000;

const EXIT = { OK: 0, FAIL: 1, USAGE: 2, NO_SESSION: 3, LIMIT: 4 };
class LimitError extends Error {}
class NoSessionError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HELP = `gen_art_web.js — arte B por la web gratuita de Gemini (cuando la API da 402/429)

Uso:
  node scripts/gen_art_web.js --login
  node scripts/gen_art_web.js --manifest <json> [--only id1,id2] [--force]
  node scripts/gen_art_web.js --prompt "..." --out <png> [--aspect 9:16] [--kind prop] [--ref a.png]

Opciones:
  --login      abre gemini.google.com en Edge; el owner inicia sesión (hasta 10 min) y se cierra
  --manifest   lista [{ id, kind, aspect, prompt, refs?, out? }] (igual que gen_art_b.js)
  --only       ids separados por coma
  --force      regenera aunque el PNG ya exista
  --prompt     modo suelto (con --out, --aspect, --kind, --ref); solo se sube la primera --ref
  --help       esta ayuda

Perfil de Edge: ${PROFILE_DIR} (fuera del repo; env GEMINI_WEB_PROFILE)
Aspectos web: 1:1, 3:4, 4:3, 9:16, 16:9 (otro aspecto → el más cercano)
Salida: 0 ok · 1 fallos · 2 uso · 3 sesión no iniciada · 4 límite diario de Gemini
Es otro modelo que la API: el estilo puede variar (la puerta de arte de p-kh sigue vigente).`;

// playwright/sharp: el worktree puede no tener node_modules → caer al del repo principal.
function ensureModules() {
  for (const m of ['playwright', 'sharp']) {
    try { require.resolve(m); } catch (_) {
      const fallback = 'D:/Proyectos/kingdoms-harvest/node_modules';
      if (!fs.existsSync(path.join(fallback, m))) {
        throw new Error(`falta el módulo ${m}: instalá dependencias o usá NODE_PATH=${fallback}`);
      }
      process.env.NODE_PATH = [process.env.NODE_PATH, fallback].filter(Boolean).join(path.delimiter);
      Module._initPaths();
    }
  }
}

function closestAspect(aspect) {
  if (ASPECTS[aspect]) return aspect;
  const [w, h] = String(aspect).split(':').map(Number);
  const r = w / h;
  if (!(r > 0)) return '1:1';
  return Object.keys(ASPECTS).reduce((best, k) => (
    Math.abs(Math.log(ASPECTS[k] / r)) < Math.abs(Math.log(ASPECTS[best] / r)) ? k : best
  ), '1:1');
}

async function openContext() {
  ensureModules();
  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    channel: 'msedge',
    headless: false,
    ignoreDefaultArgs: ['--enable-automation'],
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1360, height: 900 },
    acceptDownloads: true,
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(30000);
  return { ctx, page };
}

async function debugShot(page, tag) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const f = path.join(DEBUG_DIR, `${tag}-${Date.now()}.png`);
    await page.screenshot({ path: f });
    console.error(`  (captura de depuración: ${f})`);
  } catch (_) { /* best effort */ }
}

// true si hay avatar (sesión); false si aparece "Iniciar sesión" o pasa el timeout.
// Central: el avatar solo daba falsos positivos (login "✓" sin cookies de sesión en el perfil).
// La sesión real se confirma por la cookie de sesión de Google (SID / __Secure-1PSID) + avatar visible.
async function hasGoogleSessionCookie(page) {
  const cookies = await page.context().cookies('https://gemini.google.com').catch(() => []);
  return cookies.some((c) => c.name === 'SID' || c.name === '__Secure-1PSID');
}

// El selector del avatar casa con varios nodos y el primero puede estar oculto (menú móvil): basta uno visible.
async function anyVisible(loc) {
  const n = await loc.count().catch(() => 0);
  for (let i = 0; i < n; i++) if (await loc.nth(i).isVisible().catch(() => false)) return true;
  return false;
}

async function hasSession(page, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await hasGoogleSessionCookie(page) && await anyVisible(page.locator(SEL.avatar))) return true;
    await sleep(1000);
  }
  return false;
}

async function login() {
  const { ctx, page } = await openContext();
  try {
    await page.goto(SEL.url, { waitUntil: 'domcontentloaded' });
    if (await hasSession(page, 8000)) { console.log('✓ la sesión ya estaba iniciada'); return EXIT.OK; }
    console.log('Iniciá sesión de Google en la ventana de Edge (espero hasta 10 min)…');
    if (await page.locator(SEL.signIn).first().isVisible().catch(() => false)) {
      await page.locator(SEL.signIn).first().click().catch(() => {});
    }
    const t0 = Date.now();
    while (Date.now() - t0 < LOGIN_TIMEOUT_MS) {
      // Si ya hay cookie de sesión pero la pestaña quedó fuera de gemini (p. ej. accounts/myaccount.google.com),
      // volver a gemini.google.com y recién ahí sondear el avatar.
      if (!/^https:\/\/gemini\.google\.com\//.test(page.url()) && await hasGoogleSessionCookie(page)) {
        await sleep(3000); // margen por si el flujo de Google aún está redirigiendo
        if (!/^https:\/\/gemini\.google\.com\//.test(page.url()) && await hasGoogleSessionCookie(page)) {
          await page.goto(SEL.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
        }
      }
      if (/^https:\/\/gemini\.google\.com\//.test(page.url()) && await hasSession(page, 1500)) {
        await sleep(3000); // dejar que se persistan las cookies en el perfil
        console.log('✓ sesión iniciada; perfil guardado en el perfil de Edge (fuera del repo)');
        return EXIT.OK;
      }
      await sleep(2000);
    }
    console.error('✗ login: se acabaron los 10 minutos sin ver la cuenta');
    return EXIT.FAIL;
  } finally { await ctx.close().catch(() => {}); }
}

async function assertNoLimit(page) {
  const txt = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const m = txt.match(SEL.limitText);
  if (m) throw new LimitError(`Gemini muestra un límite ("${m[0]}"): parar y reintentar más tarde (ver docs/art-direction-b.md)`);
}

async function clickMenuItem(page, name) {
  // La UI usa menuitem / menuitemcheckbox ("Crear imagen") / menuitemradio (aspectos) según el ítem.
  const item = page.locator('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')
    .filter({ hasText: name }).first();
  await item.waitFor({ state: 'visible', timeout: 10000 });
  await item.click();
}

async function openTools(page) {
  await page.getByRole('button', { name: SEL.toolsBtn }).first().click();
}

// Nuevo chat → Crear imagen → aspecto (→ primera ref por filechooser). Deja el prompt listo para escribir.
async function prepareChat(page, item) {
  await page.goto(SEL.url, { waitUntil: 'domcontentloaded' });
  await page.locator(SEL.prompt).first().waitFor({ state: 'visible', timeout: 30000 });
  await assertNoLimit(page);

  await openTools(page);
  await clickMenuItem(page, SEL.createImage);

  const aspect = closestAspect(item.aspect || '1:1');
  if (aspect !== (item.aspect || '1:1')) console.log(`  (aspecto ${item.aspect} no existe en la web → ${aspect})`);
  await page.getByRole('button', { name: SEL.aspectBtn }).first().click();
  await clickMenuItem(page, new RegExp(`^\\s*${aspect.replace(':', '\\s*:\\s*')}\\b`));

  const ref = (item.refs || [])[0];
  if (ref) {
    const abs = path.isAbsolute(ref) ? ref : path.join(require('./gen_art_b').ROOT, ref);
    if (!fs.existsSync(abs)) throw new Error(`ref no encontrada: ${ref}`);
    await openTools(page);
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      clickMenuItem(page, SEL.uploadFiles),
    ]);
    await chooser.setFiles(abs); // sin diálogo nativo de Windows
    await sleep(2500); // miniatura adjunta
  }
  return { hasRef: !!ref, aspect };
}

async function sendPrompt(page, text) {
  const box = page.locator(SEL.prompt).first();
  await box.click();
  await box.fill(text);
  const send = page.locator(SEL.sendBtn).first();
  if (await send.isVisible().catch(() => false)) await send.click(); else await page.keyboard.press('Enter');
}

// Espera la imagen generada; corta si aparece un límite.
async function waitForResult(page) {
  const t0 = Date.now();
  while (Date.now() - t0 < GEN_TIMEOUT_MS) {
    const ok = await page.locator(SEL.resultImg).evaluateAll(
      (imgs) => imgs.some((i) => i.complete && i.naturalWidth >= 256),
    ).catch(() => false);
    if (ok) return;
    await assertNoLimit(page);
    await sleep(1500);
  }
  throw new Error(`timeout (${GEN_TIMEOUT_MS / 1000}s) esperando la imagen generada`);
}

// Descarga a tamaño completo por el evento 'download'; el resultado es un PNG normalizado en `out`.
async function downloadResult(page, out) {
  const sharp = require('sharp');
  const img = page.locator(SEL.resultImg).last();
  await img.scrollIntoViewIfNeeded().catch(() => {});
  await img.hover().catch(() => {});
  const btn = page.locator(SEL.downloadBtn).last();
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    btn.click(),
  ]);
  const tmp = `${out}.part`;
  await dl.saveAs(tmp);
  try { await sharp(tmp).png().toFile(out); } finally { fs.rmSync(tmp, { force: true }); }
}

function appendRunLog(item, out, entry) {
  // run_log.jsonl junto a los crudos (misma carpeta que el PNG; con manifest = <lote>/raw/)
  const f = path.join(path.dirname(out), 'run_log.jsonl');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.appendFileSync(f, `${JSON.stringify({ item: item.id, via: 'web', ...entry, ts: new Date().toISOString() })}\n`);
  return f;
}

async function generateOne(page, item) {
  const { buildPrompt, ROOT } = require('./gen_art_b');
  const out = path.isAbsolute(item.out) ? item.out : path.join(ROOT, item.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const t0 = Date.now();
  const { hasRef, aspect } = await prepareChat(page, item);
  // Mismo texto que la API (buildPrompt); con ref se antepone el pedido de edición.
  const text = `${hasRef ? 'Edit the attached image. ' : ''}${buildPrompt(item)}`;
  await sendPrompt(page, text);
  await waitForResult(page);
  await downloadResult(page, out);
  const sharp = require('sharp');
  const meta = await sharp(out).metadata();
  const bytes = fs.statSync(out).size;
  const ms = Date.now() - t0;
  const logFile = appendRunLog(item, out, { ok: true, aspect, ref: hasRef ? item.refs[0] : null, w: meta.width, h: meta.height, bytes, ms });
  console.log(`✓ ${item.id} → ${out} (${meta.width}x${meta.height}, ${(bytes / 1024) | 0} KB, ${(ms / 1000).toFixed(0)}s) [via web]`);
  console.log(`  run_log: ${logFile}`);
}

function parseArgs(argv) {
  const { parseArgs: base } = require('./gen_art_b');
  const a = base(argv);
  a.login = argv.includes('--login');
  a.help = argv.includes('--help') || argv.includes('-h');
  return a;
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) { console.log(HELP); return EXIT.OK; }
  ensureModules();
  const a = parseArgs(process.argv);
  if (a.login) return login();

  const { loadItems, ROOT } = require('./gen_art_b');
  const items = loadItems(a);
  if (!items) { console.error(HELP); return EXIT.USAGE; }
  const todo = items.filter((it) => {
    const out = path.isAbsolute(it.out) ? it.out : path.join(ROOT, it.out);
    if (!a.force && fs.existsSync(out)) { console.log(`· ${it.id} ya existe (usa --force)`); return false; }
    return true;
  });
  if (!todo.length) return EXIT.OK;

  const { ctx, page } = await openContext();
  let fails = 0;
  try {
    await page.goto(SEL.url, { waitUntil: 'domcontentloaded' });
    if (!await hasSession(page, 20000)) throw new NoSessionError('sesión no iniciada: correr --login');
    for (let i = 0; i < todo.length; i++) {
      const it = todo[i];
      try {
        await generateOne(page, it);
      } catch (e) {
        if (e instanceof LimitError || e instanceof NoSessionError) throw e;
        fails++;
        console.error(`✗ ${it.id}: ${e.message}`);
        await debugShot(page, it.id);
        const out = path.isAbsolute(it.out) ? it.out : path.join(ROOT, it.out);
        appendRunLog(it, out, { ok: false, why: e.message.slice(0, 300) });
      }
      if (i < todo.length - 1) {
        const wait = 20 + Math.random() * 20; // 20–40 s entre ítems
        console.log(`  esperando ${wait.toFixed(0)}s…`);
        await sleep(wait * 1000);
      }
    }
  } catch (e) {
    if (e instanceof NoSessionError) { console.error(`✗ ${e.message}`); return EXIT.NO_SESSION; }
    if (e instanceof LimitError) { console.error(`✗ ${e.message}`); await debugShot(page, 'limite'); return EXIT.LIMIT; }
    throw e;
  } finally { await ctx.close().catch(() => {}); }
  return fails ? EXIT.FAIL : EXIT.OK;
}

main().then((code) => { process.exitCode = code; }).catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exitCode = EXIT.FAIL;
});
