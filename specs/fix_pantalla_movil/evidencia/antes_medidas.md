# T1 — Línea base (antes de tocar código)

Código: HEAD 18a22df (rama feature/fix_pantalla_movil). Vite dev en :5173 con config de preview (sin commitear), proxy → :3101.

## Playwright (5 celulares, hub+shop) — `antes_reporte.json`
Fuente: `D:/Proyectos/_ops/capturas/2026-10-28-02-21_fix24_antes/` (comando `capturar.mjs --url http://localhost:5173 --tag fix24_antes --pantallas hub,shop`).
- hub: nFuera = 0 en los 5; shop: nFuera = 1 en los 5 (scroller `overflow-y-auto px-4 py-3`, bottom 748 con vh 740: 8 px de más).
- errores de consola: 0 en los 5.

## Emulador kh_pixel7 (Chrome Android con barras), medido por CDP (`adb forward 9222`, script medir_emu.mjs)
- innerHeight = 783 (visible), screen = 915, dpr 2.625.
- raíz de la app: rect [0,0,412.2,839.2] → mide 839 (100vh) > 783 visibles (P1 confirmado).
- Héroes (fila inferior): bottom 831.2 (> 783: cortado). P1 = `h-screen` (100vh) vs alto visible.
- canvas: 1 (rect [0,0,412.2,782.9]; BastionHub es `fixed`, sigue el visible).
- ShopPanel: panel [0,184.6,412.2,839.2], scroller bottom 846.3 (> 783).

## Encabezado de ShopPanel (P4)
Medido: header 62.3 px en el emulador (185.4→247.7); en Playwright 360×740 el scroller arranca en y=227 con panel top 163 → header = 64 px. El `calc(78vh - 56px)` asumía 56: sobran 8 px (748 vs 740). Causa = encabezado real ≠ 56, no `vh`.

## Canvas (P5)
- dev (StrictMode, Playwright 412×860 y emulador): 1 canvas.
- build de producción (`vite build` + `vite preview`, :5173): 1 canvas; tras desmontar (`menuDismissed=false`): 0.
- Consola sin errores. El 2º canvas de la línea base (top=844) no se reproduce en esta rama; el guard de R27 queda como cobertura de HMR/StrictMode.
