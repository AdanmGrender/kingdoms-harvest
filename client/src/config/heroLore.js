/**
 * heroLore.js — Biografías canónicas de los héroes del Bastión.
 *
 * Solo NARRATIVA: no toca stats, ids ni balance (esos viven en
 * shared/gameConfig.js → HEROES). Indexado por heroId; cada entrada:
 *   { title: string, bio: string }
 * `title` = epíteto corto y épico; `bio` = 1-3 frases coherentes con la
 * clase, rareza, pasiva y NOMBRE del héroe. Estilo grimdark ORIGINAL — sin
 * marcas de terceros. Ver docs/lore.md para el canon del mundo.
 *
 * Consumido por client/src/components/overlay/HeroPanel.jsx.
 */
export const HERO_LORE = {
  // ── Primera camada ──
  aria: {
    title: 'La Que No Cede el Muro',
    bio: 'Sargento de una guarnición que ya no existe, Aria enterró a toda su escuadra y siguió disparando. Manda por costumbre y por rabia: cuando los suyos superan en número al horror, cierra filas y su descarga cerrada no perdona.',
  },
  thorin: {
    title: 'El Yunque de Cadmion',
    bio: 'Torgan plantó su escudo en la Brecha Occidental y no lo movió en tres asedios. Cuanto más sangra, más hondo clava los pies: los heridos dicen que su defensa se vuelve muralla justo cuando debería quebrarse.',
  },
  lyra: {
    title: 'La Chispa del Velo',
    bio: 'Lyra despertó su don escuchando la estática, sin maestro ni letanía que la frenaran. Su poder aún es pequeño, pero atraviesa el blindaje del enemigo como si la armadura fuese niebla.',
  },
  zara: {
    title: 'La Voz Que Maldice',
    bio: 'Zara aprendió a beber de la Disformidad sin ahogarse en ella, y volvió con la garganta llena de palabras que no deberían pronunciarse. A quien señala, lo marchita: por dos turnos el horror combate como si le hubieran arrancado la mitad de la furia.',
  },
  finn: {
    title: 'El Ojo del Perímetro',
    bio: 'Finn recorre los yermos muertos más allá del muro y vuelve con la posición exacta de cada enjambre. Aprendió a matar a distancia porque acercarse al Velo, allá afuera, es suicidio.',
  },
  elena: {
    title: 'La Aguja Lejana',
    bio: 'Una bala, un aullido menos. Elena caza desde las torres con una paciencia que asusta, y cuando algo logra alcanzarla, casi nunca la encuentra donde apuntó.',
  },
  viktor: {
    title: 'El Escudo Compartido',
    bio: 'Viktor jura por los que están a su lado, no por causas ni banderas. Su presencia endurece la línea entera: los que pelean junto a él aguantan un poco más de lo que su miedo les permitiría.',
  },
  seraph: {
    title: 'El Capellán de Hierro',
    bio: 'Serafín recita las Letanías del Bastión mientras el acero canta, y su voz cose las heridas de la tropa entre embate y embate. Cree que la fe es una máquina: hay que alimentarla con sacrificio cada ronda o se apaga.',
  },
  shadow: {
    title: 'La Que No Deja Huella',
    bio: 'Nadie sabe su nombre verdadero ni por qué sirve al Bastión. Sombra aparece detrás del enemigo antes de que este sepa que hay pelea, y ese primer corte suele ser el único que necesita.',
  },
  vex: {
    title: 'El Filo Gemelo',
    bio: 'Vex se mueve más rápido de lo que la vista sigue, y a veces su hoja llega dos veces al mismo latido. Impaciente hasta la temeridad, pelea como si el tiempo también quisiera devorarlo.',
  },
  // ── Segunda camada (arquetipos grimdark originales) ──
  varok: {
    title: 'El Primer Golpe',
    bio: 'Varok abre las brechas que otros temen cruzar: entra el primero, siempre, con el puño por delante. En el choque inicial nadie pega más fuerte que él; después, deja que la línea termine el trabajo.',
  },
  morghal: {
    title: 'El Que No Termina de Morir',
    bio: 'El Velo tocó a Morghal y, en vez de matarlo, se lo quedó a medias: la carne le pudre y se le rehace ronda tras ronda. Quien lo hiere se lleva su contagio a modo de castigo, con la fuerza escapándosele por la herida.',
  },
  azyra: {
    title: 'La Que Ve el Golpe',
    bio: 'Azyra lee el futuro inmediato en el ruido de la estática y esquiva ataques que aún no ocurrieron. Sabe dónde se abrirá la guardia del enemigo un instante antes que él, y ahí clava el crítico.',
  },
  fenn: {
    title: 'El Colmillo Que Crece',
    bio: 'Fenn empieza cada combate frío y lo termina hecho una tormenta: cada ronda que sobrevive lo vuelve más rápido y más letal. Dejarlo pelear demasiado tiempo es el último error de muchos horrores.',
  },
  kryx: {
    title: 'El Reactor Sagrado',
    bio: 'Kryx-9 lleva un reactor de fe donde otros tienen corazón, y lo purga como un rito cada pocos segundos. Cuando la carga alcanza el punto rojo, su descarga funde blindaje y estandarte por igual.',
  },
  serafina: {
    title: 'La Fe Que Escuda',
    bio: 'Serafina camina al frente sin caer, y su convicción se derrama sobre la escuadra como un manto: parte de cada golpe que reciben los suyos se estrella contra algo que no es acero. Donde ella reza, la tropa no se rompe.',
  },
  gorr: {
    title: 'El Yunque Andante',
    bio: 'Gorr no tiene técnica ni la quiere: levanta el mazo y deja caer el cielo. Cuando conecta de lleno, el horror queda tan aturdido que olvida devolver el golpe.',
  },
  nyx: {
    title: 'La Última Sentencia',
    bio: 'Nyx no pelea: dictamina. Huele la sangre del que ya está herido y termina el trabajo con un tajo que casi nunca hace falta repetir; para los moribundos, su hoja es el punto final.',
  },
};

export default HERO_LORE;
