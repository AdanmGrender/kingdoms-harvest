# Dirección de arte B — ilustración gótica de perfil — Diseño

> **Fecha:** 2026-10-16 · **Estado:** spike validado (`spikes/001-combat-b`),
> pendiente de aprobación del owner sobre el *look* antes de producir en masa.
> **Reemplaza** la dirección "diorama iso pixel-painterly"
> (`2026-07-27-coordinacion-visual-diorama.md`).

## 0. Por qué

Revisión estética (2026-10-16): el juego se veía amateur por **mezcla de
familias de arte** (dioramas IA + sprites pixel de 16 px + tiles Kenney +
emojis), un fondo cuadrado recortado en vertical, todo oscuro sobre oscuro,
UI de "página web" y la fuente medieval bloqueada por la CSP. El motor no era
la causa. El spike demostró que con **un único estilo ilustrado coherente,
composición vertical y efectos de Phaser** el salto es grande sin cambiar de
motor.

## 1. Contrato visual (todo asset lo cumple)

> **Revisado 2026-10-16 (owner):** el estilo pasa de "tinta gótica limpia" a
> **grimdark renacentista** — fantasía oscura de escala heroica, estética del
> Renacimiento alemán (landsknechte, pólvora primitiva + magia caprichosa),
> mugre y decadencia, maximalismo grotesco con humor negro. Inspiración de
> RASGOS de la fantasía de mesa clásica; **cero IP de terceros** (ni nombres de
> facciones, ni símbolos, ni nombres de ilustradores en los prompts).

| Eje | Valor |
|-----|-------|
| Técnica | ilustración entintada tipo grabado/xilografía del s. XVI: línea tosca, trama cruzada en sombras, aguadas de tinta oscura. **No** pixel art, **no** 3D, **no** fantasía limpia/anime |
| Proporciones | **escala heroica**: cabeza, manos, armas y hombreras sobredimensionadas; siluetas macizas y legibles de lejos |
| Paleta | tierras: umbra, sepia, ocre, óxido, hueso, latón deslucido, carmesí de sangre seca; acentos raros de **verde enfermizo** (magia/corrupción) y naranja vela |
| Mundo | Renacimiento alemán: calzas bombachas acuchilladas, sombreros de ala con plumas absurdas, morriones, corazas abolladas, arcabuces, montantes; pueblos de entramado de madera derrumbándose, horcas, jaulas, santuarios quemados, barro |
| Tono | todo gastado y al borde del colapso: calaveras, pinchos, cadenas, pergaminos de oración, amuletos lacrados, vendas; toques grotescos y cómicos (botín ridículo, bigotes imposibles) |
| Vista | ¾: héroes miran a la **derecha**, enemigos a la **izquierda** |
| Poses | héroes: **hoja de pose** (idle izq. + ataque der. en UNA imagen 16:9) → coherencia alta; enemigos: idle + hit |
| Fondos | verticales 9:16, piso abierto en la mitad inferior |
| UI | roble oscuro, latón deslucido, hierro con remaches, pergamino, lacre; tipografía **IM Fell English / SC** (imprenta antigua, OFL); cero emojis |
| Anclas | `art-b/gr/refs/anchor.webp` (Ulrich, el doble sueldo) para estilo; `mage_idle.webp` como ref de estilo cuando el ancla "contagia" su montante |

Herramientas: `scripts/gen_art_b.js` (estilo `grimdark` por defecto; `ink`
conserva el estilo anterior), `scripts/process_art_b.js` (`--crop`, `--erase`,
`--flip`, `--fade-right`), `art-b/gr/manifest.json` + `art-b/gr/process.sh`.
Revisión humana obligatoria de cada asset antes de integrarlo.

## 2. Principio rector: es un IDLE (owner, 2026-10-16)

Fuera del combate el juego es un **idle**: el Bastión produce solo (también
offline, tope 12 h), y el ritual de cada sesión es *volver → leer el reporte
del Escribano → recoger → gastar en edificios/héroes → correr 1-2 combates →
irse*. Consecuencias para el arte:

1. **La pantalla que más se mira es el hub**, no el combate. Se ve decenas de
   veces por día, unos segundos cada vez → tiene que leerse de un vistazo y
   verse *vivo* aunque el jugador no toque nada.
2. **El arte tiene que MOSTRAR la producción**: cada edificio con su
   trabajador animado (molinero, herrero, leñador), humo en las chimeneas, y
   lo listo para recoger como **objeto en la escena** (saco de trigo, pila de
   leña, lingotes, bolsa de coronas) que se toca y vuela al contador — no un
   punto rojo.
3. **El progreso se ve**: cada edificio tiene 3 aspectos por tramo de nivel
   (choza → casa → casona con estandarte). Subir de nivel cambia el dibujo.
4. **El estado del mundo se ve en la escena**: tormenta activa = niebla /
   lluvia de ascuas / cielo carmesí sobre el hub; el Fuego Votivo de la torre
   arde más o menos según la salud del Bastión; día/noche.
5. **Volver tiene premio visual**: el reporte offline es el **libro de cuentas
   del Escribano** (pergamino que se desenrolla, monedas que caen), con la
   frase de humor negro del día.
6. **Barato de animar**: todo con el mismo truco del spike (2 poses + tweens +
   partículas), nada de animación cuadro a cuadro. Las animaciones del hub
   son loops largos y suaves (es una pantalla de estar, no de acción).

## 3. Fases (reordenadas: idle primero)

### B1 — Hub idle vivo (primero; es lo que más se ve)
- Ilustración **vertical por capas**: cielo (cambia con tormenta/hora) →
  colina y muralla → **ranuras de edificio** donde se apoyan sprites
  independientes → primer plano (barro, cerca, cuervos).
- 15 edificios × 3 tramos de nivel = 45 sprites · ~8 trabajadores × 2 poses ·
  ~8 íconos-objeto de recolección · 1 fondo base + variantes de cielo.
- Recolección en escena (tap al objeto → vuela al contador) y reporte offline
  "libro del Escribano".
- Server sin cambios: la escena **lee** producción/tope/listo-para-recoger de
  los endpoints actuales.

### B2 — Combate en producción
- Port del spike a `CombatScene`; reproduce `stepInstance`, no decide nada.
- Escuadra de hasta 5 en dos filas; oleadas en grupo escalonado.
- 18 héroes (hoja de pose) · 8 enemigos × {idle, hit} · 6 fondos.
- Calidad en 3 niveles (bloom/partículas) para gama baja.

### B3 — Kit de UI e íconos en todo el chrome React
- IM Fell English en todo el juego; tokens Tailwind; componentes `Panel`,
  `Button`, `PortraitRing`, `Bar`; ~40 íconos ilustrados (cero emojis).

### B4 — Resto de pantallas
- Menú con key art, roster de héroes, mapa de la Marca y de los Reinos
  Caídos ilustrados, pantallas de victoria/recompensa.

## 4. Opción C (cambio de motor) — compuerta

**Descartada por ahora.** Se re-evalúa al cerrar B1+B3 sólo si aparece una
necesidad que Phaser 3 no cubre bien: animación esquelética a gran escala
(primero probar el plugin oficial de Spine para Phaser), 3D, o rendimiento
insuficiente en el dispositivo objetivo medido de verdad. Phaser 4 (estable
desde abril 2026) es una migración de renderer; se considera recién después
de B4.

## 5. Costos y riesgos

- Arte estimado B1–B4: ~120 imágenes (el hub por capas suma ~45 sprites de edificios) + ~30% de regeneraciones ≈ 100 llamadas
  ≈ 13–15 USD (tarifa pública de Gemini 3 Pro Image 2K).
- Riesgo: deriva de estilo entre tandas → siempre `--ref` al ancla y
  revisar en hojas de contacto sobre fondo oscuro.
- Riesgo: restos de la referencia/poses casi iguales → regenerar
  (≈1 de cada 4 en el spike).
- Riesgo: peso del APK → todo en webp, fondos ≤ 1080 px de ancho; capas del hub hasta 1536 px (render a DPR 3,
  ver `specs/hub_b_escena/design.md` §8.4), héroes 640 px de alto (~50 KB c/u).

## 6. Criterios de aceptación de B2 (combate)

- Un combate real de campaña (`a1n1`…) se juega entero con la nueva escena,
  con el arte B de los héroes de la escuadra y del enemigo del nodo.
- Ningún asset del pipeline viejo visible en combate.
- Tests del cliente y del server pasan; sin errores de consola.
- ≥ 50 fps en el emulador `vault` con el nivel de calidad medio.

## 7. Criterios de aceptación de B1 (hub idle)

- Al volver tras ≥1 h, el reporte del Escribano muestra lo producido y los
  objetos aparecen en la escena; tocarlos los recoge (mismo endpoint actual).
- Cada edificio construido se ve con el sprite de su tramo de nivel; los
  trabajadores animan sin input del jugador.
- Una tormenta activa cambia el cielo/ambiente del hub.
- Lore v2 en todos los textos visibles (`docs/lore.md`, `docs/lore-glosario.md`).

## 8. Generar por la web (sin crédito API)

Cuando `gen_art_b.js` termina con **HTTP 402/429** (sin crédito o cuota), imprime el
comando equivalente de `scripts/gen_art_web.js`. **No hay fallback automático**:
lo decide quien corre el pipeline. El script usa la web gratuita
gemini.google.com con la sesión de Google del owner, en una ventana de Edge visible.

**Requisitos.** Edge instalado, `playwright` y `sharp`. En un worktree sin
`node_modules`, el script usa solo el del repo principal; si no lo encuentra:
`NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules`.

**Login (una vez).**

```bash
node scripts/gen_art_web.js --login
```

Abre gemini.google.com; el owner inicia sesión en esa ventana (hasta 10 min). El
script detecta el avatar de la cuenta y cierra. La sesión queda en el perfil de
Edge `D:/Proyectos/_ops/gemini-web-profile` (env `GEMINI_WEB_PROFILE`), **fuera del
repo** (`gemini-web-profile/` está en `.gitignore` por si acaso). El script no
imprime cookies ni guarda credenciales. Sin sesión, sale con código 3 y
«sesión no iniciada: correr --login».

**Uso.** Mismo CLI que `gen_art_b.js` y mismo texto de prompt:

```bash
node scripts/gen_art_web.js --manifest art-b/<lote>/manifest.json [--only a,b] [--force]
node scripts/gen_art_web.js --prompt "..." --out art-b/raw/x.png --aspect 9:16 [--kind prop] [--ref a.png]
```

Por cada ítem: chat nuevo → «Cargas y herramientas» → «Crear imagen» → relación de
aspecto → sube **solo la primera ref** (con «Edit the attached image.» delante) →
espera la imagen (hasta 120 s) → descarga a tamaño completo y la normaliza a PNG en
`out` → agrega una línea `{"item", "via":"web", ...}` a `run_log.jsonl` (junto a los
crudos). Cierra la ventana al terminar. Salta lo que ya existe (salvo `--force`).

**Límites.**
- Solo 1:1, 3:4, 4:3, 9:16 y 16:9; con otro aspecto usa el más cercano.
- Solo la primera ref; sin 2K garantizado (el tamaño lo decide la web).
- Pausa de 20–40 s aleatoria entre ítems. Si Gemini muestra un límite diario, el
  script corta con código 4 y un mensaje claro: reintentar más tarde.
- La UI de Gemini cambia: los selectores están en el objeto `SEL` al tope del
  script. Ante un fallo guarda una captura en `D:/Proyectos/_ops/gemini-web-debug/`.
- No correr dos instancias a la vez (el perfil de Edge se bloquea).

**Aviso de estilo.** Es **otro modelo** que `gemini-3-pro-image` de la API: el
estilo puede variar (línea, paleta, deriva). **La puerta de arte de p-kh sigue
siendo obligatoria** para todo lo generado por la web.
