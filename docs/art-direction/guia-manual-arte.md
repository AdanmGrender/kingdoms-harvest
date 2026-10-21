# Guía manual: cómo probar otras versiones de íconos e imágenes en KH

Esta guía es para el owner, para probar a mano otras versiones del arte sin pasar por los agentes. Cubre tres casos, de más simple a más completo:
- cambiar un archivo;
- generar uno nuevo con IA;
- cambiar el set completo de íconos.

Todos los comandos se corren **desde la raíz del repo**, en git-bash.

---

## 0. Antes de empezar: probar sin romper nada

Trabaja en una carpeta y una rama aparte, así nada de lo que pruebes toca la rama de @p-kh ni la de los agentes:

```bash
cd D:/Proyectos/kingdoms-harvest
git worktree add ../kingdoms-harvest-wt/prueba-arte -b prueba/arte feat/art-direction-b
cd ../kingdoms-harvest-wt/prueba-arte
(cd client && npm ci) && (cd server && npm ci)
npm ci --ignore-scripts      # raíz: herramientas de arte (sharp). --ignore-scripts evita el error de puppeteer en Windows
```

- **Para levantar el juego:** corre `npm run dev` en la raíz y abre **http://localhost:5173**.
- **Sin Telegram:** pon `SKIP_AUTH=true` en `server/.env`, solo para desarrollo.
- **Si cambiaste una imagen y no la ves:** recarga con **Ctrl+F5**, porque el navegador la guarda en caché.
- **Para deshacer un archivo:** `git restore <ruta>`.
- **Para tirar toda la prueba:**

```bash
git worktree remove ../kingdoms-harvest-wt/prueba-arte && git branch -D prueba/arte
```

---

## 1. Dónde vive cada imagen

| Qué | Archivo(s) | Lo carga |
|---|---|---|
| Objetos de recolección (saco, huevos, leche, lana) | `client/public/assets/b/pickups/<id>.webp` | `client/src/game/hub/hubPickups.js:18` |
| Hub: cielo, base y primer plano | `client/public/assets/b/hub/{sky_calm,sky_storm,base,fg}.webp` | `client/src/game/hub/hubLayout.js:109-112` |
| Edificios del hub | `client/public/assets/b/buildings/<id>.webp` | `hubLayout.js:113` |
| Trabajadores del hub | `client/public/assets/b/workers/<tipo>_<pose>.webp` | `hubLayout.js:115` |
| Héroes y enemigos B (combate de perfil) | `client/public/assets/b/{heroes,enemies}/*.webp`, fondos en `assets/b/bg/` | escena de combate B |
| Piezas de interfaz (marco, botones, anillo de retrato) | `client/public/assets/b/ui/*.webp` | componentes de `ui_kit_b` (etapa B) |
| **Íconos de la interfaz** (recursos, menús, etc.) | una sola hoja: `client/public/assets/sprites/grim_icons.png` + su mapa `client/src/config/grimIconSheet.generated.js` | `client/src/utils/spriteMap.js:258` (`SpriteIcon`) |
| Retratos y enemigos de los paneles React (arte viejo) | `client/public/assets/game/{heroes,enemies}/<id>.png` | `HeroPanel.jsx:51`, `CombatInstancePanel.jsx:138`, `WaveDefensePanel.jsx:129` |
| Fuentes crudas de la IA (no se sirven) | `art-b/**/raw/*.png` (ignoradas por git) | — |

> Cuando `ui_kit_b` llegue a la etapa C, la hoja de íconos pasa a `client/public/assets/b/ui/icons.webp`, con celdas de 192 px. El mapa sigue en `grimIconSheet.generated.js`. Ver `specs/ui_kit_b/design.md` §8.

**Regla general:** si respetas **la misma ruta, el mismo nombre y el mismo formato**, no tocas código. El juego no sabe que la imagen cambió.

---

## 2. Opción A: cambiar una imagen a mano (sin IA, sin código)

1. Prepara la imagen nueva:
   - **WebP con transparencia** para objetos, personajes, edificios e íconos;
   - **WebP opaco** para cielos y fondos;
   - un tamaño parecido al original, que puedes ver con `file` o abriéndolo.
2. Guarda las versiones fuera del repo para poder ir y volver. Por ejemplo, en `D:\Proyectos\_arte-pruebas\pickups\v2\sack.webp`.
3. Copia encima del archivo del juego:

```bash
cp /d/Proyectos/_arte-pruebas/pickups/v2/sack.webp client/public/assets/b/pickups/sack.webp
```

4. Recarga con Ctrl+F5.

**Para alternar entre varios sets** (v1, v2, v3…), usa un mini script:

```bash
# uso: bash probar.sh v2
V=$1; cp /d/Proyectos/_arte-pruebas/pickups/$V/*.webp client/public/assets/b/pickups/ && echo "pickups -> $V"
```

**Si tu imagen es PNG con fondo liso**, el script del repo le quita el fondo y la convierte:

```bash
node scripts/process_art_b.js mi_saco.png client/public/assets/b/pickups/sack.webp --height 256
```

Opciones útiles de `process_art_b.js`:

| Opción | Qué hace |
|---|---|
| `--height N` / `--width N` | Escala la imagen. |
| `--scene` | No quita el fondo; es para cielos y escenas. |
| `--crop x,y,w,h` | Recorta una pieza de una hoja. |
| `--tol N` | Tolerancia del recorte de fondo. Súbela si quedan restos del fondo y bájala si se come el objeto. |
| `--flip` | Espeja la imagen. |
| `--pad N` | Margen alrededor del objeto. |

---

## 3. Opción B: generar una versión nueva con IA

- **Requisito:** tener `GEMINI_API_KEY` en `server/.env`.
- **Costo:** unos **0,14 USD por imagen** con el modelo por defecto (`gemini-3-pro-image`, a 2K).
- **Generador:** `scripts/gen_art_b.js` antepone siempre el bloque de estilo B (grabado gótico). Con eso, tu prompt solo describe **el objeto**.

**Una imagen suelta:**

```bash
node scripts/gen_art_b.js --kind prop --aspect 1:1 \
  --prompt "a wicker basket full of brown eggs" \
  --out art-b/pickups/raw/egg_basket_v2.png
node scripts/process_art_b.js art-b/pickups/raw/egg_basket_v2.png client/public/assets/b/pickups/egg_basket.webp --height 256
```

**Tipos (`--kind`):**

| Tipo | Para qué |
|---|---|
| `prop` | Un solo objeto centrado, sin suelo: íconos y objetos. |
| `actor` | Personajes, sobre fondo claro para recortar. |
| `scene` | Fondos completos, sin personajes. Después se procesa con `--scene`. |
| `ui` | Hoja de piezas de interfaz. |

**Otras opciones:**
- `--ref ruta.png`: imagen de referencia de estilo. Por ejemplo, `--ref art-b/gr/refs/anchor.webp` para que combine con el combate.
- `--model <id>`: otro modelo de imagen de Gemini, en vez del de por defecto.
- `--size 1K`: más barato y con menos detalle.

**Varias de una vez, con manifiesto:** cada carpeta de `art-b/` tiene un `manifest.json`, que es una lista de `{ id, kind, aspect, prompt, refs?, out? }`:

```bash
node scripts/gen_art_b.js --manifest art-b/pickups/manifest.json --only sack,wool_bale --force
```

- `--only` regenera solo esos ids.
- `--force` pisa los crudos que ya existen.

Después de generar, procésalos como en la opción A. Para el hub está `art-b/process.sh`, que reprocesa todo de una vez.

**Probar varios modelos o estilos del mismo objeto:** genera con nombres distintos (`sack_proA.png`, `sack_flash.png`…), procésalos a `D:\Proyectos\_arte-pruebas\pickups\<variante>\` y alterna con el script de la opción A.

---

## 4. Opción C: otro set completo de íconos de interfaz

Los íconos de la interfaz no son archivos sueltos. Son **una hoja en grilla** más un mapa `nombre → {col, row}`. Para cambiar el set:

1. Pon un PNG por ícono en `art-inbox/icon_<nombre>.png`:
   - fondo liso;
   - un objeto por ícono;
   - los nombres son los de la lista de `scripts/assemble_icon_sheet.js`: `gold`, `wood`, `stone`, `iron`, `wheat`, etc.

   Si falta alguno, el script avisa y ese ícono sigue saliendo del set viejo.
2. Para generarlos con IA:
   - `bash scripts/gen_icons.sh` genera los 54;
   - `bash scripts/gen_icons.sh gold flame` genera solo esos dos.

   Usa el estilo viejo "grimdark". Para el estilo B, conviene `gen_art_b.js --kind prop` con la salida en `art-inbox/icon_<nombre>.png`.
3. Arma la hoja: `node scripts/assemble_icon_sheet.js`. Escribe `grim_icons.png` y regenera `grimIconSheet.generated.js`. **Ese archivo no se edita a mano.**
4. Recarga con Ctrl+F5. Todo lo que use `SpriteIcon` pasa al set nuevo.

**Para alternar entre sets:** copia `art-inbox/icon_*.png` de cada set a `D:\Proyectos\_arte-pruebas\iconos\<set>\`. Para cambiar de set, cópialo de vuelta a `art-inbox/` y vuelve a correr el paso 3.

---

## 5. Agregar una imagen nueva (no reemplazar): esto sí toca código

Una imagen nueva necesita que alguien la cargue:
- **Phaser (hub y combate):** agrega `{ key, url }` a la lista de texturas correspondiente. Por ejemplo, `PICKUP_TEXTURES` en `hubPickups.js`, o las listas de `hubLayout.js:109-115`. Después úsala con `this.add.image(x, y, key)`.
- **React:** agrega `<img src="/assets/b/...">`. Si es un ícono, agrégalo a la hoja (opción C) y usa `<SpriteIcon id="nombre" />`.

Si quieres que quede en el juego, pídelo como feature: así pasa por spec, la aprobación de arte de @p-kh y los tests.

---

## 6. Checklist rápido de calidad (las reglas de @p-kh)

- [ ] Un solo objeto por ícono, sin texto, sin marco dibujado y sin suelo.
- [ ] Fondo **transparente** de verdad (las esquinas con alpha 0). Pruébalo así:
  ```bash
  node -e "require('sharp')(process.argv[1]).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>{const a=(x,y)=>data[(y*info.width+x)*4+3];console.log([a(0,0),a(info.width-1,0),a(0,info.height-1),a(info.width-1,info.height-1)])})" client/public/assets/b/pickups/sack.webp
  ```
  Tiene que imprimir `[0,0,0,0]`.
- [ ] Objetos oscuros con el borde iluminado, para que se lean sobre el hub.
- [ ] Verde **solo** para magia o corrupción (la Mácula), nunca en objetos comunes.
- [ ] Se ve bien en el celular: viewport 412×860.

Referencias: `docs/art-direction/ui-kit-b.md` (§6.1 íconos, §7 puerta de arte) y `docs/art-direction-b.md`.
