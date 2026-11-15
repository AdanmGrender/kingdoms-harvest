# Hoja de contacto T8 (P1) — paladin / rogue
- Hoja: evidencia/contacto_T8_heroes.webp (fondo oscuro; fila 1: paladin idle/attack, rogue idle/attack; fila 2: referencias warrior idle/attack, mage idle, ranger idle).
- Generación: gen_art_web.js (web, modelo distinto a la API) con `--ref` art-b/gr/refs/mage_idle.webp (solo estilo). Hojas de pose 1376x768 (no 2752x1536).
- Generaciones web usadas: 2 (sheet_paladin, sheet_rogue). Tope etapa: 40.
- Procesado: process_art_b.js --height 640 (crops idle|attack por columnas vacías), webp.
