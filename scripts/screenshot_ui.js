const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2 };
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  ✓ ${name}.png`);
}

async function clickBtn(page, text) {
  return page.evaluate((t) => {
    const el = Array.from(document.querySelectorAll('button')).find(b => b.innerText?.includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

// Open overlay by injecting into Zustand store via window
async function openOverlay(page, type, data = {}) {
  await page.evaluate((t, d) => {
    // Access Zustand store via the global reference we'll expose
    if (window.__gameStore) {
      window.__gameStore.getState().setOverlay(t, d);
    }
  }, type, data);
  await wait(600);
}

async function closeOverlay(page) {
  await page.evaluate(() => {
    if (window.__gameStore) window.__gameStore.getState().clearOverlay();
  });
  await wait(400);
}

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // Expose store globally + mock auth
  await page.evaluateOnNewDocument(() => {
    window.Telegram = {
      WebApp: {
        ready: () => {}, expand: () => {},
        setHeaderColor: () => {}, setBackgroundColor: () => {},
        initData: 'skip=true',
        initDataUnsafe: { user: { id: 123456, first_name: 'Dev', username: 'devuser' }, start_param: null },
      },
    };
    const origFetch = window.fetch;
    window.fetch = (url, opts = {}) => {
      const headers = { ...(opts.headers || {}), 'x-skip-auth': 'true' };
      return origFetch(url, { ...opts, headers });
    };
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
      this.setRequestHeader('x-skip-auth', 'true');
      return origSend.call(this, body);
    };
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3500);

  // Expose the Zustand store to window so we can control it from Puppeteer
  await page.evaluate(() => {
    // The store module is imported in React. We need to find it.
    // Hack: expose it via a custom event from React side.
    // Actually, Vite/React doesn't expose modules globally by default.
    // But we can find the store via the React fiber tree.
    function findStore() {
      // Try to find Zustand store via React fiber
      const root = document.querySelector('#root');
      if (!root) return;
      const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) return;

      let fiber = root[fiberKey];
      while (fiber) {
        if (fiber.memoizedState) {
          let hook = fiber.memoizedState;
          while (hook) {
            if (hook.memoizedState && typeof hook.memoizedState.getState === 'function') {
              const state = hook.memoizedState.getState();
              if (state && typeof state.setOverlay === 'function') {
                window.__gameStore = hook.memoizedState;
                console.log('[puppeteer] Found gameStore!');
                return true;
              }
            }
            hook = hook.next;
          }
        }
        fiber = fiber.child || fiber.sibling || (fiber.return && fiber.return.sibling);
        if (!fiber) break;
      }
      return false;
    }
    findStore();
  });

  // Check if store was found
  const storeFound = await page.evaluate(() => !!window.__gameStore);
  console.log('  Store found:', storeFound);

  // ─── Screenshot 1: Tutorial ───
  await shot(page, '01_tutorial');

  // Skip tutorial
  await clickBtn(page, 'Saltar');
  await wait(600);

  // ─── Screenshot 2: World view clean ───
  await shot(page, '02_world_clean');

  // ─── Screenshot 3: HUD close-up (top bar) ───
  // Crop just the HUD area
  await page.screenshot({
    path: path.join(OUT, '03_hud_bar.png'),
    clip: { x: 0, y: 0, width: 780, height: 80 },
  });
  console.log('  ✓ 03_hud_bar.png');

  // ─── Screenshot 4: Building Toolbar (Granja) ───
  await clickBtn(page, 'Construir');
  await wait(600);
  await shot(page, '04_toolbar_granja');

  // ─── Screenshot 5: Toolbar Defensa tab ───
  await clickBtn(page, 'Defensa');
  await wait(400);
  await shot(page, '05_toolbar_defensa');

  // ─── Screenshot 6: Toolbar Social tab ───
  await clickBtn(page, 'Social');
  await wait(400);
  await shot(page, '06_toolbar_social');

  // Close toolbar
  await clickBtn(page, 'Cerrar');
  await wait(400);

  // ─── Open overlays via store injection ───
  if (storeFound) {
    // Building info overlay
    await openOverlay(page, 'building', { buildingId: 'barn', level: 2, tileIndex: 0 });
    await shot(page, '07_overlay_building');
    await closeOverlay(page);

    // CropSelect overlay
    await openOverlay(page, 'cropSelect', { plotId: 1, plotIndex: 0 });
    await shot(page, '08_overlay_crop_select');
    await closeOverlay(page);

    // Dialog (NPC) overlay
    await openOverlay(page, 'dialog', {
      npcId: 'merchant',
      name: 'Mercader',
      greeting: '¡Bienvenido viajero! Tengo misiones para ti.',
      missions: [
        { id: 1, title: 'Provisiones de Invierno', type: 'urgent', status: 'active',
          requirements: [{ resource_id: 'wheat', amount: 50 }],
          rewards: [{ resource_id: 'gold', amount: 300 }] },
        { id: 2, title: 'Refuerza las Murallas', type: 'normal', status: 'active',
          requirements: [{ resource_id: 'stone', amount: 80 }],
          rewards: [{ resource_id: 'gold', amount: 180 }] },
      ],
    });
    await shot(page, '09_overlay_dialog_npc');
    await closeOverlay(page);

    // Villager overlay
    await openOverlay(page, 'villager', {
      name: 'Juan el Granjero',
      role: 'farmer',
      state: 'working',
      hunger: 75,
      happiness: 60,
      assignedBuilding: 'farm_plot',
    });
    await shot(page, '10_overlay_villager');
    await closeOverlay(page);

    // Animal overlay
    await openOverlay(page, 'animal', {
      animalId: 'chicken', name: 'Pollita', isFed: false,
      productionReady: false, nextProductionAt: null,
    });
    await shot(page, '11_overlay_animal');
    await closeOverlay(page);

    // War/combat overlay
    await openOverlay(page, 'combat', {
      siegeId: 'siege_001', targetName: 'FortressDragon',
      status: 'marching', armySize: 20, abilityId: null,
    });
    await shot(page, '12_overlay_war');
    await closeOverlay(page);

    // Troops management
    await openOverlay(page, 'troops', { mode: 'troops' });
    await shot(page, '13_overlay_troops');

    // Click Train tab
    await clickBtn(page, 'Entrenar');
    await wait(500);
    await shot(page, '14_overlay_troops_train');

    await closeOverlay(page);

    // Harvest overlay
    await openOverlay(page, 'harvest', {
      plotId: 2, cropId: 'carrot', quality: 'good', plotIndex: 1,
    });
    await shot(page, '15_overlay_harvest');
    await closeOverlay(page);
  } else {
    console.log('  ! Store not found, skipping overlay screenshots');
  }

  // ─── Streak banner (inject streakInfo into store) ───
  await page.evaluate(() => {
    if (window.__gameStore) {
      window.__gameStore.setState({ streakInfo: { currentStreak: 14, multiplier: 2.5, nextMilestone: 21 } });
    }
  });
  await wait(1200);
  await shot(page, '16_streak_banner');

  await browser.close();
  console.log('\nDone! Screenshots in scripts/screenshots/');
}

main().catch(e => { console.error(e.message); process.exit(1); });
