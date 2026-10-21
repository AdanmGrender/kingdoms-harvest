# Dirección de arte — Kit de UI e íconos B (`ui_kit_b`, B3)

> Criterio visual que el `spec_author` toma como **entrada obligatoria** para
> `specs/ui_kit_b/`. Lo decide la dirección de arte (p-kh) con el owner; si el
> spec necesita apartarse de algo de acá, lo marca como pregunta abierta en
> `design.md`, no lo decide solo. Contrato general: `docs/art-direction-b.md`.
> Fecha: 2026-10-21.

## 1. Qué problema resuelve

El hub ya es una ilustración grabada a resolución de dispositivo
(`hub_b_escena`), pero el chrome React encima sigue en el lenguaje viejo:
cuadritos de piedra con íconos del set `grim_icons.png` (isométricos, brillos
**verde-azulados de ciencia ficción**, engranajes) y **211 emojis distintos en
854 usos** (`client/src` + `shared/`). Es lo que más desentona hoy.

## 2. Alcance

- **Entra:** todo el chrome React — barra de recursos (`TopResourceBar`), rieles
  laterales (`QuickActionsSidebar`, `EventSidebar`, `SocialSidebar`),
  `BottomNavBar`, paneles/overlays, popups (`BuildingInfoPopup`), modales,
  notificaciones, botones; tipografía global; set de íconos.
- **No entra:** escenas Phaser (hub y combate ya tienen su arte), retratos de
  héroes (B2/B4), íconos de enemigos (no hay sprites B salvo el bruto → se
  difieren a `combate_b`), key art del menú (B4).
- **Sin cambios de lógica**: es piel. Ningún componente cambia qué datos muestra
  ni qué llama.

## 3. Materiales y paleta (tokens)

Materiales: **roble oscuro, latón deslucido, hierro remachado, pergamino,
lacre**. Nada de gradientes "candy", vidrio, neón ni brillo azul/cian.

| Token | Hex | Uso |
|---|---|---|
| `kh-ink` | `#14110d` | fondo base, sombras |
| `kh-oak` | `#2a2119` | masa de paneles y botones |
| `kh-oak-light` | `#3d3024` | estados hover/pressed, separadores |
| `kh-iron` | `#4a4a48` | remaches, bordes secundarios, deshabilitado |
| `kh-brass` | `#b08d57` | bordes principales, filetes, íconos de acción |
| `kh-brass-light` | `#d9b77a` | foco, selección, número destacado |
| `kh-bone` | `#e6dcc3` | texto sobre oscuro |
| `kh-bone-dim` | `#a89c84` | texto secundario |
| `kh-parchment` | `#d8c8a0` | interior de paneles de lectura (reporte, tratados) |
| `kh-parchment-ink` | `#2b1f14` | texto sobre pergamino |
| `kh-seal` | `#7a1f1a` | acción principal (lacre), error, peligro |
| `kh-ember` | `#e07b2a` | progreso, tiempo, Ascua de Faro |
| `kh-macula` | `#8fae3a` | **solo** magia/corrupción/Marea de la Mácula — nunca "éxito" |

Éxito/confirmación se comunica con latón claro + texto, no con verde.
Contraste mínimo texto/fondo: 4.5:1 (bone sobre oak ≈ 11:1, ok).

## 4. Tipografía

- **IM Fell English** (cuerpo) e **IM Fell English SC** (títulos, botones,
  pestañas), empaquetadas en `client/public/fonts/` (la CSP bloquea Google
  Fonts y la APK va offline).
- Retirar del chrome Cinzel y Alegreya Sans (restos de iteraciones previas).
- **Riesgo a verificar en el spec:** los dígitos de IM Fell son "old-style" y
  pueden leerse mal en contadores chicos (13-14 px). Prueba obligatoria con la
  barra de recursos a 412 px; si no se leen, **solo los números** usan
  Alegreya Sans SC 700 (ya empaquetada) y se documenta la excepción.
- Tamaños base: cuerpo 15 px, secundario 13 px, títulos de panel 20 px SC,
  botones 16 px SC. Nada por debajo de 12 px.

## 5. Componentes

Piezas ya generadas y aprobables en `client/public/assets/b/ui/`
(`panel_frame`, `btn_red`, `btn_stone`, `bar_frame`, `portrait_ring`): se
reusan como **9-slice** (`border-image`) — no se regeneran salvo que el
9-slice muestre costuras.

| Componente | Material | Notas |
|---|---|---|
| `Panel` | roble + filete latón + remaches en esquinas; variante `parchment` para lectura | sombra `kh-ink`, sin blur de fondo |
| `Button` primario | lacre (`btn_red`) | uno solo por pantalla |
| `Button` secundario | roble/piedra (`btn_stone`) | |
| `Button` ícono (rieles) | disco/escudete de hierro con ícono B, etiqueta SC debajo | reemplaza los cuadritos actuales |
| `Bar` | `bar_frame` con relleno por color de token (ember=progreso, seal=vida, macula=corrupción) | |
| `PortraitRing` | `portrait_ring` con máscara CSS (el centro es opaco) | |

Estados: hover/pressed = oscurecer masa + latón claro en el borde;
deshabilitado = desaturar 60 % + `kh-iron`. Tap target mínimo 44×44 CSS px.

## 6. Íconos

### 6.1 Estilo — decidido con prueba

Se generaron dos hojas de prueba de 9 íconos (`art-b/uikit/manifest.json`):
**A grabado detallado** y **B grabado simplificado**. Ver
`docs/art-direction/ui-kit-b-hoja-a.webp`, `ui-kit-b-hoja-b.webp` y la prueba
de legibilidad a 24/32/48 px sobre el chrome oscuro
`docs/art-direction/ui-kit-b-prueba-iconos.webp`.

**Decisión: estilo B (simplificado)** — contorno negro grueso, masas de color
planas, pocos trazos de rayado, objeto llenando ~80 % de la celda, vista ¾ leve,
luz desde arriba a la izquierda. Lee mejor a 24-32 px y conserva el grabado.

Reglas que salieron de la prueba:

1. **Un objeto por ícono.** Los pares cruzados (martillo+llana, llave+pluma)
   se rompen a 24 px. Construir = un martillo; Ajustes = una llave.
2. **Sin halos ni brillos horneados.** La Ascua de Faro salió con un halo claro
   que el recorte deja como aro pálido. El brillo se hace en CSS
   (`drop-shadow` con `kh-ember`), no en el arte.
3. **Objetos oscuros con canto iluminado.** El lingote de hierro desaparece
   sobre roble oscuro: todo objeto oscuro lleva un filo de luz cálida
   (hueso/latón) en el borde superior.
4. **Sin verde de la Mácula en objetos comunes** (la variante B metió motas
   verdes en el hierro: se pide explícitamente que no).
5. Sin texto, letras, números, marcos ni círculos de fondo en el arte.
6. **Tamaño mínimo de uso: 28 CSS px.** Por debajo, solo texto.

### 6.2 El token KH es único

KH es dinero real: su ícono es el **sello-medallón de bronce con gavilla y
corona y gota de lacre** de la prueba. No se reusa para nada más, no aparece en
decoración y ningún otro recurso puede parecérsele. Las Coronas (oro común) son
la pila de monedas.

### 6.3 Inventario y fuentes

El contrato existente es `client/src/config/grimIconSheet.generated.js`
(65 nombres → celda) leído por `spriteMap` → `SpriteIcon` (26 archivos lo
usan). **Se reemplaza la hoja manteniendo los nombres**: así todos los usos
existentes cambian de una sin tocar componentes.

| Grupo | Nombres | Fuente |
|---|---|---|
| Recursos/monedas | gold, wood, stone, iron, wheat, water, bread, kh_token, crystal, relic, blueprint, gem, star_currency | **generar** (prioridad 1) |
| Cultivos y animales | carrot, potato, tomato, corn, pumpkin, grape, egg, milk, wool, chicken, sheep, cow | generar (prioridad 2) |
| Edificios | castle, farmhouse, market, tower, barracks, tavern, mill, wall, trap, stable, sawmill, barn | **recortar** de `assets/b/buildings/*.webp` (ya son B; no generar) |
| Armas/tropas | sword, bow, spear, ram, horse | generar (prioridad 2) |
| Acciones/UI | crown, scroll, medal, backpack, reward_bag, exclamation, gear→**llave**, caravan, flame, wallet, map, heart, star, check, speedup, tide, skull | generar (prioridad 1) |
| Enemigos | enemy_* (6) | **diferido** a `combate_b`; mientras tanto se mantiene el set viejo |

Además, íconos de los rieles/nav que hoy son emoji: Bastión, Marea de la
Mácula, Misiones, Construir, Marca, Ajustes, Logros, Alianza, Rankings,
Mercado, Tratados (Tech), Mundo — mapear a nombres del set (agregar los que
falten, p. ej. `alliance` = estandarte, `rankings` = laurel, `quests` = pergamino
lacrado).

**Emojis restantes** (cientos de usos en paneles secundarios): el spec define
una tabla emoji → nombre del set para los frecuentes (⚔ 🪙 🌾 💎 💰 🛡 🪵 ⛏ 📦 ⭐ 💀 🪨 …) y
**quita** el resto (texto solo). El criterio "cero emojis como íconos" se
verifica con un test que busca `\p{Extended_Pictographic}` en
`client/src/components` (con lista blanca justificada si la hay, p. ej. textos
de chat de jugadores).

### 6.4 Producción

- Hojas **1:1 de 3×3** (9 íconos por llamada) con la plantilla de prompt de la
  hoja B (`art-b/uikit/manifest.json`, `icon_test_b_bold`) + las reglas 6.1;
  fondo gris plano, recorte por grilla + llave de color.
- ≈ 50 íconos a generar → 6 hojas + ~30 % de regeneración ≈ 8 llamadas ≈
  **1,1 USD**. Edificios recortados: 0 USD.
- Celda final **192 px webp** (48 CSS px × DPR 3 sin reescalar hacia arriba);
  hoja nueva `client/public/assets/b/ui/icons.webp` + regenerar
  `grimIconSheet.generated.js` con `scripts/assemble_icon_sheet.js`.
- Las dos hojas de prueba ya generadas se pueden aprovechar (coins, wheat, wood,
  stone, kh_token, crystal) si pasan la revisión con las reglas 6.1.

## 7. Revisión de arte (criterio de aceptación visual)

La dirección de arte (p-kh) revisa y aprueba antes de integrar:

1. Hoja de contacto de **todos** los íconos a 24, 32 y 48 px sobre `kh-oak`,
   en `specs/ui_kit_b/evidencia/`.
2. Cada ícono se reconoce a 32 px sin etiqueta; ninguno tiene halo, texto ni
   verde de la Mácula indebido; luz consistente desde arriba-izquierda.
3. Capturas Playwright 412×860 @2x del hub y de 4 paneles (construir,
   héroes, mercado, ajustes) antes/después.
4. Barra de recursos legible a 412 px (números incluidos).

## 8. Qué NO hacer

- Mezclar íconos del set viejo y del nuevo en una misma barra o panel.
- Brillos verde-azulados, engranajes, metal pulido o cualquier resto sci-fi.
- Emojis como ícono, aunque sea "mientras tanto".
- Íconos dentro de círculos/medallones horneados (el marco lo pone el
  componente).
- Nombres, símbolos o heráldica de franquicias ajenas en prompts o arte.
