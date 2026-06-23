# 🏰 KINGDOMS HARVEST — Plan Maestro de Desarrollo
## Objetivo: City-Builder Medieval Mobile de Calidad Profesional

> **Referencia visual:** Whiteout Survival / Last War / Age of Empires Mobile / Rimworld
> **Plataforma:** Telegram Mini App (mobile-first)
> **Stack actual:** React + Phaser 3 + Node.js/Express + SQLite

---

## 📊 ANÁLISIS DE LA REFERENCIA

### Lo que tiene el juego de referencia:

**Visual (Prioridad CRÍTICA):**
- Vista isométrica/3D con perspectiva 3/4
- Edificios renderizados en alta calidad (estilo painted/ilustrado)
- Terreno con profundidad: rocas, acantilados, niebla atmosférica
- Árboles 3D con sombras proyectadas
- Iluminación dinámica (ventanas brillando, antorchas)
- Indicadores de nivel en cada edificio (Nv. 5, flechas verdes ↑)
- Partículas de humo, polvo, efectos de construcción

**UI/UX (Prioridad ALTA):**
- Barra superior: recursos (madera, piedra, comida) con iconos + cantidades
- Avatar del jugador (esquina superior izquierda) con nivel y VIP
- Panel lateral derecho: botones de eventos (Evento de valor, Evento especial, Asedio)
- Barra inferior: Héroes | Mundo (tabs principales)
- Popup al seleccionar edificio: nombre, nivel, botones "Mejorar" y "Sobreviviente"
- Iconos de Alianza, Correo, Bolsa, Estrellas en lateral derecho
- Timer de countdown visible (00:17:16)
- Notificaciones con badges rojos (2, 5, 58)

**Sistemas de juego (Prioridad MEDIA):**
- Edificios con niveles (mejorables)
- Sistema de héroes
- Alianzas/gremios
- Eventos temporales rotativos
- Asedio a ciudades (PvP)
- Sistema VIP
- Correo/mensajería
- Mapa mundial
- Bolsa/inventario
- Sistema de estrellas/ratings

---

## 🗺️ ROADMAP EN 6 FASES

### ═══════════════════════════════════════
### FASE 1: FUNDACIÓN VISUAL (4-6 semanas)
### ═══════════════════════════════════════

**Objetivo:** Pasar de sprites pixel art a estilo isométrico ilustrado de alta calidad.

#### 1.1 — Migrar perspectiva a Isométrica

**Estado actual:** Vista top-down plana con tiles 32x32
**Objetivo:** Vista isométrica 2:1 (como la referencia)

**Tareas:**
- Cambiar el sistema de renderizado de Phaser de orthogonal a isometric
- Implementar `Phaser.Tilemaps.Formats.ISOMETRIC` o isometric plugin
- Crear nuevo `IsometricMapRenderer.js` que reemplace `MapGenerator.js`
- Tiles isométricos de 64x32 (diamond shape) o 128x64 para alta resolución
- Implementar depth sorting automático (objetos más abajo = más adelante)
- Sistema de cámara isométrica con zoom y pan (reescribir `CameraSystem.js`)

**Archivos a crear/modificar:**
```
client/src/game/maps/IsometricMap.js          ← NUEVO
client/src/game/systems/IsoCameraSystem.js    ← NUEVO
client/src/game/systems/IsoSelectionSystem.js ← NUEVO
client/src/game/scenes/WorldScene.js          ← REFACTOR MAYOR
```

**Riesgo:** ALTO — es el cambio más grande del proyecto. Considerar usar Phaser 3 isometric plugin o migrar a PixiJS con librería isométrica.

#### 1.2 — Arte de edificios estilo ilustrado

**Estado actual:** Pixel art top-down 64x64
**Objetivo:** Edificios isométricos painted 128x128 o 256x256

**Opciones de generación:**
1. **IA (Flux/SDXL):** Generar buildings isométricos con prompts específicos
2. **Assets packs:** Comprar/descargar packs isométricos (itch.io, GameDevMarket)
3. **Artista freelance:** Comisionar un artista en Fiverr/ArtStation
4. **Recomendación:** Combinar IA + retoque manual para consistencia

**Edificios necesarios (16+):**
- Castle/Town Hall (3-4 niveles visuales)
- Granero, Molino, Establo, Aserradero
- Herrería, Cuartel, Torre de vigilancia, Muralla
- Mercado, Taberna, Biblioteca, Embajada
- Granja (parcelas de cultivo)
- Trampa/defensa, Placeholder de construcción

**Para cada edificio:**
- Sprite base + variante por nivel (al menos 3 niveles visuales)
- Animación idle (humo de chimenea, molino girando, etc.)
- Indicador de nivel superpuesto (badge numérico)
- Flecha verde de "mejorable"
- Efecto de "en construcción" (scaffolding)

#### 1.3 — Terreno isométrico

**Tiles isométricos necesarios:**
- Grass (4+ variantes con transiciones)
- Dirt/caminos
- Piedra/cobblestone
- Agua con animación
- Arena
- Rocas/acantilados como en la referencia (elementos 3D grandes)
- Bordes/cercas en isométrico
- Árboles isométricos (pinos como los de la referencia)

**Transiciones:**
- Implementar sistema de autotile para bordes grass↔dirt, grass↔stone, etc.
- Usar Wang tiles o terrain brush para transiciones suaves

#### 1.4 — Efectos atmosféricos

- Niebla en bordes del mapa (fog of war estilo)
- Partículas de polvo/hojas flotando
- Sombras proyectadas de edificios y árboles
- Iluminación: ventanas que brillan, antorchas con glow
- Ciclo día/noche más dramático (ya existe `DayNightSystem.js`)


### ═══════════════════════════════════════
### FASE 2: UI PROFESIONAL (3-4 semanas)
### ═══════════════════════════════════════

**Objetivo:** Replicar la UI móvil profesional de la referencia.

#### 2.1 — HUD Superior (Resource Bar)

**Componente:** `TopResourceBar.jsx`

**Layout:**
```
┌──────────────────────────────────────────┐
│ [Avatar]  🪵 3.65M  🪨 2.37M  🌿 1.21M │  [💎 4,156]
│ [Nv.110]  ⚔️ 2,897,464                   │
│ [VIP 1]                                    │
└──────────────────────────────────────────┘
```

**Funcionalidad:**
- Avatar del jugador con borde de nivel (click → perfil)
- 3-4 recursos principales con iconos animados
- Poder militar total
- Badge VIP
- Gemas/premium currency (esquina derecha)
- Auto-actualización via Socket.IO

#### 2.2 — Panel Lateral Derecho (Event Sidebar)

**Componente:** `EventSidebar.jsx`

**Botones apilados verticalmente:**
- 🎁 Paquete de nuevo servidor (con timer)
- 💰 1ª recarga (premium)
- ⚔️ Evento de valor
- ✅ Evento especial
- 🏰 Asedio a la ciudad

**Cada botón:**
- Icono ilustrado
- Texto descriptivo
- Badge rojo con contador de notificaciones
- Timer countdown si aplica
- Animación de "nuevo" (pulse/glow)

#### 2.3 — Barra Inferior (Bottom Navigation)

**Componente:** `BottomNavBar.jsx`

**Layout:**
```
┌────────────────────────────────────┐
│ [🦸 Héroes]  [... centro ...]  [🗺️ Mundo] │
└────────────────────────────────────┘
```

**Tabs principales:**
- **Héroes:** Abre panel de gestión de héroes
- **Mundo:** Cambia a vista de mapa mundial (overworld)

#### 2.4 — Panel Lateral Izquierdo (Quick Actions)

**Componente:** `QuickActionsSidebar.jsx`

**Botones:**
- 🏠 Ir al castillo (centrar cámara)
- ⚙️ Configuración
- ❓ Ayuda/misiones
- 🦅 Explorar
- 🔧 Herramientas

**Con badges de notificación rojos.**

#### 2.5 — Panel Lateral Derecho Inferior

**Componente:** `SocialSidebar.jsx`

**Botones:**
- ⭐ Estrellas (logros)
- 🤝 Alianza
- 📧 Correo (badge: 58)
- 🎒 Bolsa

#### 2.6 — Popup de Edificio Seleccionado

**Componente:** `BuildingInfoPopup.jsx`

**Cuando el jugador toca un edificio:**
```
┌──────────────────────┐
│   Nv. 5              │
│   Depósito de madera │
│                      │
│ [👤 Sobreviviente] [⬆️ Mejorar] │
└──────────────────────┘
```

**Campos:**
- Nombre del edificio
- Nivel actual
- Icono del edificio
- Botón "Info/Sobreviviente" → abre panel detallado
- Botón "Mejorar" → abre panel de upgrade con costos
- Timer si está en construcción/mejora
- Barra de progreso

#### 2.7 — Timer de Construcción Global

**Componente:** `ConstructionTimer.jsx`

**Sticky en pantalla:**
- Muestra la construcción/mejora activa
- Countdown (00:17:16)
- Botón de speedup (con gemas)
- Icono del edificio en construcción
- Barra de progreso


### ═══════════════════════════════════════
### FASE 3: SISTEMAS CORE (4-5 semanas)
### ═══════════════════════════════════════

#### 3.1 — Sistema de Niveles de Edificios

**Server:** `server/src/services/buildingService.js`

**Cada edificio tiene:**
- `level` (1-30)
- `upgrade_cost` (escala exponencial por recurso)
- `upgrade_time` (escala exponencial, minutos→horas→días)
- `production_rate` (escala con level)
- `visual_tier` (1-3, determina qué sprite mostrar)
- `requirements` (Town Hall level, otros buildings)

**Tabla de mejora ejemplo:**
```
Level | Wood   | Stone  | Time    | Visual
1     | 100    | 50     | 1 min   | Tier 1
5     | 2,500  | 1,200  | 30 min  | Tier 1
10    | 25,000 | 12,000 | 4 hrs   | Tier 2
15    | 150K   | 75K    | 12 hrs  | Tier 2
20    | 500K   | 250K   | 1 día   | Tier 3
25    | 2M     | 1M     | 3 días  | Tier 3
```

**Restricciones:**
- Solo 1 construcción/mejora simultánea (2 con VIP)
- Town Hall debe ser >= nivel del edificio a mejorar
- Speedup con gemas (1 gema = 1 minuto)

#### 3.2 — Sistema de Héroes

**Nuevos archivos:**
```
server/src/services/heroService.js
server/src/routes/heroRoutes.js
server/src/models/hero.js
client/src/components/heroes/HeroPanel.jsx
client/src/components/heroes/HeroCard.jsx
client/src/components/heroes/HeroDetail.jsx
shared/heroConfig.js
```

**Mecánicas:**
- 8-12 héroes desbloqueables
- Cada héroe tiene: nombre, clase, stats (ATK/DEF/HP), habilidades
- Niveles (1-60) via XP
- Estrellas/ascensión (1★ a 6★)
- Equipamiento (arma, armadura, accesorio)
- Asignación a edificios (boost producción) o ejército (boost combate)

**Héroes iniciales:**
- 🗡️ Aldric (Guerrero) — boost combate melee
- 🏹 Brynn (Arquera) — boost combate rango
- 🌾 Cedric (Granjero) — boost producción comida
- 🔮 Morgana (Maga) — boost investigación
- 🛡️ Godfrey (Tanque) — boost defensa

#### 3.3 — Sistema de Alianzas

**Nuevos archivos:**
```
server/src/services/allianceService.js
server/src/routes/allianceRoutes.js
client/src/components/alliance/AlliancePanel.jsx
client/src/components/alliance/AllianceChat.jsx
client/src/components/alliance/AllianceMembers.jsx
```

**Funcionalidad:**
- Crear/unirse a alianza
- Chat de alianza (via Socket.IO)
- Ayuda de alianza (reducir timers de miembros)
- Tecnología de alianza (upgrades compartidos)
- Guerra de alianzas (GvG)
- Ranking de alianzas

#### 3.4 — Sistema de Eventos

**Nuevos archivos:**
```
server/src/services/eventService.js
server/src/routes/eventRoutes.js
client/src/components/events/EventPanel.jsx
client/src/components/events/EventCard.jsx
shared/eventConfig.js
```

**Tipos de eventos:**
- **Evento de valor:** Puntos por actividad → recompensas tier
- **Evento especial:** Desafío temporal (7 días)
- **Asedio:** PvP masivo (alianza vs alianza)
- **Login diario:** Calendario de recompensas
- **Primer recarga:** Bonus por primera compra

#### 3.5 — Mapa Mundial

**Nuevos archivos:**
```
client/src/game/scenes/WorldMapScene.js
client/src/components/worldmap/WorldMapUI.jsx
server/src/services/worldMapService.js
```

**Funcionalidad:**
- Vista alejada del "mundo" con múltiples reinos
- Tu ciudad es un punto en el mapa
- Otros jugadores visibles
- Recursos en el mapa para recolectar
- Monstruos/NPCs para atacar
- Territorio de alianzas coloreado


### ═══════════════════════════════════════
### FASE 4: MONETIZACIÓN (2-3 semanas)
### ═══════════════════════════════════════

#### 4.1 — Tienda In-App

**Componente:** `ShopPanel.jsx`

**Secciones:**
- 💎 Gemas (paquetes: 100/500/2000/5000)
- 📦 Paquetes de recursos
- 🎁 Paquete de nuevo jugador (oferta limitada)
- 🌟 VIP (suscripción mensual)
- ⚡ Speed-ups

#### 4.2 — Sistema VIP

**Niveles VIP 1-10:**
- VIP 1: 2da cola de construcción
- VIP 3: Auto-recolección de recursos
- VIP 5: Marcha extra de tropas
- VIP 8: Escudo de 8 horas gratis/día
- VIP 10: Héroe exclusivo

#### 4.3 — Ads con Recompensa (ya planificado)

- Integrar Adsgram SDK
- Popup de recompensa post-acciones
- Cooldown anti-abuse

#### 4.4 — Tokens KH → TON (ya parcialmente implementado)

- Completar integración TON Connect
- UI de withdrawal
- Dashboard de economía


### ═══════════════════════════════════════
### FASE 5: SOCIAL Y ENGAGEMENT (3-4 semanas)
### ═══════════════════════════════════════

#### 5.1 — Sistema de Correo

**Componente:** `MailPanel.jsx`

**Tipos:**
- Sistema (recompensas, mantenimiento)
- Alianza (noticias del gremio)
- Batalla (reportes de combate)
- Personal (mensajes entre jugadores)

#### 5.2 — Logros y Estrellas

- Panel de logros con categorías
- Sistema de "estrellas" por completar milestones
- Recompensas progresivas

#### 5.3 — Perfil de Jugador

**Componente:** `PlayerProfile.jsx`

- Avatar personalizable
- Estadísticas (poder, victorias, recursos totales)
- Héroes desbloqueados
- Nivel de VIP
- Alianza actual
- Marco de avatar por logros

#### 5.4 — Rankings/Leaderboard

- Ranking individual (poder total)
- Ranking de alianzas
- Ranking por temporada de evento


### ═══════════════════════════════════════
### FASE 6: PULIDO Y LANZAMIENTO (2-3 semanas)
### ═══════════════════════════════════════

#### 6.1 — Onboarding/Tutorial

- Tutorial interactivo paso a paso
- Misiones guiadas para los primeros 30 minutos
- Tooltips en primera interacción con cada sistema
- Recompensas de tutorial generosas

#### 6.2 — Performance

- Lazy loading de assets
- Object pooling para entidades del mapa
- Frustum culling (solo renderizar lo visible)
- Compresión de texturas (WebP)
- Bundle splitting del client
- CDN para assets estáticos

#### 6.3 — Testing

- Unit tests de servicios del server
- Integration tests de API
- Playtest con usuarios reales
- Load testing (simular 100+ jugadores simultáneos)
- Compatibilidad: Android Chrome, iOS Safari, Telegram WebView

#### 6.4 — Deploy

- Server en VPS (ya configurado)
- CI/CD pipeline
- Monitoreo (logs, errores, métricas)
- Backups automáticos de DB
- Rate limiting y anti-cheat


---

## 📐 ARQUITECTURA FINAL

```
kingdoms-harvest/
├── client/
│   ├── public/
│   │   └── assets/
│   │       ├── game/
│   │       │   ├── buildings/         ← Isométricos por nivel
│   │       │   │   ├── barn_lv1.png
│   │       │   │   ├── barn_lv2.png
│   │       │   │   └── barn_lv3.png
│   │       │   ├── terrain/           ← Tiles isométricos
│   │       │   ├── characters/        ← Heroes + NPCs
│   │       │   ├── effects/           ← Partículas, humo
│   │       │   └── ui/               ← Iconos, frames
│   │       └── ui/                    ← Iconos de React UI
│   └── src/
│       ├── game/
│       │   ├── scenes/
│       │   │   ├── BootScene.js
│       │   │   ├── CityScene.js       ← Reemplaza WorldScene
│       │   │   └── WorldMapScene.js   ← NUEVO: Mapa mundial
│       │   ├── systems/
│       │   │   ├── IsoCameraSystem.js ← NUEVO
│       │   │   ├── IsoSelection.js    ← NUEVO
│       │   │   ├── BuildingSystem.js  ← NUEVO: Gestión visual
│       │   │   ├── DayNightSystem.js
│       │   │   └── ParticleSystem.js
│       │   ├── maps/
│       │   │   └── IsometricMap.js    ← NUEVO
│       │   └── entities/
│       │       ├── IsoBuilding.js     ← NUEVO
│       │       ├── IsoCropPlot.js     ← NUEVO
│       │       └── IsoNPC.js          ← NUEVO
│       ├── components/
│       │   ├── hud/                   ← NUEVO
│       │   │   ├── TopResourceBar.jsx
│       │   │   ├── BottomNavBar.jsx
│       │   │   ├── QuickActions.jsx
│       │   │   ├── EventSidebar.jsx
│       │   │   ├── SocialSidebar.jsx
│       │   │   └── ConstructionTimer.jsx
│       │   ├── buildings/             ← NUEVO
│       │   │   ├── BuildingPopup.jsx
│       │   │   ├── UpgradePanel.jsx
│       │   │   └── BuildingInfo.jsx
│       │   ├── heroes/                ← NUEVO
│       │   │   ├── HeroPanel.jsx
│       │   │   ├── HeroCard.jsx
│       │   │   └── HeroDetail.jsx
│       │   ├── alliance/              ← NUEVO
│       │   │   ├── AlliancePanel.jsx
│       │   │   ├── AllianceChat.jsx
│       │   │   └── AllianceMembers.jsx
│       │   ├── events/                ← NUEVO
│       │   │   ├── EventPanel.jsx
│       │   │   └── EventCard.jsx
│       │   ├── shop/                  ← NUEVO
│       │   │   └── ShopPanel.jsx
│       │   ├── mail/                  ← NUEVO
│       │   │   └── MailPanel.jsx
│       │   ├── worldmap/              ← NUEVO
│       │   │   └── WorldMapUI.jsx
│       │   ├── profile/               ← NUEVO
│       │   │   └── PlayerProfile.jsx
│       │   ├── token/                 ← YA EXISTE
│       │   ├── combat/                ← YA EXISTE
│       │   └── overlay/               ← YA EXISTE
│       ├── store/
│       │   ├── gameStore.js           ← EXPANDIR
│       │   ├── heroStore.js           ← NUEVO
│       │   └── allianceStore.js       ← NUEVO
│       └── services/
│           ├── api.js                 ← EXPANDIR
│           ├── heroApi.js             ← NUEVO
│           └── allianceApi.js         ← NUEVO
├── server/
│   └── src/
│       ├── services/
│       │   ├── heroService.js         ← NUEVO
│       │   ├── allianceService.js     ← NUEVO
│       │   ├── eventService.js        ← NUEVO
│       │   ├── mailService.js         ← NUEVO
│       │   ├── shopService.js         ← NUEVO
│       │   ├── vipService.js          ← NUEVO
│       │   ├── worldMapService.js     ← NUEVO
│       │   └── ... (existentes)
│       ├── routes/
│       │   ├── heroRoutes.js          ← NUEVO
│       │   ├── allianceRoutes.js      ← NUEVO
│       │   ├── eventRoutes.js         ← NUEVO
│       │   └── ... (existentes)
│       └── migrations/
│           ├── XXX_heroes.js          ← NUEVO
│           ├── XXX_alliances.js       ← NUEVO
│           ├── XXX_events.js          ← NUEVO
│           ├── XXX_mail.js            ← NUEVO
│           └── XXX_vip.js             ← NUEVO
└── shared/
    ├── gameConfig.js                  ← EXPANDIR
    ├── heroConfig.js                  ← NUEVO
    ├── allianceConfig.js              ← NUEVO
    ├── eventConfig.js                 ← NUEVO
    └── tokenConfig.js                 ← YA EXISTE
```

---

## ⏱️ TIMELINE ESTIMADO

| Fase | Duración | Prioridad | Dependencias |
|------|----------|-----------|--------------|
| **FASE 1:** Visual Isométrico | 4-6 sem | 🔴 CRÍTICA | Ninguna |
| **FASE 2:** UI Profesional | 3-4 sem | 🔴 CRÍTICA | Fase 1 parcial |
| **FASE 3:** Sistemas Core | 4-5 sem | 🟡 ALTA | Fase 1 + 2 |
| **FASE 4:** Monetización | 2-3 sem | 🟡 ALTA | Fase 3 |
| **FASE 5:** Social/Engagement | 3-4 sem | 🟢 MEDIA | Fase 3 |
| **FASE 6:** Pulido/Launch | 2-3 sem | 🟢 MEDIA | Todo |
| **TOTAL** | **18-25 semanas** | | |

---

## 🎯 MVP RÁPIDO (8 semanas)

Si querés llegar a algo jugable rápido, este es el MVP mínimo:

### Semana 1-2: Visual
- Migrar a isométrico básico (sin animaciones complejas)
- 5 edificios isométricos principales (Town Hall, Granja, Cuartel, Mercado, Muralla)
- Terreno isométrico con 3 tipos de tile

### Semana 3-4: UI
- TopResourceBar
- BottomNavBar (Héroes + Mundo placeholder)
- BuildingPopup con "Mejorar"
- ConstructionTimer

### Semana 5-6: Sistemas
- Building levels (1-10 con costos)
- 3 héroes básicos
- Sistema de upgrade con timer

### Semana 7-8: Pulido
- Tutorial básico (5 pasos)
- Ads con recompensa
- Token integration
- Testing y deploy

---

## 💡 RECOMENDACIONES TÉCNICAS

### Para el arte isométrico:
1. **Mejor opción:** Usar IA (Flux/SDXL) para generar edificios isométricos y retocar manualmente
2. **Asset packs:** kenney.nl tiene isometric packs gratuitos, itch.io tiene packs premium ($10-50)
3. **Alternativa:** Mantener vista top-down pero con estilo painted (más rápido, menos riesgo)

### Para la UI:
1. Usar **shadcn/ui** como base de componentes
2. Diseñar mobile-first (320px mínimo)
3. Animaciones con **Framer Motion** para transiciones de panels
4. Iconos con **Lucide React** (ya disponible en artifacts)

### Para el server:
1. Migrar de sql.js a **better-sqlite3** (más rápido, persistente)
2. Implementar **Redis** para caché de sesiones y rate limiting
3. **Socket.IO rooms** por alianza para chat eficiente

### Para Telegram:
1. Usar **Telegram Mini App SDK** completo
2. Implementar **inline buttons** para notificaciones
3. **Bot notifications** para timers completados
4. **Telegram Payments API** para compras in-app

---

## 🚨 RIESGOS Y MITIGACIONES

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Migración isométrica rompe todo | ALTO | Hacer en branch separado, mantener fallback top-down |
| Arte inconsistente con IA | MEDIO | Definir style guide estricto, usar same seed/model |
| Performance en móvil | ALTO | Object pooling, frustum culling, lazy loading |
| Scope creep (demasiadas features) | ALTO | Seguir MVP → iterar, no agregar todo de golpe |
| sql.js pierde datos | ALTO | Migrar a better-sqlite3 o PostgreSQL |
| Telegram WebView bugs | MEDIO | Testear en Android + iOS real, no solo emulador |
