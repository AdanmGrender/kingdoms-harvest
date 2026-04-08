# Kingdoms Harvest - Game Design Document

## Concepto
**Kingdoms Harvest** es un juego para Telegram Mini Apps que combina mecánicas de granja/comercio estilo Stardew Valley con guerra de castillos y sistema de facciones.

El jugador es un señor feudal que debe hacer crecer su aldea mediante la agricultura y el comercio, mientras defiende su territorio y se expande conquistando tierras con su facción.

---

## Game Loop Principal

```
GRANJA → RECURSOS → COMERCIO → ORO/XP
                  ↓
          CONSTRUCCIÓN → TROPAS → GUERRA → TERRITORIOS
                  ↑                              ↓
                  ←──── RECURSOS RAROS ←─────────
```

**Clave:** Sin granja no hay economía para la guerra. Sin guerra no hay tierras raras ni expansión.

---

## Sistemas de Juego

### 1. Sistema de Recursos (Multicapa)

| Categoría | Recursos | Obtención |
|-----------|----------|-----------|
| Básicos | Trigo, Madera, Piedra, Hierro, Agua | Cultivos, edificios |
| Procesados | Pan, Tablas, Lingotes, Harina, Queso | Molino, Aserradero, Herrería |
| Raros | Cristales, Reliquias, Planos | Misiones, exploración, conquista |
| Moneda | Oro | Comercio, misiones, batalla |

### 2. Sistema de Granja

- **Parcelas de cultivo** con ciclos de crecimiento en tiempo real
- **7 tipos de cultivos** con tiempos de 20 min a 3 horas
- **Sistema de estaciones** (rotación semanal): Primavera, Verano, Otoño, Invierno
- **Calidad**: Normal (60%), Bueno (30%), Excelente (10%) - afecta rendimiento
- **Fertilizante**: +15% chance de mejor calidad
- **Animales**: Gallinas (huevos), Vacas (leche), Ovejas (lana)
  - Requieren alimentación para producir
  - Alojados en Establos con capacidad limitada

### 3. Sistema de Construcción

**4 zonas del castillo:**

| Zona | Edificios | Función |
|------|-----------|---------|
| Agrícola | Parcela, Granero, Molino, Aserradero, Herrería, Establo | Producción |
| Defensiva | Muralla, Torre, Cuartel, Trampas | Protección |
| Social | Taberna, Mercado, Embajada | Comercio/Misiones |
| Noble | Salón del Trono, Biblioteca | Progresión/Tech |

- Cada edificio tiene niveles (max 3-15 según tipo)
- Costos escalan con multiplicador por nivel
- Solo 1 construcción simultánea

### 4. Misiones y Comercio (Estilo Stardew)

**Tablón de Pedidos:**
- NPCs del reino piden combinaciones de items
- Misiones normales (24h) y urgentes (2h, +50% recompensa)
- Cantidad de misiones = nivel de Taberna + 1
- Rewards: Oro, XP, chance de items raros

**Caravanas Comerciales:**
- Llegan cada 4 horas con ofertas variables
- Precios fluctúan (80%-200% del precio base)
- Permite especulación comprando barato/vendiendo caro

**Venta Rápida:**
- Siempre disponible al 70% del precio base

### 5. Sistema Militar

**Tropas (5 tipos):**

| Tropa | ATK | DEF | HP | Fuerte vs | Débil vs |
|-------|-----|-----|-----|-----------|----------|
| Milicia | 10 | 8 | 50 | - | Caballería |
| Arquero | 15 | 5 | 35 | Milicia | Caballería |
| Caballería | 20 | 12 | 80 | Arquero, Milicia | Lancero |
| Lancero | 12 | 15 | 60 | Caballería | Arquero |
| Ariete | 50 | 5 | 150 | Murallas | Arquero, Caballería |

**Motor de Combate:**
- Cálculo automático basado en stats + composición
- Bonus por tipos (piedra-papel-tijera): +30% vs tipo débil, -30% vs tipo fuerte
- Bonus defensivo por murallas, torres, trampas
- Factor aleatorio ±10%
- Pérdidas proporcionales al resultado

**Modos:**
- **PvE:** Ataque a aldeas NPC → recursos raros
- **PvP:** Ataque a otros jugadores → roba 10% recursos
- **Guerra de Facción:** Batallas por territorios en mapa global

### 6. Facciones

| Facción | Bonus |
|---------|-------|
| Caballeros del Alba ☀️ | +10% defensa |
| Mercaderes de la Sombra 🌙 | +15% comercio |
| Legión de Hierro 🛡️ | +10% ataque |
| Guardianes Verdes 🌳 | +15% producción agrícola |

- Requiere Embajada para unirse
- Puntos de facción por contribuir
- Guerras por territorios en mapa compartido

### 7. Tech Tree (Biblioteca)

3 ramas de investigación:
- **Agricultura:** Mejor rendimiento, menos tiempo, invernadero
- **Comercio:** Mejores precios, más misiones, rutas lejanas
- **Militar:** +ATK, +DEF, tácticas, tropas élite

---

## Stack Técnico

| Componente | Tecnología |
|------------|-----------|
| Frontend | React + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Base de datos | SQLite (better-sqlite3 + Knex) |
| Real-time | Socket.io |
| Bot | node-telegram-bot-api |
| Game loop | node-cron (tick cada 60s) |
| State mgmt | Zustand |

---

## Monetización (Opcional)

- Acelerar timers de construcción/entrenamiento
- Skins cosméticos para castillo y granja
- Pase de temporada con misiones extra
- **Nunca pay-to-win en combate**

---

## Sistema de KH Tokens (Crypto/Faucet)

### Economía Híbrida
- **Token especial: KH Token** — se farmea jugando, se retira como TON
- **Drip pasivo**: cada cosecha (+2 KH), misión (+5), batalla PvE (+3), PvP (+8), venta (+1)
- **Quema de recursos**: gold (500→5 KH), crystal (1→10), relic (1→15), blueprint (1→12)
- **Cap diario**: 50 base + 10 por nivel del jugador
- **Streak multiplier**: Día 7=2x, Día 14=2.5x, Día 21=3x, Día 30=5x

### Sistema de Referidos (Single-tier)
- Invitador gana 25 KH + 5% ongoing de lo que gana el referido
- Referido gana 10 KH de bienvenida
- Deep link: `t.me/kingdomharvestbot?start=ref_PLAYER_ID`
- Comisión solo fluye cuando referido alcanza nivel 3

### Tareas Diarias + Sociales
- 5 tareas diarias (cosechas, ventas, batallas, misiones, login) → tokens al completar
- Tareas sociales one-time: unirse al canal, invitar 1/5/10 amigos
- Progreso trackeado server-side (anti-cheat)

### Retiro (Faucet → TON)
- Mínimo 500 KH, nivel 5+, cuenta de 7+ días
- Cooldown 24h entre retiros
- Fee 5%
- Rate: 1 KH = 0.0001 TON (configurable)
- Hot wallet server-side, procesamiento cada 5 minutos

---

## Roadmap

### Fase 1 (MVP) ← ACTUAL
- [x] Sistema de granja (cultivos + animales)
- [x] Construcción de edificios
- [x] Misiones de venta (tablón de pedidos)
- [x] Caravanas comerciales
- [x] Sistema de tropas y combate PvE
- [x] Bot de Telegram con Mini App
- [x] UI mobile-first

### Fase 2
- [ ] Combate PvP funcional
- [ ] Sistema de facciones completo
- [ ] Mapa de territorios
- [ ] Tech tree funcional
- [ ] Notificaciones push via bot

### Fase 3
- [ ] Guerras de facción
- [ ] Rankings y torneos
- [ ] Eventos especiales (por estación)
- [ ] Sistema de logros
- [ ] Trading entre jugadores

### Fase 4
- [ ] Gráficos pixel art / isométricos
- [ ] Animaciones con Pixi.js/Canvas
- [ ] Sistema de alianzas
- [ ] Calabozos cooperativos
