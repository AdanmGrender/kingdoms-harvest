# Kingdoms Harvest — Art Style Decision

> Status: **Experimenting** — `IsoWorldScene` is a side-by-side proof of concept.
> The current `WorldScene` (top-down grid) runs by default.

---

## Visual References

The reference games (Whiteout Survival, Castle & Dragon, similar mobile RTS) share these traits:
- Semi-realistic painted buildings viewed from a fixed elevated angle (~45°)
- Flat green/brown terrain with scattered buildings and decorative objects
- Depth conveyed through scale and overlapping sprites, not true perspective
- Dark, moody color palette — muted earth tones, no pure saturated primaries

---

## Option A — Current: Top-Down Grid (active)

| Attribute     | Value |
|---------------|-------|
| Projection    | Orthographic top-down |
| Tile size     | 32×32 px |
| Building size | 128×128 px |
| Depth sort    | Flat layers (ground / objects / UI) |
| Art source    | Placeholders (scripts/gen_placeholders.js) → arte de artista según docs/art-spec.md |

**Pros:** Simple coordinate math, easy pathfinding, no depth sorting ambiguity.  
**Cons:** Less depth, harder to convey the "3D city" feel of the references.

---

## Option B — Experiment: Isometric Pixel Art (ISO_MODE=true)

| Attribute     | Value |
|---------------|-------|
| Projection    | Isometric (2:1 ratio) |
| Tile size     | 64×32 px (diamond) |
| Building size | 128×128 px (reused, anchor adjusted) |
| Depth sort    | `depth = col + row + offset` per sprite |
| Art source    | Placeholders (scripts/gen_placeholders.js, sección iso) |
| Grid          | 32×32 tiles → ~2048×1024 px world |

**Pros:** Strong visual depth, matches reference game feel, classic strategy aesthetic.  
**Cons:** Coordinate math more complex, pathfinding needs iso-aware grid, touch hit testing trickier.

### Enabling the experiment

```js
// client/src/game/config.js — flag hardcodeado (ya NO se lee VITE_ISO_MODE)
export const ISO_MODE = true;
```

Then `cd client; npm run dev`. BootScene routes to `IsoWorldScene` instead of `WorldScene`.
Alternatively, URL `?iso=1` loads the legacy `IsoScene` POC (iso-rework branch).

---

## Tile Color Palette

| Tile         | Frame | Hex Fill | Notes |
|--------------|-------|----------|-------|
| Grass Dark   | 0     | `#364e22` | Forest floor, dense vegetation |
| Grass        | 1     | `#4a6830` | Standard ground |
| Grass Light  | 2     | `#587838` | Open meadow, tiny red flowers |
| Dirt         | 3     | `#785838` | Packed earth, roads |
| Stone        | 4     | `#646464` | Cobblestone, castle yard |
| Water        | 5     | `#1e4662` | Deep pools, moat |
| Sand         | 6     | `#b8922c` | Riverbed, desert edge |

Ground edges: 1px lighter on top-left sides, 1px darker on bottom-right sides.  
Light source: conceptually top-left (consistent with buildings).

---

## Object Palette

| Object    | Frame | Description |
|-----------|-------|-------------|
| Pine tree | 0     | 5-layer dark green conifer, 64×96 |
| Bare tree | 1     | Brown branching tree, bare, 64×96 |
| Rock      | 2     | Angular gray boulder, 64×96 |
| Bush      | 3     | Green rounded shrub with berries, 64×96 |

All objects use `setOrigin(0.5, 1.0)` — bottom-center anchored to tile foot.

---

## Key Implementation Files

```
scripts/gen_placeholders.js             → generates placeholder tiles (incl. iso/)
client/src/game/scenes/IsoWorldScene.js → isometric scene (isolated experiment)
client/src/game/scenes/IsoScene.js      → legacy iso POC (URL ?iso=1)
client/src/game/scenes/BootScene.js     → reads isoMode flag, routes to correct scene
client/src/game/config.js               → ISO_MODE const (hardcoded), scene list
client/src/game/PhaserGame.jsx          → sets isoMode in Phaser registry
client/public/assets/game/iso/          → placeholder tile assets (gitignored)
```

---

## Iso Coordinate Math

```js
// Grid → Screen (top vertex of tile diamond)
function isoToScreen(col, row) {
  return {
    x: ORIGIN_X + (col - row) * (ISO_W / 2),   // ISO_W = 64
    y: ORIGIN_Y + (col + row) * (ISO_H / 2),   // ISO_H = 32
  };
}

// Screen → Grid (for tap detection)
function screenToIso(wx, wy) {
  const rx = wx - ORIGIN_X, ry = wy - ORIGIN_Y;
  return {
    col: Math.floor((rx / 32 + ry / 16) / 2),
    row: Math.floor((ry / 16 - rx / 32) / 2),
  };
}

// Bottom-center of diamond (where objects "stand")
function isoFoot(col, row) {
  const { x, y } = isoToScreen(col, row);
  return { x, y: y + ISO_H };
}

// Depth rule — ensures correct overlap
sprite.setDepth(col + row + offset);
// offset: ground = -1, decoration = +0.2, building = +0.6
```

---

## Decision Criteria (fill in after playtesting)

- [ ] Touch selection feels accurate on mobile?
- [ ] 30+ buildings render at 60fps on mid-range Android?
- [ ] Building placement ghost is intuitive?
- [ ] Art matches the dark medieval feel of the references?
- [ ] Worth investing in bespoke isometric building sprites?

If ≥4 of 5 are ✅ → invest in custom iso art pack.  
Otherwise → stay with Option A and improve top-down building variety.

---

## Free Asset Packs to Evaluate (if going full iso)

- **LPC (Liberated Pixel Cup)** — CC-BY-SA, isometric sprites, buildings, characters
  - https://opengameart.org/content/lpc-complete-character-1
- **Kenney Isometric** — CC0, clean isometric tiles and buildings
  - https://kenney.nl/assets/isometric-miniature-kit
- **RPG Maker VX Ace tiles** — commercial, but common reference style
- **itch.io "Medieval Isometric"** — several packs, ~$5–15, great quality
