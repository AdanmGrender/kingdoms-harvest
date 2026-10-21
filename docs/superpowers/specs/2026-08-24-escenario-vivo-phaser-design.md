# Escenario vivo (Phaser) — objetos con animación, no imagen+efecto

> Diseño aprobado 2026-08-24. Sustituye el pase de "juice" CSS (partículas/viñeta
> sobre una imagen fija) por **objetos Phaser reales que se mueven y animan**
> bajo el chrome de React. Se construye en dos fases, commiteadas por separado.

## 0. Motivación

Tras el pase de movimiento CSS, el usuario pidió explícitamente: *"que no sea una
imagen con un efecto, que sean objetos con animaciones"*. El motor Phaser YA anima
todo esto — en `hubMode`, `WorldScene` spawnea NPCs que deambulan (ciclos de
caminar de 4 cuadros, pathing autónomo cada 4–9 s), animales, aldeanos, edificios,
día/noche, partículas y sombras. Ese escenario vivo se había reemplazado por un
`hub_bastion.png` plano para lograr el look painterly. Este trabajo lo devuelve.

## 1. Contrato general

```
ENTRADA:  el jugador entra al hub / a un combate.
SALIDA:   una escena Phaser con entidades que se mueven y animan solas,
          detrás del chrome React (QuestRail/Operaciones/HUD).
INVARIANTES:
  - React no importa clases Phaser; Phaser no importa componentes React.
    Toda comunicación por EventBridge / registry (spec §9).
  - El chrome (TopResourceBar z-30, BottomNavBar, QuestRail, Operaciones) flota
    SOBRE el canvas (que va a zIndex 0).
  - El combate sigue siendo server-authoritative: las animaciones se DISPARAN de
    los resultados de `stepInstance` (state por ronda), nunca deciden el resultado.
  - Sin arte nuevo obligatorio en Fase A (reusa sheets existentes). Fase B puede
    articular el sprite painterly del enemigo por tweens (sin cuadros nuevos).
```

## 2. Fase A — Hub como base viva (primero)

**Componentes:**
- `BastionHub.jsx`: el `flex-1` vuelve a montar `<PhaserGame hubMode />` (se
  quita el div-diorama con drift/ember/flicker). QuestRail arriba + Operaciones
  abajo quedan como overlays React sobre el canvas.
- Fondo painterly: `WorldScene.buildHubAnchor()` usa la textura `hub_bastion`
  (cargada en `BootScene`) en vez de `zone_hub`, con tinte suave (o sin tinte)
  para conservar el look. El piso pintado ya trae los edificios.
- Entidades en hub: se spawnean SÓLO personajes + animales (NPCs/aldeanos/
  gallinas-vaca-oveja) deambulando en la explanada central; los sprites de
  edificio Phaser se OMITEN en hubMode painterly (los edificios ya están pintados
  en el fondo → evitar doble render y desalineación).
- Vida ambiental de motor: emisores de partícula de llama en los braseros del
  fondo (posiciones fijas relativas al ancla), reusando `ParticleSystem`.

**Criterio de aceptación A:**
- El hub muestra ≥3 personajes caminando + animales moviéndose, sobre el fondo
  painterly, con las llamas animadas. Build verde, 0 errores de consola. Cámara
  fija 1.4× (sin drag). QuestRail/Operaciones/HUD siguen encima y funcionales.
- Si el composite pixel-sobre-painterly se ve mal (perspectiva/escala), fallback
  documentado: usar el hub Phaser teselado original (anclas por zona + edificios
  de motor) en vez del fondo painterly. Se decide por captura.

## 3. Fase B — Combate como escenario (después, más grande)

**De barras-sobre-imagen a pelea real:**
- Escena/stage Phaser en el área del `CombatInstancePanel` (canvas detrás del HUD
  de combate React: barras de vida, energía, números flotantes, botones).
- **Enemigo** = el sprite painterly (ya existente) como unidad animada por tweens
  del motor: idle-bob, **embate** (lunge adelante), **retroceso al recibir**
  (knockback + flash), **muerte** (caída + fade). Motion articulado del objeto,
  disparado por los deltas reales del `state` por ronda.
- **Héroes** = 2–3 unidades de personaje (sheets `npc_*`/troops con ciclos) que
  **avanzan y golpean** en su turno y vuelven. Chispa/tajo al conjurar (tap-skill).
- Sync: una capa fina traduce `{ state, roundLog, result }` de `stepInstance` a la
  coreografía de unidades (quién golpea, cuánto daño, quién cae). El HUD (vida/
  energía/floaters/resultado) queda como overlay React encima.

**Criterio de aceptación B:**
- En una ronda, se ve a un héroe avanzar y golpear, al enemigo retroceder con el
  número de daño, y al morir caer/desvanecerse; victoria/derrota con su fanfarria.
  Determinismo del server intacto (los tests de `campaignSim`/`campaignService`
  siguen 100%). Build verde, 0 errores de consola.

## 4. Reuso vs nuevo

- **Reuso:** `WorldScene` hubMode, entidades NPC/Animal/Villager + anims de
  caminar, `ParticleSystem`, `CameraSystem`, carga de assets/anims de `BootScene`,
  la matemática de combate del server, EventBridge/registry.
- **Nuevo:** wiring del fondo painterly en hub; escena/stage de combate + coreografía
  de unidades; capa de sync resultado-server → animación.

## 5. Riesgo conocido — estilo

Los sprites de personaje son pixel nítido 32×48; el fondo es painterly. Se escalan/
sombrean/tiñen para asentarlos en la escena; leerá como "personajes animados sobre
un escenario pintado", no un render unificado. Si un cuadro desentona, se ajusta o
se cae al hub teselado (fallback §2).
