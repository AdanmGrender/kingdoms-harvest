# Kingdoms Harvest - Guia de Arte para Generacion de Imagenes con IA

## 1. IDENTIDAD VISUAL DEL JUEGO

**Nombre:** Kingdoms Harvest
**Genero:** Farming + Castle Builder + War Strategy (estilo Stardew Valley medieval)
**Plataforma:** Telegram Mini App (mobile-first, pantallas pequenas)
**Estilo artistico:** Pixel art chibi/cute con paleta medieval oscura

### Estilo de Sprites Existentes
Los sprites actuales siguen estas reglas visuales:
- **Pixel art** con bordes definidos y sombreado simple
- **Estilo chibi/kawaii** para personajes (cabezas grandes, cuerpos pequenos)
- **Fondos neutros** (transparente o beige claro `#F5F0E1`)
- **Contornos oscuros** en todos los elementos
- **Sombreado cel-shading** simple (2-3 tonos por color)
- **Proporcion personajes:** cabeza = 40% del cuerpo, ojos grandes y expresivos
- **Tamano de sprites:** 256x256px para items/botones, ~205x341px para personajes
- **Resolucion de sheets:** 1024x1024px

### Paleta de Colores del Juego

**UI/Interfaz (fondo oscuro):**
| Uso | Color | Hex |
|-----|-------|-----|
| Fondo principal | Azul muy oscuro | `#1a1a2e` |
| Fondo de cards | Azul oscuro | `#16213e` |
| Bordes | Azul medio | `#0f3460` |
| Acento principal | Rojo rosado | `#e94560` |
| Oro/Premium | Dorado | `#ffd700` |
| Exito | Verde | `#4ade80` |
| Texto | Blanco | `#ffffff` |

**Paleta de sprites (tonos calidos medievales):**
| Uso | Tonos |
|-----|-------|
| Madera/Tierra | Marron calido `#8B6914`, `#A0522D`, `#654321` |
| Piedra | Gris `#808080`, `#A9A9A9`, `#696969` |
| Hierro/Metal | Gris azulado `#708090`, `#B0C4DE` |
| Oro | Dorado `#FFD700`, `#DAA520`, `#B8860B` |
| Vegetacion | Verdes `#228B22`, `#32CD32`, `#006400` |
| Agua | Azules `#4169E1`, `#87CEEB`, `#00BFFF` |
| Fuego/Peligro | Rojos `#FF4500`, `#DC143C` |
| Magia/Raro | Purpuras `#8B008B`, `#9370DB`, `#4B0082` |

---

## 2. EL MUNDO DEL JUEGO

### Ambientacion
Un mundo medieval fantastico donde el jugador es un **senor feudal** que debe:
1. **Cultivar** su granja (trigo, zanahorias, papas, tomates, maiz, calabazas, uvas)
2. **Criar animales** (gallinas, vacas, ovejas)
3. **Construir** su castillo con edificios funcionales
4. **Comerciar** con caravanas y NPCs viajeros
5. **Entrenar** tropas y **conquistar** territorios
6. **Unirse** a una faccion para guerras por territorios

### Estetica del Mundo
- Estaciones que rotan semanalmente: primavera (verde brillante), verano (dorado calido), otono (naranja/marron), invierno (azul/blanco)
- Arquitectura medieval europea: castillos de piedra, granjas de madera, mercados con toldos
- Fantasia ligera: pociones magicas, cristales raros, magos y brujas
- Ambiente acogedor pero con tension belica (guerra entre facciones)

---

## 3. SPRITES NECESARIOS - DETALLE POR CATEGORIA

### 3.1 CULTIVOS (7 tipos)

Cada cultivo necesita **4 estados visuales**:
1. **Semilla** (tierra con brote pequeno)
2. **Creciendo** (planta a medio crecer)
3. **Listo para cosechar** (planta completa con fruto visible, brillo dorado)
4. **Icono de item** (el fruto/producto cosechado, para inventario)

| Cultivo | Descripcion Visual | Color dominante | Forma |
|---------|-------------------|-----------------|-------|
| **Trigo** | Espigas doradas altas, grano visible | Dorado `#DAA520` | Tallos verticales con espigas |
| **Zanahoria** | Hojas verdes arriba, raiz naranja enterrada | Naranja `#FF8C00` | Raiz triangular |
| **Papa** | Planta baja verde oscuro, tuberculos marrones | Marron `#8B7355` | Formas redondas irregulares |
| **Tomate** | Planta con tomates rojos colgando | Rojo `#FF6347` | Frutos redondos rojos |
| **Maiz** | Tallo alto con mazorcas amarillas | Amarillo `#FFD700` | Mazorca con hojas verdes |
| **Calabaza** | Planta rastrera con calabaza grande naranja | Naranja `#FF7518` | Forma redonda grande |
| **Uva** | Parra con racimos purpuras | Purpura `#6B3FA0` | Racimos de bolitas |

**Formato:** 256x256px cada estado, fondo transparente, pixel art

### 3.2 ANIMALES (3 tipos)

Cada animal necesita **3 estados**:
1. **Normal** (animal contento)
2. **Hambriento** (animal triste, burbuja de pensamiento con comida)
3. **Produciendo** (animal con su producto visible)

| Animal | Descripcion Visual | Producto | Estilo |
|--------|-------------------|----------|--------|
| **Gallina** | Gallina pixel art chibi, plumas blancas/marrones, cresta roja | Huevo (marron/beige ovalado) | Cute, rechoncha, ojos grandes |
| **Vaca** | Vaca pixel art chibi, blanca con manchas marrones | Botella de leche blanca | Cute, manchas irregulares |
| **Oveja** | Oveja pixel art chibi, lana esponjosa blanca, cara negra | Ovillo de lana blanco | Muy esponjosa, forma de nube |

**Formato:** 256x256px, fondo transparente, pixel art chibi

### 3.3 EDIFICIOS (14 tipos)

Cada edificio necesita **3-5 niveles visuales** (van creciendo/mejorando):

**Zona Agricola (fondo verde/tierra):**
| Edificio | Nivel 1 | Nivel Max | Color |
|----------|---------|-----------|-------|
| **Parcela** | Cuadrado de tierra arada | Parcela grande con cerca dorada | Marron tierra |
| **Granero** | Edificio pequeno de madera, techo rojo | Granero enorme con silo | Rojo `#8B0000` + madera |
| **Molino** | Molino pequeno de piedra, aspas simples | Molino grande con aspas elaboradas | Piedra gris + madera |
| **Aserradero** | Mesa de cortar con sierra basica | Edificio con sierra mecanica grande | Madera + metal |
| **Herreria** | Yunque simple con martillo | Forja completa con chimenea humeante | Metal oscuro + fuego naranja |
| **Establo** | Cercado pequeno de madera | Establo grande con heno visible | Madera calida + heno dorado |

**Zona Defensiva (fondo piedra/gris):**
| Edificio | Nivel 1 | Nivel Max | Color |
|----------|---------|-----------|-------|
| **Muralla** | Muro bajo de piedra | Muralla alta con almenas y antorchas | Piedra gris oscuro |
| **Torre** | Torre pequena de piedra | Torre alta con balcon y bandera | Piedra + bandera roja |
| **Cuartel** | Tienda militar simple | Edificio de piedra con estandartes | Piedra + rojo militar |
| **Trampas** | Pinchos basicos en el suelo | Red de trampas con mecanismos | Metal + madera |

**Zona Social (fondo calido/acogedor):**
| Edificio | Nivel 1 | Nivel Max | Color |
|----------|---------|-----------|-------|
| **Taberna** | Casita con jarro de cerveza en cartel | Taberna grande con musica y luces | Madera calida + luces amarillas |
| **Mercado** | Puesto con toldo simple | Bazar con multiples puestos y banderas | Toldos coloridos + oro |
| **Embajada** | Casa noble pequena | Palacio diplomatico con banderas de facciones | Piedra blanca + banderas |

**Zona Noble (fondo lujoso/dorado):**
| Edificio | Nivel 1 | Nivel Max | Color |
|----------|---------|-----------|-------|
| **Salon del Trono** | Sala simple con silla | Salon enorme con trono dorado | Oro + piedra + alfombra roja |
| **Biblioteca** | Estante con pocos libros | Biblioteca enorme con estantes llenos | Madera oscura + libros coloridos |

**Formato:** 256x256px cada nivel, fondo transparente, pixel art, vista isometrica o frontal

### 3.4 TROPAS (5 tipos)

Cada tropa necesita sprites de **personaje chibi** como los existentes (~205x341px):

| Tropa | Descripcion Visual | Arma | Armadura | Color dominante |
|-------|-------------------|------|----------|-----------------|
| **Milicia** | Campesino con equipo basico | Espada corta oxidada | Cota de cuero marron | Marron `#8B4513` |
| **Arquero** | Tirador agil con capucha | Arco y flechas en espalda | Cuero verde/marron | Verde `#556B2F` |
| **Caballeria** | Guerrero pesado (sin caballo visible, es chibi) | Lanza larga | Armadura completa plateada | Plateado `#C0C0C0` |
| **Lancero** | Soldado defensivo con escudo | Lanza + escudo grande | Armadura media | Azul `#4682B4` |
| **Ariete** | Ingeniero/operador (no el ariete en si) | Martillo grande | Delantal de herrero, casco | Marron oscuro `#654321` |

**Formato:** ~205x341px, fondo transparente, pixel art chibi (misma proporcion que personajes existentes)

### 3.5 NPCS PARA MISIONES

Los NPCs del tablon de misiones. Necesitan variedad para dar vida al mundo:

| NPC | Rol | Apariencia | Que pide |
|-----|-----|-----------|----------|
| **Aldeano** | Granjero local | Sombrero de paja, ropa simple | Cultivos basicos |
| **Panadero** | Artesano de comida | Gorro de chef, delantal blanco | Pan, harina, huevos |
| **Herrero** | Artesano de metal | Musculos, delantal de cuero, martillo | Lingotes, hierro |
| **Mercader** | Comerciante viajero | Turbante o sombrero, capa, bolsas | Oro, items raros |
| **Noble** | Aristrocata | Corona pequena, ropa elegante | Items de lujo, reliquias |
| **Mago** | Hechicero | Tunica azul/purpura, baston, barba | Cristales, pociones |
| **Capitan** | Militar | Armadura con capa, espada | Armas, tropas |
| **Curandero** | Sanador | Tunica blanca, bolsa de hierbas | Hierbas, pociones |

**Formato:** ~205x341px cada uno, pixel art chibi, misma proporcion que los personajes existentes

### 3.6 RECURSOS E ITEMS

**Items de inventario** (256x256px, fondo transparente):

| Item | Descripcion Visual | Color |
|------|-------------------|-------|
| **Trigo** (recurso) | Manojo de espigas doradas | Dorado |
| **Madera** | Troncos apilados | Marron claro |
| **Piedra** | Rocas grises apiladas | Gris |
| **Hierro** | Mineral gris azulado con brillo metalico | Gris azulado |
| **Agua** | Gota o balde de agua azul | Azul claro |
| **Pan** | Hogaza de pan dorada | Marron dorado |
| **Tablas** | Tablones de madera cortada | Marron claro |
| **Lingotes** | Barras de metal apiladas | Gris plateado |
| **Harina** | Saco de tela con polvo blanco | Blanco/crema |
| **Queso** | Rueda de queso amarillo | Amarillo |
| **Cristal** | Gema brillante azul/purpura con destellos | Azul/purpura |
| **Reliquia** | Amuleto antiguo dorado con gemas | Dorado + gemas |
| **Plano** | Pergamino enrollado con dibujo tecnico | Beige + tinta |
| **Oro** (moneda) | Moneda redonda dorada con estrella | Dorado brillante |
| **KH Token** | Moneda especial purpura con "KH" grabado | Purpura `#8B5CF6` + dorado |

### 3.7 FACCIONES (4 banderas/escudos)

Cada faccion necesita un **escudo/emblema** (256x256px):

| Faccion | Nombre | Simbolo | Colores | Descripcion |
|---------|--------|---------|---------|-------------|
| **Caballeros del Alba** | Knights of Dawn | Sol naciente | Dorado `#FFD700` + blanco | Escudo con sol radiante, noble y luminoso |
| **Mercaderes de la Sombra** | Shadow Merchants | Luna creciente | Purpura oscuro `#4B0082` + plata | Escudo con luna y monedas, misterioso |
| **Legion de Hierro** | Iron Legion | Espadas cruzadas | Rojo oscuro `#8B0000` + gris metal | Escudo agresivo con espadas, imponente |
| **Guardianes Verdes** | Green Wardens | Arbol/hoja | Verde `#228B22` + marron | Escudo natural con arbol frondoso, organico |

### 3.8 INTERFAZ Y UI

**Elementos de UI necesarios** (256x256px):

| Elemento | Descripcion |
|----------|-------------|
| **Boton de cosecha** | Mano recogiendo planta, brillo dorado |
| **Boton de construir** | Martillo + ladrillos |
| **Boton de atacar** | Espada cruzada con destello |
| **Boton de comerciar** | Balanza o monedas intercambiandose |
| **Icono de mision** | Pergamino con sello de cera |
| **Icono de victoria** | Trofeo dorado con destellos |
| **Icono de derrota** | Escudo roto |
| **Icono de nivel arriba** | Flecha dorada hacia arriba con estrella |
| **Icono de estrella XP** | Estrella azul brillante |
| **Fondo de dialogo** | Panel de madera/pergamino con bordes decorados |
| **Barra de vida** | Corazon rojo (lleno a vacio) |
| **Barra de hambre** | Hueso (para animales) |

### 3.9 FONDOS Y AMBIENTACION

**Fondos de seccion** (para headers o paneles, ~1024x256px):

| Fondo | Descripcion |
|-------|-------------|
| **Granja** | Campo verde con cerca de madera, cielo celeste, nubes suaves |
| **Castillo** | Murallas de piedra, torres, estandartes al viento |
| **Comercio** | Mercado medieval con toldos coloridos, cajas y barriles |
| **Guerra** | Campo de batalla, humo, banderas rotas |
| **Token** | Boveda con monedas y cofres, luces doradas |

---

## 4. ESPECIFICACIONES TECNICAS PARA GENERACION

### Formato de Sprite Sheets
```
Tamano de sheet: 1024x1024px
Grid de items/botones: 4x4 (cada celda 256x256px)
Grid de personajes: 5x3 (cada celda ~205x341px)
Fondo: TRANSPARENTE (PNG con alpha)
Estilo: Pixel art, bordes definidos, cel-shading simple
Anti-aliasing: NO (pixeles limpios, image-rendering: pixelated)
```

### Requisitos de Consistencia
1. **Mismo nivel de detalle** que los sprites existentes (no hiperrealista, no demasiado simple)
2. **Misma paleta de colores** (tonos calidos medievales, nunca neon o futurista)
3. **Misma proporcion chibi** para personajes (cabeza grande ~40% del cuerpo)
4. **Contornos oscuros** consistentes en todos los sprites (1-2px de borde)
5. **Sombras simples** (drop shadow abajo, no sombras complejas)
6. **Vista frontal** para personajes, **vista 3/4 o frontal** para edificios e items
7. **Sin texto** dentro de los sprites (los labels van en la UI)

### Prioridad de Generacion
1. **CRITICA:** Cultivos (4 estados x 7 tipos = 28 sprites)
2. **CRITICA:** Animales (3 estados x 3 tipos = 9 sprites)
3. **ALTA:** Recursos/items (15 items de inventario)
4. **ALTA:** Edificios (14 tipos x 3 niveles = 42 sprites)
5. **MEDIA:** Tropas (5 personajes chibi)
6. **MEDIA:** Facciones (4 escudos)
7. **BAJA:** NPCs adicionales (8 personajes)
8. **BAJA:** Fondos y UI extras

---

## 5. EJEMPLOS DE PROMPT PARA IA DE IMAGENES

### Para cultivos:
```
"Pixel art sprite sheet, 4x4 grid, 256px cells, transparent background.
Medieval farming game items. Each row is one crop in 4 growth stages
(seed, sprout, growing, ready to harvest with golden glow).
Row 1: Wheat (golden stalks). Row 2: Carrot (orange root).
Row 3: Tomato (red fruit). Row 4: Pumpkin (large orange).
Chibi cute style, dark outlines, warm medieval color palette,
cel-shading, no anti-aliasing, clean pixel edges."
```

### Para personajes/tropas:
```
"Pixel art character sprite sheet, 5 columns x 1 row, ~205x341px each cell,
transparent background. Medieval fantasy chibi soldiers.
Left to right: Militia (leather armor, short sword), Archer (green hood, bow),
Cavalry (full plate armor, lance), Spearman (blue armor, shield+spear),
Engineer (work apron, large hammer). Big heads, small bodies, cute expressions,
dark outlines, warm medieval palette, drop shadows."
```

### Para edificios:
```
"Pixel art building sprite sheet, 4x3 grid, 256px cells, transparent background.
Medieval castle buildings at 3 upgrade levels (columns = levels 1, 2, 3).
Row 1: Barn (wood, red roof → large barn with silo).
Row 2: Windmill (small stone → grand windmill).
Row 3: Blacksmith (anvil → full forge with chimney).
Row 4: Barracks (tent → stone military building).
Isometric or front view, warm colors, pixel art, dark outlines."
```

### Para items/recursos:
```
"Pixel art item icons, 4x4 grid, 256px cells, transparent background.
Medieval game resource icons. Row 1: wheat bundle, wood logs, stone pile, iron ore.
Row 2: water bucket, bread loaf, wood planks, metal ingots.
Row 3: flour sack, cheese wheel, blue crystal gem, golden relic amulet.
Row 4: blueprint scroll, gold coin, purple KH token coin, treasure chest.
Clean pixel art, dark outlines, warm colors, no anti-aliasing."
```

---

## 6. REFERENCIA: SPRITES EXISTENTES

Los siguientes sprites YA EXISTEN y sirven como referencia de estilo:

### Buttons_00005_.png (UI/Edificios)
```
[X Close] [< Back ] [Castle ] [Tower  ]
[Backpck] [Barn   ] [Bag    ] [Gate   ]
[Market ] [Farm   ] [!Alert ] [Castle2]
[Scroll ] [Medal  ] [Gears  ] [Config ]
```

### Items_00004_.png (Items/Recursos)
```
[Beet   ] [Bread  ] [WatCan ] [Strawby]
[Wand   ] [Key    ] [Milk   ] [Sunflwr]
[Potion ] [Egg    ] [Flower2] [Blueprt]
[Heart  ] [Cookie ] [Cotton ] [Bluepr2]
```

### Character_00003_.png (Personajes)
```
[Farmer ] [Mage   ] [Knight ] [Guard  ] [Wizard ]
[Baker  ] [Princes] [Explrer] [Witch  ] [Warrior]
[FarmGrl] [Travlr ] [Adventr] [Ranger ] [      ]
```

Todos en estilo pixel art chibi con contornos oscuros, colores calidos medievales,
proporciones exageradas (cabeza grande), expresiones simples y amigables.
