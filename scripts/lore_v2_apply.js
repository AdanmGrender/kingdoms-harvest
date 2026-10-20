'use strict';
/**
 * lore_v2_apply.js — migración de TEXTOS VISIBLES del lore v1 (sci-fi grimdark)
 * al v2 (grimdark renacentista). NUNCA toca ids, claves ni números: solo
 * cadenas que ve el jugador. Fuente única del glosario (docs/lore-glosario.md).
 *
 *   node scripts/lore_v2_apply.js            # dry-run: cuenta reemplazos
 *   node scripts/lore_v2_apply.js --write    # aplica
 *   node scripts/lore_v2_apply.js --glossary # regenera docs/lore-glosario.md
 *
 * Modos: 'any' = subcadena en cualquier lugar (frases distintivas);
 *        'lit' = solo el literal exacto entre comillas ('X' / "X").
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// [viejo, nuevo, modo, categoría]
const MAP = [
  // ── Recursos ──
  ['Grano Sintético', 'Trigo Votivo', 'any', 'Recursos'], ['grano sintético', 'trigo votivo', 'any', 'Recursos'],
  ['Chatarra', 'Madera', 'lit', 'Recursos'], ['Ferrocreto', 'Piedra', 'lit', 'Recursos'], ['ferrocreto', 'piedra', 'any', 'Recursos'],
  ['Acero', 'Hierro', 'lit', 'Recursos'], ['Agua Filtrada', 'Agua de Pozo', 'any', 'Recursos'], ['agua filtrada', 'agua de pozo', 'any', 'Recursos'],
  ['Créditos', 'Coronas', 'any', 'Recursos'], ['Raciones', 'Pan Negro', 'lit', 'Recursos'], ['Placas de Blindaje', 'Tablones', 'any', 'Recursos'],
  ['Aleación', 'Lingotes', 'lit', 'Recursos'], ['Polvo Nutriente', 'Harina', 'any', 'Recursos'], ['Proteína Cultivada', 'Queso Curado', 'any', 'Recursos'],
  ['Cristal de Energía', 'Ascua de Faro', 'any', 'Recursos'], ['cristal de energía', 'ascuas de faro', 'any', 'Recursos'],
  ['Plano Arcanotécnico', 'Tratado de Ingenios', 'any', 'Recursos'],
  // ── Cultivos y animales ──
  ['Raíz Nutritiva', 'Nabo Amargo', 'any', 'Cultivos'], ['Tubérculo Vat', 'Papa Negra', 'any', 'Cultivos'],
  ['Fruto Hidropónico', 'Manzana de Horca', 'any', 'Cultivos'], ['Bulbo Fungoide', 'Calabaza Hinchada', 'any', 'Cultivos'],
  ['Maíz Mutante', 'Centeno Retorcido', 'any', 'Cultivos'], ['Baya Fermentable', 'Uva de Lagar', 'any', 'Cultivos'],
  ['Ave Clonada', 'Gallina Flaca', 'any', 'Animales'], ['Bestia de Carga', 'Buey de Tiro', 'any', 'Animales'],
  ['Lanuda Mutante', 'Oveja Sarnosa', 'any', 'Animales'],
  // ── Edificios ──
  ['Cúpula Hidropónica', 'Huerto Votivo', 'any', 'Edificios'], ['Depósito de Suministros', 'Granero', 'any', 'Edificios'],
  ['Procesadora de Raciones', 'Molino', 'any', 'Edificios'], ['Planta de Salvamento', 'Aserradero', 'any', 'Edificios'],
  ['Fundición', 'Herrería', 'lit', 'Edificios'], ['Corral de Bestias', 'Establo', 'any', 'Edificios'],
  ['Bloque Habitacional', 'Casa de Vecinos', 'any', 'Edificios'], ['Excavación Profunda', 'Mina de la Colina', 'any', 'Edificios'],
  ['Muro Bastión', 'Muralla', 'any', 'Edificios'], ['Torreta Centinela', 'Torre de Cañones', 'any', 'Edificios'],
  ['Campo de Minas', 'Foso de Estacas', 'any', 'Edificios'], ['Cantina', 'Taberna', 'lit', 'Edificios'],
  ['Nexo de Comunicaciones', 'Casa del Emisario', 'any', 'Edificios'], ['Bastión de Mando', 'Torre del Señor', 'any', 'Edificios'],
  ['Archivo Tecnosagrado', 'Scriptorium', 'any', 'Edificios'],
  // ── Tropas ──
  ['Fusilero', 'Arcabucero', 'lit', 'Tropas'], ['Asalto Mecanizado', 'Caballería Pesada', 'any', 'Tropas'],
  ['Granadero', 'Alabardero', 'lit', 'Tropas'], ['Vehículo de Brecha', 'Ariete', 'any', 'Tropas'],
  // ── Tecnologías ──
  ['Biocultivo', 'Labranza', 'lit', 'Tecnologías'], ['Sustrato Enriquecido', 'Estiércol Bendecido', 'any', 'Tecnologías'],
  ['Riego Automatizado', 'Acequias', 'any', 'Tecnologías'], ['Clonación Selectiva', 'Cría Selectiva', 'any', 'Tecnologías'],
  ['Bio-Cúpula Sellada', 'Invernadero de Vidrio', 'any', 'Tecnologías'], ['Rutas de Convoy', 'Rutas de Caravana', 'any', 'Tecnologías'],
  ['Maestro de Convoyes', 'Maestro de Caravanas', 'any', 'Tecnologías'], ['Sindicato Mercante', 'Gremio de Mercaderes', 'any', 'Tecnologías'],
  ['Doctrina de Guerra', 'Arte de la Guerra', 'any', 'Tecnologías'], ['Munición Perforante', 'Pólvora Fina', 'any', 'Tecnologías'],
  ['Doctrina Táctica', 'Tácticas de Pica', 'any', 'Tecnologías'],
  // (ítem chainmail se corrige después por contexto, ver FIXUPS)
  ['Blindaje Compuesto', 'Coraza Templada', 'any', 'Tecnologías'],
  // ── Facciones, oficios, asedio, eventos ──
  ['Bioadeptos que arrancan vida', 'Herbolarios de seto que arrancan vida', 'any', 'Facciones'],
  ['Cultivador', 'Labriego', 'lit', 'Oficios'], ['Chatarrero', 'Leñador', 'lit', 'Oficios'], ['Excavador', 'Minero', 'lit', 'Oficios'],
  ['Traficante', 'Buhonero', 'lit', 'Oficios'], ['Ingeniero', 'Maestro de Obras', 'lit', 'Oficios'],
  ['Fuego de Supresión', 'Salva de Arcabuces', 'any', 'Asedio'], ['Carga de Demolición', 'Golpe de Ariete', 'any', 'Asedio'],
  ['Línea de Blindaje', 'Muro de Escudos', 'any', 'Asedio'],
  ['Brote de los Vats', 'Fiesta de la Siembra', 'any', 'Eventos'], ['Convoy de Abundancia', 'Feria de la Cosecha', 'any', 'Eventos'],
  ['Convoy Dorado', 'Caravana Dorada', 'any', 'Eventos'], ['ventas a convoyes', 'ventas a caravanas', 'any', 'Eventos'],
  ['venta a convoyes', 'venta a caravanas', 'any', 'Eventos'],
  ['Mano Bioadepta', 'Mano Verde', 'any', 'Logros'], ['Maestro de Vats', 'Maestro de Huertos', 'any', 'Logros'],
  ['Aprendiz Ingeniero', 'Aprendiz de Albañil', 'any', 'Logros'], ['Tecnoerudito', 'Erudito del Scriptorium', 'any', 'Logros'],
  ['Traficante Rico', 'Mercader Rico', 'any', 'Logros'],
  // ── Héroes, habilidades, objetos ──
  ['Lyra, Psíquica Menor', 'Lyra, Bruja de Aldea', 'any', 'Héroes'], ['Don Psíquico: sus poderes', 'Don Brujo: sus hechizos', 'any', 'Héroes'],
  ['Elena, Francotiradora', 'Elena, Tiradora de Arcabuz', 'any', 'Héroes'], ['Kryx-9, Forjasacro', 'Kryx, Fraguador Rúnico', 'any', 'Héroes'],
  ['Sobrecarga del Reactor', 'Fragua al Rojo', 'any', 'Héroes'], ['Kryx-9', 'Kryx', 'any', 'Héroes'],
  ['Descarga Psíquica', 'Descarga Arcana', 'any', 'Habilidades'],
  ['Cuchilla de Combate', 'Espada de Munición', 'any', 'Objetos'],
  ['Hoja sierra estándar, forjada en la fundición del bastión', 'Hoja de munición sin gracia, forjada a martillazos en la herrería del bastión', 'any', 'Objetos'],
  ['Báculo Psíquico', 'Báculo de Tormenta', 'any', 'Objetos'],
  ['Canaliza el poder mental del portador en un flujo devastador', 'Una rama de roble partida por un rayo que todavía no se olvidó de él', 'any', 'Objetos'],
  ['Rifle del Cazador', 'Arcabuz del Cazador', 'any', 'Objetos'],
  ['Culata gastada por generaciones, silencioso y mortal', 'Culata gastada por tres generaciones de cazadores furtivos', 'any', 'Objetos'],
  ['Peto de Fibra', 'Peto de Cuero', 'any', 'Objetos'], ['Manto Psíquico', 'Manto del Brujo', 'any', 'Objetos'],
  ['Tejido con hilos que amplifican la energía mental', 'Bordado con runas por una abuela que nadie se atrevió a contradecir', 'any', 'Objetos'],
  ['Botas Servoasistidas', 'Botas de Correo', 'any', 'Objetos'],
  ['Pistones de asistencia que permiten moverse como el viento', 'Las usaban los correos del viejo imperio; todavía huelen a camino', 'any', 'Objetos'],
  ['Capas de aleación forman una barrera impenetrable', 'Mil anillas remachadas a mano por un herrero con mucha paciencia', 'any', 'Objetos'],
  // ── Tormentas y Marea ──
  ['Velo Estático', 'Niebla Sorda', 'any', 'Tormentas'],
  ['Interferencia disforme: −25% producción y convoyes sellados.', 'Niebla sorda: −25% producción y caravanas perdidas.', 'any', 'Tormentas'],
  ['La disformidad hierve', 'La Mácula hierve', 'any', 'Tormentas'], ['Lluvia de Energía', 'Lluvia de Ascuas', 'any', 'Tormentas'],
  ['Fragmentos de energía pura', 'Pavesas de los viejos Faros', 'any', 'Tormentas'],
  ['Susurros del Vacío', 'Susurros de la Mácula', 'any', 'Tormentas'], ['Voces en la estática', 'Voces en los pozos', 'any', 'Tormentas'],
  ['Brutos Retorcidos', 'Brutos Cornudos', 'any', 'Bestiario'], ['Devorador de Auroras', 'Devorador de Faros', 'any', 'Bestiario'],
  ['Heraldo de la Estática', 'Heraldo de la Tormenta', 'any', 'Bestiario'],
  ['Marea Disforme', 'Marea de la Mácula', 'any', 'Interfaz'], ['tormentas disformes', 'tormentas de la Mácula', 'any', 'Interfaz'],
  ['construí torretas antes', 'construí torres antes', 'any', 'Interfaz'],
  // ── Marca y Reinos (antes Sistema y Galaxia) ──
  ['Tu mundo natal. El corazón de tu dominio.', 'Tu villa amurallada. El corazón de tu dominio.', 'any', 'Marca y Reinos'],
  ['Mundo-fundición sofocado por el humo de mil forjas.', 'Ciudad-fragua sofocada por el humo de mil chimeneas.', 'any', 'Marca y Reinos'],
  ['Yermo de ceniza volcánica', 'Comarca de ceniza volcánica', 'any', 'Marca y Reinos'],
  ['Llanuras de sal donde', 'Salinas donde', 'any', 'Marca y Reinos'],
  ['Mundo oscuro y rico', 'Ciudad oscura y rica', 'any', 'Marca y Reinos'],
  ['Estación orbital olvidada; extrae cristal de energía del vacío.', 'Monasterio olvidado cuyos monjes destilan ascuas de faro del Velo.', 'any', 'Marca y Reinos'],
  ['Estación Nexo-7', 'Priorato de Nexo', 'any', 'Marca y Reinos'],
  ['Tu sistema natal, donde orbita tu dominio.', 'Tu marca natal, donde se asienta tu dominio.', 'any', 'Marca y Reinos'],
  ['Sistema Cadmion', 'Marca de Cadmion', 'any', 'Marca y Reinos'], ['Cúmulo Verglobo', 'Valles de Verglobo', 'any', 'Marca y Reinos'],
  ['Cúmulo de mundos-jardín; sus cosechas alimentan flotas enteras.', 'Valles-jardín del viejo imperio; sus cosechas alimentaban ejércitos enteros.', 'any', 'Marca y Reinos'],
  ['Grieta estelar rica', 'Grieta en el mundo, rica', 'any', 'Marca y Reinos'], ['Fragua Estelar Vok', 'Fragua Hundida de Vok', 'any', 'Marca y Reinos'],
  ['Estrella-fundición que escupe acero y ferrocreto sin fin.', 'Fundición hundida en la montaña que escupe hierro y piedra sin fin.', 'any', 'Marca y Reinos'],
  ['Sistema devorado por la Disformidad', 'Reino devorado por la Mácula', 'any', 'Marca y Reinos'],
  ['En la Disformidad', 'En los Caminos Velados', 'any', 'Marca y Reinos'],
  ['La Nave no pudo partir', 'La caravana no pudo partir', 'any', 'Marca y Reinos'],
  ['El Crucero no pudo zarpar', 'La expedición no pudo partir', 'any', 'Marca y Reinos'],
  ['Primero controlá todos los planetas de tu sistema natal', 'Primero controlá todas las plazas de tu Marca', 'any', 'Marca y Reinos'],
  ['El Crucero ya surca la Disformidad', 'Tu expedición ya cruza el Velo', 'any', 'Marca y Reinos'],
  ['La Nave ya está en tránsito', 'La caravana ya está en camino', 'any', 'Marca y Reinos'],
  ['Ya controlás ese planeta', 'Ya controlás esa plaza', 'any', 'Marca y Reinos'],
  // ── Comercio (convoy → caravana) ──
  ['La tormenta disforme selló las rutas — el convoy no responde', 'La tormenta cerró los caminos — la caravana no responde', 'any', 'Comercio'],
  ['El convoy no vende', 'La caravana no vende', 'any', 'Comercio'], ['El convoy solo tiene', 'La caravana solo tiene', 'any', 'Comercio'],
  ['El convoy no compra', 'La caravana no compra', 'any', 'Comercio'], ['El convoy solo acepta', 'La caravana solo acepta', 'any', 'Comercio'],
  ['Error al cargar el convoy', 'Error al cargar la caravana', 'any', 'Comercio'], ['Convoy', 'Caravana', 'lit', 'Comercio'],
  ['con convoyes', 'con caravanas', 'any', 'Comercio'], ['Cruce de Convoyes', 'Cruce de Caravanas', 'any', 'Comercio'],
  ['Convoy del Este', 'Caravana del Este', 'any', 'Comercio'], ['Chatarreros de Norheim', 'Carreteros de Norheim', 'any', 'Comercio'],
  ['Convoy del Alto Mando', 'Caravana del Margrave', 'any', 'Comercio'],
  ['Convoy Abandonado', 'Caravana Abandonada', 'any', 'Comercio'],
  ['Un convoy fue dejado atrás bajo fuego.', 'Una caravana quedó abandonada en el camino.', 'any', 'Comercio'],
  // ── Biografías (heroLore.js) ──
  ['escuchando la estática, sin maestro', 'escuchando el crepitar de las velas, sin maestro', 'any', 'Biografías'],
  ['atraviesa el blindaje del enemigo', 'atraviesa la coraza del enemigo', 'any', 'Biografías'],
  ['beber de la Disformidad', 'beber de la Mácula', 'any', 'Biografías'],
  ['los yermos muertos más allá del muro', 'los bosques muertos más allá de la muralla', 'any', 'Biografías'],
  ['en el ruido de la estática', 'en el humo de las velas', 'any', 'Biografías'],
  ['Cree que la fe es una máquina', 'Cree que la fe es una fragua', 'any', 'Biografías'],
  ['El Reactor Sagrado', 'La Fragua Sagrada', 'any', 'Biografías'],
  ['lleva un reactor de fe donde otros tienen corazón, y lo purga como un rito cada pocos segundos. Cuando la carga alcanza el punto rojo, su descarga funde blindaje y estandarte por igual.',
    'lleva una fragua de fe encendida en el pecho, encerrada en un peto remachado, y la aviva como un rito cada pocos golpes. Cuando el hierro se pone al rojo, su descarga funde coraza y estandarte por igual.', 'any', 'Biografías'],
  // ── Pasada 2 (textos de paneles, bot y diálogos que la 1 no cubrió) ──
  ['🛰️ Cartografía del Sistema', '🗺️ Mapa de la Marca', 'any', 'Marca y Reinos'],
  ['Extendé tu dominio planeta a planeta', 'Extendé tu dominio plaza a plaza', 'any', 'Marca y Reinos'],
  ['🌌 Galaxia', '🌫️ Reinos Caídos', 'any', 'Marca y Reinos'],
  ['¡Sistema dominado! La <b>Disformidad</b> está abierta —', '¡Marca dominada! El <b>Velo</b> se puede cruzar —', 'any', 'Marca y Reinos'],
  ['surcá la Galaxia', 'partí a los Reinos Caídos', 'any', 'Marca y Reinos'],
  ['Nave en ruta a', 'Caravana en ruta a', 'any', 'Marca y Reinos'],
  ['La Nave está en camino…', 'La caravana está en camino…', 'any', 'Marca y Reinos'],
  ['🌌 Cartografía de la Galaxia', '🌫️ Mapa de los Reinos Caídos', 'any', 'Marca y Reinos'],
  ['Surcá la Disformidad entre sistemas', 'Cruzá el Velo por los Caminos Velados', 'any', 'Marca y Reinos'],
  ['Trazando rutas disformes…', 'Trazando los Caminos Velados…', 'any', 'Marca y Reinos'],
  ['La Galaxia se abre al', 'Los Reinos Caídos se abren al', 'any', 'Marca y Reinos'],
  ['dominar todos los planetas de tu sistema', 'dominar todas las plazas de tu Marca', 'any', 'Marca y Reinos'],
  ['Crucero rumbo a', 'Expedición rumbo a', 'any', 'Marca y Reinos'],
  ['Surcar la Disformidad', 'Cruzar el Velo', 'any', 'Marca y Reinos'],
  ['El Crucero está en la Disformidad…', 'Tu expedición está cruzando el Velo…', 'any', 'Marca y Reinos'],
  ['✓ Sistema bajo tu dominio', '✓ Reino bajo tu dominio', 'any', 'Marca y Reinos'],
  ['Convocando convoy...', 'Llamando a la caravana...', 'any', 'Comercio'],
  ['Sin convoy disponible.', 'Sin caravana disponible.', 'any', 'Comercio'],
  ['sin esperar convoy.', 'sin esperar caravana.', 'any', 'Comercio'],
  ['+50% de cupo de venta al convoy', '+50% de cupo de venta a la caravana', 'any', 'Tecnologías'],
  ['¿Buscás trabajo en los vats?', '¿Buscás trabajo en los campos?', 'any', 'Diálogos'],
  ['El Vacío susurra grandes desafíos', 'La Mácula susurra grandes desafíos', 'any', 'Diálogos'],
  ['cultivá tus vats', 'sembrá tus campos', 'any', 'Bot'],
  ['Plantá en tus vats y criá bestias', 'Sembrá tus campos y criá ganado', 'any', 'Bot'],
  ['ganar créditos y XP', 'ganar coronas y XP', 'any', 'Bot'],
  ['reforzá muros y torretas', 'reforzá murallas y torres', 'any', 'Interfaz'],
  ['{ id: \'explore\', sprite: \'star\', icon: \'🛰️\', label: \'Sistema\'', '{ id: \'explore\', sprite: \'star\', icon: \'🗺️\', label: \'Marca\'', 'any', 'Interfaz'],
];

// Correcciones por contexto (después del MAP).
const FIXUPS = [
  [/(id: 'chainmail',\s*name: ')Coraza Templada(')/, '$1Cota de Malla$2'],
];

const FILES_GLOB = ['shared', 'client/src', 'server/src', 'server/tests'];

function listFiles() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (/\.(js|jsx|cjs|mjs)$/.test(e.name)) out.push(p);
    }
  };
  for (const g of FILES_GLOB) { const d = path.join(ROOT, g); if (fs.existsSync(d)) walk(d); }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function apply(write) {
  // Más largos primero: evita que una frase corta pise a una que la contiene.
  const map = [...MAP].sort((a, b) => b[0].length - a[0].length);
  const counts = new Map();
  let filesChanged = 0;
  for (const f of listFiles()) {
    const src = fs.readFileSync(f, 'utf8');
    let s = src;
    for (const [from, to, mode] of map) {
      const re = mode === 'lit' ? new RegExp(`(['"\`])${esc(from)}\\1`, 'g') : new RegExp(esc(from), 'g');
      s = s.replace(re, (...m) => {
        counts.set(from, (counts.get(from) || 0) + 1);
        return mode === 'lit' ? `${m[1]}${to}${m[1]}` : to;
      });
    }
    for (const [re, to] of FIXUPS) s = s.replace(re, to);
    if (s !== src) {
      filesChanged++;
      console.log('  ~', path.relative(ROOT, f));
      if (write) fs.writeFileSync(f, s);
    }
  }
  const unused = MAP.filter(([from]) => !counts.has(from)).map(([f]) => f);
  console.log(`${write ? 'APLICADO' : 'DRY-RUN'}: ${[...counts.values()].reduce((a, b) => a + b, 0)} reemplazos en ${filesChanged} archivos`);
  if (unused.length) console.log('sin coincidencias:', unused.join(' | '));
}

function glossary() {
  const byCat = {};
  for (const [from, to, , cat] of MAP) if (from.length < 45) (byCat[cat] ||= []).push([from, to]);
  let md = '# Glosario de lore v1 → v2\n\n> Generado por `scripts/lore_v2_apply.js --glossary` (fuente única).\n'
    + '> v1 = ciencia ficción grimdark · v2 = grimdark renacentista (ver `docs/lore.md`).\n'
    + '> Solo cambian textos visibles: ids de recursos, edificios y héroes NO cambian.\n\n'
    + '## Conceptos\n\n| v1 | v2 |\n|---|---|\n'
    + '| la Disformidad | la Mácula |\n| Concordia de las Auroras / las Auroras | Concordia de los Faros / los Faros |\n'
    + '| reflectores (sol falso) | el Fuego Votivo |\n| Sistema / planetas | la Marca / plazas |\n'
    + '| Galaxia / cúmulos | los Reinos Caídos |\n| Nave / Crucero | caravana / expedición por los Caminos Velados |\n'
    + '| convoy | caravana |\n| KH (sin metáfora) | KH = Ascuas del Faro |\n\n';
  for (const [cat, rows] of Object.entries(byCat)) {
    md += `## ${cat}\n\n| v1 | v2 |\n|---|---|\n${rows.map(([a, b]) => `| ${a} | ${b} |`).join('\n')}\n\n`;
  }
  fs.writeFileSync(path.join(ROOT, 'docs', 'lore-glosario.md'), md);
  console.log('✓ docs/lore-glosario.md');
}

const args = process.argv.slice(2);
if (args.includes('--glossary')) glossary();
else apply(args.includes('--write'));
