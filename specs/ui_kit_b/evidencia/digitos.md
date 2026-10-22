# Prueba de dígitos a 412 px (ui_kit_b R13, T7)

Corrida: `node scripts/ui_kit_b_evidence.js --mode digitos --url http://localhost:5174` (Playwright 412×860 @2x, Vite dev + server `SKIP_AUTH`).
Datos forzados en el store: wood 12345, stone 99999, wheat 12300, iron 4567 (la barra actual muestra 4 contadores; los de etapa B se miden en T17).

| Variante | Captura | `font-family` calculada | Texto / ancho del contador (px) | Fila `scrollWidth/clientWidth` |
|---|---|---|---|---|
| IM Fell English (base) | `digitos_im_fell.webp` | `"IM Fell English", serif` | 12.3K / 52 · 100.0K / 58 · 12.3K / 52 · 4.6K / 49 | 172/172 (sin desborde) |
| `font-numeric` (Alegreya Sans SC 700) | `digitos_numeric.webp` | `"Alegreya Sans SC", serif` | 12.3K / 52 · 100.0K / 57 · 12.3K / 52 · 4.6K / 48 | 172/172 (sin desborde) |

Nota: la clase `font-numeric` aún no se usa en el código, así que Tailwind no la emite; la variante se aplicó con `style.fontFamily` equivalente.

## Veredicto

PENDIENTE de p-kh/owner (design §11-Q2): decidir si los números de la barra usan IM Fell (base) o `font-numeric`.
Consecuencia técnica: ninguna de las dos desborda a 412 px; la elección es solo de legibilidad (los dígitos de IM Fell son «old-style»).
Se consume en T14 (etapa B). Tarea de decisión creada en el tablero para p-kh.
