# Comparación antes / después — pantallas_b

Fuente: `antes/reporte.json` (capturar.mjs, @1395f33) y `despues/reporte.json` (`D:/Proyectos/_ops/capturas/medir_pantallas_b.mjs --url http://localhost:5173`, una corrida por dispositivo por el rate-limit de 60 s del server). 3 dispositivos × 8 pantallas = 24 webp ≤1080 px q70 + reporte. `errores: []` en los 3 dispositivos (sin 429 ni errores de consola).

| Req | Medición «después» | Resultado |
|---|---|---|
| R4 bbox dentro del frame | `raices[].dentroDelFrame` = true en heroes, missions, tech, settings, system, galaxy; `nFueraDelFrame` = 0 en las 24 capturas. Frames: 360×740 `[0,0,360,740]`, 360×800 `[0,22,360,778]`, 412×915 `[0,24.9,412,890.1]` (bandas por aspecto > 2.1 intactas). Antes: `nFuera` = 0 también (línea base ya limpia). | OK |
| R14 área táctil ≥ 44 | `botonesBajo44` = [] en menu, heroes, missions, tech, settings, system, galaxy (3 dispositivos). Corregidos en esta feature: slider de volumen (18→44 px) y nodos de `StarMap` (`minWidth/minHeight` 44). **Excepción**: `operations` tiene el botón `✕` de 35.6×32 en `OperationsMap`, fuera de alcance (design.md §1: «OperationsMap … ola siguiente», Q4). | OK en alcance; 1 excepción documentada |
| R34 contraste sobre capa de mapa | Sin imagen de fondo (T11 no ejecutada, ver abajo) el mapa es `oak` plano: bone-dim/oak 5.83, gray-500/oak 3.27 (solo decorativo) según el cálculo del spec; con imagen la capa oscura es rgba(20,17,13,.78). No se pudo medir contraste con imagen real. | Parcial (fallback R33) |
| R41 alto pestaña «Arte de la Guerra» | 73.2 px de alto, 92 px (360) / 109.3 px (412) de ancho, 2 líneas de texto, fuente 13 px, `scrollHeight` 69 = `clientHeight` 69 (sin desborde). | OK |
| R48 | 24 capturas en `despues/` comparables 1:1 con `antes/` (mismo nombre `<disp>__<pantalla>.webp`). | OK |

No cubiertos por captura (sin mocks en capturar.mjs): ResultBanner de combate/guerra/territorio → tests de render de T8.
