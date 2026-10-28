# Design — `reporte_escribano` (feature 6, B1.4)

Base: `feat/art-direction-b`, rama `feature/reporte_escribano`. Apoyado en `docs/architecture.md` (cliente = vista; solo los services escriben DB), `docs/conventions.md` y `specs/ui_kit_b/design.md` §Panel. Verificado leyendo `idleService.js:116-212`, `OfflineReportModal.jsx` (103 líneas), `Panel.jsx`, `Button.jsx`, `noEmoji.test.js`.

## 1. Archivos

| Archivo | Cambio |
|---|---|
| `server/src/services/idleService.js` | **Solo añadir**: helper `_capacitiesFor(playerId)` y el campo `storage` en el `return` de `buildOfflineReport` (R1–R5). |
| `server/tests/idleServiceStorage.test.js` | **Nuevo**. No se toca `idleService.test.js` (R6). |
| `client/src/config/escribanoLines.js` | **Nuevo**: catálogo, cubos, `pickEscribanoLine`. Junto a `heroLore.js` (narrativa en `config/`, sin balance). |
| `client/src/components/overlay/OfflineReportModal.jsx` | Rediseño sobre `Panel parchment` + `Button`; exporta además `formatAway` (R15–R30). |
| `client/src/tests/escribanoLines.test.js`, `client/src/tests/OfflineReportModal.test.jsx` | **Nuevos**. |
| `scripts/reporte_escribano_evidence.js` | **Nuevo**: Playwright 412×860 @2x; intercepta `POST /api/player/init` con `page.route` para inyectar `offlineReport` (patrón de `scripts/hub_b_tramos_evidence.js`). |
| `specs/reporte_escribano/evidencia/` | Capturas webp y salida de consola. |

No se tocan `App.jsx`, `gameStore.js`, `playerService.js`, `shared/`, migraciones ni `client/public` (R31, R32). `playerService.js:108-114` ya pega el reporte entero al perfil, así que `storage` viaja sin cambios.

## 2. Servidor: `storage` (R1–R5)

El tope hoy actúa en silencio (`MIN(amount + ?, capacity)`, `idleService.js:144-147`) y el reporte no lo expone. Se añade un campo, sin tocar los existentes:

```js
// reporte.storage — { [resourceId]: { amount, capacity } }
//   amount   = player_resources.amount tras el catch-up (== `after` en buildOfflineReport)
//   capacity = player_resources.capacity
// Entran los recursos de `resources` (delta > 0) y los llenos (amount >= capacity).
async _capacitiesFor(playerId)   // -> { [resourceId]: number }, de player_resources
```

Orden dentro de `buildOfflineReport`: después de `const after = await this._snapshotNow(playerId)` y del cálculo de `resources`; se consulta `_capacitiesFor` una vez; `storage` se arma con `afterRes` y las capacidades. El cálculo de `hasContent` (`:201`) **no cambia** y no mira `storage` (R4): un granero lleno sin nada más sigue sin generar modal. El `return` (`:204-211`) gana la línea `storage,` y nada más (R5: diff de solo líneas añadidas).

Casos de error: capacidad `null`/no numérica → se omite la entrada (R3), sin excepción. Una consulta extra por login: una sola `SELECT` sobre `player_resources`, el mismo orden de costo que `_snapshotNow`.

No se corrige que `catchUp` guarde lo pedido y no lo acreditado (`idleService.js:155`): el modal no muestra los montos de `catchUp`, solo la etiqueta (R20), y `storage` + `resources` ya dicen lo real. Ver pregunta 1.

## 3. Cliente: catálogo y selección (R7–R14)

```js
// client/src/config/escribanoLines.js
export const ESCRIBANO_LINES = { defecto: [...], lleno: [...], breve: [...], larga: [...] };
export const BREVE_MS = 3600000;   // 1 h
export const LARGA_MS = 86400000;  // 24 h
export function escribanoBucket(report)       // 'lleno' | 'larga' | 'breve' | 'defecto'
export function pickEscribanoLine(report)     // string, pura y determinista
```

- Cubo: `lleno` si algún `storage[id].amount >= storage[id].capacity`; si no, `larga` (≥ `LARGA_MS`), `breve` (< `BREVE_MS`) o `defecto` (R9, R10). Los umbrales son presentación, no balance, y no coinciden a propósito con `OFFLINE_CAP_MS`: el tope de 12 h solo afecta al catch-up por caída del servidor, no a la producción normal del `gameTick`.
- Índice: FNV-1a de 32 bits sobre `String(Math.floor(awayMs))`, módulo `cubo.length` (R11). `awayMs` tiene resolución de milisegundo, así que dos ausencias casi siempre eligen distinto (variable por ausencia) y el mismo reporte siempre la misma frase (estable ante re-renders y testeable sin mocks).
- Límite conocido: `lleno` significa «al tope al volver», no «se perdió producción»; no existe el dato de lo perdido. Las frases `lleno` están escritas para valer en ambos casos (alusión a mermas y ratas, sin cifras).
- Sin cifras en las frases (R12): los datos reales los muestra el libro, no el humor, así que la frase nunca puede contradecirlos.

Los textos son contenido, no código: se aprueban en la puerta del owner. Borrador (canon `docs/lore.md:72-77`, `:151-152`; trato de «señor», diezmo, ratas, granero):

| Cubo | Borrador |
|---|---|
| `defecto` | «Todo anotado, señor. El diezmo también, pero ese lo anoto en otro libro.» · «Mientras no estabais, el Bastión trabajó. Yo conté. Alguien tenía que hacerlo.» · «Las cuentas cuadran. Casi siempre a mi favor, pero cuadran.» · «Vuestros labriegos no se quejaron. Tampoco se les preguntó.» · «Producción íntegra, señor, salvo lo que el diezmo encontró por el camino.» · «El Bastión sigue en pie y el libro al día. Solo una de las dos cosas me importa.» |
| `lleno` | «El granero no dio abasto, señor. Lo que no cupo se pudrió; lo demás, las ratas lo asentaron como propio.» · «Granero lleno. Las ratas agradecen vuestra ausencia; yo, el diezmo sobre lo que se llevaron.» · «Se perdió lo que el granero no pudo guardar. Lo asenté bajo «mermas», donde asiento lo que no sé explicar.» · «El granero rebosó y la cosecha se echó a perder. Las ratas, en cambio, jamás comieron mejor.» |
| `breve` | «Apenas os fuisteis y ya volvéis, señor. No hubo tiempo ni de robar con método.» · «Poco tiempo, poca cuenta. El diezmo de lo poco también cuenta.» · «Volvéis pronto. El Bastión no tuvo ocasión de decepcionaros.» · «Una ausencia breve: el libro apenas se ensució.» |
| `larga` | «Cuánto tiempo, señor. El libro creció; mi diezmo, con toda naturalidad.» · «Tantas horas sin vos y el Bastión sigue en pie. Dudo que sea mérito vuestro.» · «Días enteros fuera. Los labriegos preguntaron por vos. Yo no, pero lo anoté.» · «Una ausencia larga rinde buen libro. Lo digo yo, que lo escribo.» |

## 4. Cliente: el libro (R15–R30)

Estructura (sin estilos `rgba` en línea; tokens `kh-*` de `tailwind.config.js` y `Panel`):

```
<div fixed inset-0 z-[60] flex center bg-black/70 p-4 animate-fade-in>      // igual que hoy (R16)
  <Panel variant="parchment" title="Libro de cuentas del Escribano" className="w-full max-w-sm">
    <p>Mientras no estabas</p> <p>Ausente {formatAway(awayMs)}</p>           // R17, R18
    <div max-h-[50vh] overflow-y-auto>                                       // scroll interno (R30)
      Producción acumulada [(incluye recuperación)]                          // R20
        fila por recurso: SpriteIcon 28 + nombre + «+amount» + «amount / capacity» [Granero lleno]  // R19, R23, R24, R25
        recursos llenos fuera de `resources`: fila «{Nombre} — Granero lleno ({amount} / {capacity})» // R24
      bloque «+X KH» (mismo ícono `gem`)                                     // R21
      Sucesos: texto + SpriteIcon scroll                                     // R22
    </div>
    <p>«{frase}»</p> <p>— El Escribano</p>                                    // R26, fuera del scroll
    <Button variant="primary" onClick={dismiss}>Retomar el mando</Button>    // R27
  </Panel>
</div>
```

- El `Panel` no recibe `onClose`: hay una sola salida, el botón, como hoy. La frase y el botón quedan **fuera** del cuerpo con scroll para que el botón siempre se vea (R30).
- Frase: `useMemo(() => pickEscribanoLine(report), [report])`; es pura, el `useMemo` solo evita recalcular.
- Nombres: mapa local `RESOURCE_NAMES` (mismos nombres que `CommerceView.jsx:6-12`: Trigo, Madera, Piedra, Hierro, Oro, …), con el id como respaldo. Se duplica en vez de importar de un componente de otra carpeta; unificar es una limpieza aparte.
- `RESOURCE_ICONS` y `formatAway` se conservan tal cual (`formatAway` pasa a `export`, aditivo, para R18).
- Éxito: el `+amount` va en tinta `kh-parchment-ink` en negrita (`font-numeric` para dígitos), nunca verde (`ui-kit-b.md` §3, R28). «Granero lleno» va en `kh-seal` más texto, no solo color.
- Ícono de KH: se mantiene `gem` como hoy; el ícono propio de KH es asunto de `ui_kit_b`, no se decide aquí.
- Eventos: se renderiza `e.text`; `e.icon` (emoji del servidor) no se usa, como hoy (R22). Cambiar los textos del servidor queda fuera.

## 5. Tests

- `server/tests/idleServiceStorage.test.js` (R2–R4): mismos helpers que `idleService.test.js:15-31` (copiados, no importados); casos: delta con capacidad real, granero lleno sin delta (entrada presente, reporte `null`), capacidad nula.
- `client/src/tests/escribanoLines.test.js` (R7–R13) y `OfflineReportModal.test.jsx` (R15–R30 en jsdom; el store se siembra con `useGameStore.setState`).
- Sin tocar tests existentes (R6). `noEmoji.test.js` barre `components/` y vigila el modal sin cambios (R28, R29); `config/` queda fuera de ese barrido, por eso R12 prueba el catálogo con `EMOJI_RE`.

## 6. Enganche para la feature 20 `almacenes_proteccion` (NO se implementa; R33)

Fuente: `docs/ROADMAP_combate_y_ciudad.md:200-213` («tope de acumulación offline visible: lo muestra el reporte del Escribano», «se reusa su vista»).

- **Dato (servidor):** la 20 añade a cada entrada de `storage` un campo opcional `protected` (resultado de `protectedPerLevel` agregado por recurso). Se calcula dentro de `_capacitiesFor` o en un helper hermano y entra al mismo `return`; si falta, vale 0 y el reporte queda idéntico al de esta feature.
- **Vista (cliente):** la fila de recurso del libro (`OfflineReportModal.jsx`, bloque de R19/R23) ya recibe `storage[id]`; la 20 añade ahí «protegido {protected}» junto a «{amount} / {capacity}». No hace falta endpoint ni cambios en `gameStore`.
- **Saqueo:** `combatService` consume `protectedPerLevel`; el libro solo lo muestra, no lo calcula.
- Esta feature deja a propósito `storage` como objeto por recurso (no un número suelto) para que la 20 sea aditiva (ND1).

## 7. Arte (puerta de p-kh como etapa propia)

**Esta feature no necesita arte nuevo** (R32): `Panel parchment` es el pergamino del kit y los íconos existen. Si el owner quiere un retrato, orla o sello propio del Escribano, eso es una **etapa aparte** (`reporte_escribano` etapa E) que no entra en este spec: manifest en `art-b/`, generación con `scripts/gen_art_b.js`, hoja de contacto y veredicto de p-kh registrado en `evidencia/aprobacion_arte.md`, como en `ui_kit_b` §7. Hasta entonces el modal funciona completo sin esa pieza. Ver pregunta 5.

## 8. Alternativas descartadas

1. **Calcular el tope en el cliente desde `resources` del perfil** (`playerService.js:143`, `{amount, capacity}`): descartada. El perfil trae la capacidad *actual*, no la del momento del reporte, y el reporte llega pegado al perfil en el mismo `init`; dos fuentes pueden desfasarse. Un campo en el reporte es una sola fuente y deja el enganche limpio para la 20.
2. **Elegir la frase con `Math.random()` al montar el modal**: descartada. No es reproducible, obliga a mockear en tests y puede cambiar entre re-renders; el hash de `awayMs` varía por ausencia y es determinista.
3. **Catálogo en `shared/`**: descartada. Son textos de UI que solo usa el cliente; `shared/` es CommonJS y de balance/catálogos de juego. `config/` (ESM) ya aloja narrativa (`heroLore.js`).
4. **Corregir en el servidor `catchUp` (pedido vs acreditado) y la ventana «Ausente»**: descartada aquí (ND1: solo aditivo; el modal no muestra esos montos). Va como pregunta al owner.
5. **Mantener el contenedor inline y solo cambiar colores**: descartada; el criterio A1 pide el kit B y `Panel parchment` es la pieza pensada para paneles de lectura (`tailwind.config.js:13-14`).

## 9. Preguntas abiertas (solo para el owner)

1. **`catchUp` reporta lo pedido, no lo acreditado** (`idleService.js:155` vs `MIN` en `:144-147`). *Recomendación:* dejarlo; no es visible (solo se usa la clave) y arreglarlo toca lógica de dinero/recursos fuera de alcance. Si molesta, feature de servidor aparte.
2. **«Ausente X» mide desde el último login, no tiempo realmente offline** (`:126`); los deltas incluyen lo ganado jugando. *Recomendación:* aceptarlo en esta feature; medir offline real exige un marcador de sesión nuevo (feature aparte).
3. **El evento «cultivos esperando cosecha» cuenta el estado actual, no la ausencia** (`:172-177`). *Recomendación:* aceptarlo y no tocar los textos del servidor aquí.
4. **¿La frase cambia por ausencia, por sesión o por día?** *Recomendación:* por ausencia (hash de `awayMs`), como está especificado; es determinista y varía cada vez que el jugador vuelve.
5. **¿Hace falta retrato, orla o sello del Escribano?** *Recomendación:* no en esta feature; el pergamino del kit alcanza. Si se quiere, etapa de arte aparte con puerta de p-kh.
6. **Tono y texto de las 18 frases** (§3). *Recomendación:* aprobar o reescribir en la puerta del spec; el diezmo y las ratas son canon, el resto es libre dentro del lore.
7. **`docs/lore-glosario.md` no tiene entrada «Escribano».** *Recomendación:* añadirla en un commit de docs aparte; no bloquea.
