/**
 * IsoScene — renders a per-player procedural TOP-DOWN map using Kenney medieval-rts.
 *
 * Despite the name, Kenney medieval-rts is a TOP-DOWN 2D tileset (64×64, not iso).
 * Scene key kept as 'IsoScene' for backward compatibility; rendering is grid-aligned.
 *
 * Map is generated from player.telegram_id so each player sees the same world on reload.
 * Activate via URL param ?iso=1 or scene.start('IsoScene').
 */
import Phaser from 'phaser';
import useGameStore from '../../store/gameStore';
import EventBridge from '../EventBridge';
import { generateMap, BIOMES, RESOURCE_TYPES } from '../maps/IsoMapGenerator';
import { ROAD_CONNECTORS } from '../maps/IsoMapGenerator';

// Kenney medieval-rts tiles are 64×64 top-down squares.
const TILE_W = 64;
const TILE_H = 64;

const MAP_W = 32;
const MAP_H = 32;

const FOG_TINT = 0x202040;
const FOG_ALPHA = 0.55;

// Click-vs-drag threshold — pointer moved more than this (in screen px²) = pan, not tap.
const CLICK_DRIFT_SQ = 100;

const HARVEST_PER_TAP = 10;

const RESOURCE_BADGE_COLORS = {
  [RESOURCE_TYPES.WOOD]:  0x8b5a2b,
  [RESOURCE_TYPES.STONE]: 0xaaaaaa,
  [RESOURCE_TYPES.IRON]:  0x6ec1ff,
  [RESOURCE_TYPES.WHEAT]: 0xf5d742,
};

const pad2 = (n) => String(n).padStart(2, '0');

export default class IsoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IsoScene' });
  }

  preload() {
    const basePath = '/assets/kenney-medieval/PNG/Default size';

    // 58 terrain tiles.
    for (let i = 1; i <= 58; i++) {
      this.load.image(`iso_tile_${i}`, `${basePath}/Tile/medievalTile_${pad2(i)}.png`);
    }
    // 21 environment sprites.
    for (let i = 1; i <= 21; i++) {
      this.load.image(`iso_env_${i}`, `${basePath}/Environment/medievalEnvironment_${pad2(i)}.png`);
    }
    // 23 structure sprites.
    for (let i = 1; i <= 23; i++) {
      this.load.image(`iso_struct_${i}`, `${basePath}/Structure/medievalStructure_${pad2(i)}.png`);
    }

    this.load.on('loaderror', (file) => {
      console.error('[IsoScene] Failed to load:', file.key, file.url);
    });
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0e1420');

    const player = useGameStore.getState().player;
    const seed = player?.telegram_id ?? player?.id ?? `preview-${Date.now()}`;

    this.mapData = generateMap({ seed, width: MAP_W, height: MAP_H });

    this.originX = cam.width / 2;
    this.originY = cam.height / 4;

    this.drawTerrain();
    this.drawStructures();
    this.drawDecorations();
    this.drawResources();
    this.applyFog();
    this.markSpawn();
    this.setupCamera();
    this.drawHUD(seed);

    // Outside world can shout "show this spot" (e.g. villager walked there).
    this.handleMapReveal = ({ x, y, radius = 5 } = {}) => {
      if (typeof x === 'number' && typeof y === 'number') this.reveal(x, y, radius);
    };
    EventBridge.on('map:reveal', this.handleMapReveal);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBridge.off('map:reveal', this.handleMapReveal);
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      EventBridge.off('map:reveal', this.handleMapReveal);
    });
  }

  /** Grid (gx, gy) → screen pixel coords (top-down square grid). */
  isoToScreen(gx, gy) {
    return {
      x: this.originX + gx * TILE_W,
      y: this.originY + gy * TILE_H,
    };
  }

  /** Stores each terrain sprite by key "x,y" so fog can tint them in one pass. */
  drawTerrain() {
    this.terrainSprites = new Map();
    const { tileVariants, terrain, width, height } = this.mapData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const { x: sx, y: sy } = this.isoToScreen(x, y);
        const tileId =
          terrain[y][x] === BIOMES.ROAD
            ? this.pickRoadTile(x, y)
            : tileVariants[y][x];
        const tile = this.add.image(sx, sy, `iso_tile_${tileId}`);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(y * 100 + x);
        this.terrainSprites.set(`${x},${y}`, tile);
      }
    }
  }

  /** Pick a Kenney grass+path connector by checking cardinal road neighbors. */
  pickRoadTile(x, y) {
    const { terrain, width, height } = this.mapData;
    const isRoad = (nx, ny) =>
      nx >= 0 && ny >= 0 && nx < width && ny < height && terrain[ny][nx] === BIOMES.ROAD;

    const mask =
      (isRoad(x, y - 1) ? 0b0001 : 0) | // N
      (isRoad(x + 1, y) ? 0b0010 : 0) | // E
      (isRoad(x, y + 1) ? 0b0100 : 0) | // S
      (isRoad(x - 1, y) ? 0b1000 : 0);  // W
    const pool = ROAD_CONNECTORS.ON_GRASS;
    return pool[mask] ?? pool['*'];
  }

  drawStructures() {
    this.structureSprites = [];
    for (const s of this.mapData.structures) {
      const { x: sx, y: sy } = this.isoToScreen(s.x, s.y);
      const sprite = this.add.image(sx, sy, `iso_struct_${s.tileId}`);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(10000 + s.y * 100 + s.x);
      sprite.setData('gridX', s.x);
      sprite.setData('gridY', s.y);
      sprite.setInteractive({ useHandCursor: true });
      this.wireTap(sprite, () => {
        EventBridge.emit('structure:selected', {
          type: s.type,
          x: s.x,
          y: s.y,
          tileId: s.tileId,
        });
        this.reveal(s.x, s.y, 3);
      });
      this.structureSprites.push(sprite);
    }
  }

  drawDecorations() {
    this.decorSprites = [];
    for (const d of this.mapData.decorations) {
      const { x: sx, y: sy } = this.isoToScreen(d.x, d.y);
      const sprite = this.add.image(sx, sy, `iso_env_${d.tileId}`);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(5000 + d.y * 100 + d.x);
      sprite.setData('gridX', d.x);
      sprite.setData('gridY', d.y);
      this.decorSprites.push(sprite);
    }
  }

  /** Resource nodes get a small color-coded badge to signal they're gatherable. */
  drawResources() {
    this.resourceSprites = [];
    for (const r of this.mapData.resources) {
      const { x: sx, y: sy } = this.isoToScreen(r.x, r.y);
      const sprite = this.add.image(sx, sy, `iso_env_${r.tileId}`);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(6000 + r.y * 100 + r.x);

      const badgeColor = RESOURCE_BADGE_COLORS[r.type] || 0xffffff;
      const badge = this.add.circle(sx, sy - 22, 5, badgeColor);
      badge.setStrokeStyle(1, 0x1a1408);
      badge.setDepth(6001 + r.y * 100 + r.x);

      sprite.setData('gridX', r.x);
      sprite.setData('gridY', r.y);
      badge.setData('gridX', r.x);
      badge.setData('gridY', r.y);

      sprite.setInteractive({ useHandCursor: true });
      this.wireTap(sprite, () => this.harvestResource(r, sprite, badge));

      this.resourceSprites.push(sprite, badge);
    }
  }

  /** Harvest one tap: decrement amount, spawn float-text, destroy if depleted. */
  harvestResource(r, sprite, badge) {
    const gained = Math.min(HARVEST_PER_TAP, r.amount);
    r.amount -= gained;

    this.spawnFloatText(sprite.x, sprite.y - 40, `+${gained} ${r.type}`,
      RESOURCE_BADGE_COLORS[r.type] || 0xffd750);

    EventBridge.emit('resource:harvest', {
      type: r.type,
      amount: gained,
      x: r.x,
      y: r.y,
      remaining: r.amount,
    });

    if (r.amount <= 0) {
      sprite.destroy();
      badge.destroy();
    } else {
      this.tweens.add({
        targets: [sprite, badge],
        scaleX: { from: 1.15, to: 1 },
        scaleY: { from: 1.15, to: 1 },
        duration: 150,
      });
    }
  }

  spawnFloatText(x, y, text, color) {
    const hex = '#' + color.toString(16).padStart(6, '0');
    const label = this.add
      .text(x, y, text, {
        fontFamily: 'monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: hex,
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100000);
    this.tweens.add({
      targets: label,
      y: y - 40,
      alpha: { from: 1, to: 0 },
      duration: 900,
      onComplete: () => label.destroy(),
    });
  }

  /**
   * Attach a tap handler that only fires when pointer didn't drift (= real click,
   * not a pan gesture starting on this sprite).
   */
  wireTap(sprite, onTap) {
    let downX = 0, downY = 0;
    sprite.on('pointerdown', (p) => {
      downX = p.x;
      downY = p.y;
    });
    sprite.on('pointerup', (p) => {
      const dx = p.x - downX;
      const dy = p.y - downY;
      if (dx * dx + dy * dy > CLICK_DRIFT_SQ) return;
      onTap();
    });
  }

  /** Dim tiles + props that fall outside visibility. */
  applyFog() {
    const { visibility, width, height } = this.mapData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!visibility[y][x]) this.setFogAt(x, y, true);
      }
    }
  }

  /** Toggle fog for a single tile and all props on it. */
  setFogAt(x, y, hidden) {
    const tile = this.terrainSprites.get(`${x},${y}`);
    if (tile) {
      if (hidden) { tile.setTint(FOG_TINT); tile.setAlpha(FOG_ALPHA); }
      else { tile.clearTint(); tile.setAlpha(1); }
    }
    const toggleProps = (arr, propAlpha) => {
      for (const s of arr) {
        if (s.getData('gridX') !== x || s.getData('gridY') !== y) continue;
        if (hidden) {
          if (s.setTint) s.setTint(FOG_TINT);
          s.setAlpha(propAlpha);
        } else {
          if (s.clearTint) s.clearTint();
          s.setAlpha(1);
        }
      }
    };
    toggleProps(this.structureSprites, FOG_ALPHA * 0.5);
    toggleProps(this.decorSprites,     FOG_ALPHA * 0.5);
    toggleProps(this.resourceSprites,  FOG_ALPHA * 0.5);
  }

  /**
   * Reveal a circular area — called on structure click, spawn, or via
   * EventBridge 'map:reveal' event (payload: { x, y, radius }).
   */
  reveal(gx, gy, radius = 5) {
    const { visibility, width, height } = this.mapData;
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const x = gx + dx, y = gy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (visibility[y][x]) continue;
        visibility[y][x] = 1;
        this.setFogAt(x, y, false);
      }
    }
  }

  markSpawn() {
    const { x: sx, y: sy } = this.isoToScreen(this.mapData.spawn.x, this.mapData.spawn.y);
    const ring = this.add.graphics();
    ring.lineStyle(3, 0xffd750, 0.9);
    ring.strokeCircle(sx, sy, 26);
    ring.fillStyle(0xffd750, 0.12);
    ring.fillCircle(sx, sy, 26);
    ring.setDepth(4000);

    this.tweens.add({
      targets: ring,
      alpha: { from: 1, to: 0.4 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  setupCamera() {
    const cam = this.cameras.main;
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p, _g, _dx, dy) => {
      const next = cam.zoom + (dy > 0 ? -0.1 : 0.1);
      cam.setZoom(Phaser.Math.Clamp(next, 0.3, 2.5));
    });
    cam.setZoom(0.5);
    const { x: sx, y: sy } = this.isoToScreen(this.mapData.spawn.x, this.mapData.spawn.y);
    cam.centerOn(sx, sy);
  }

  drawHUD(seed) {
    const { structures, resources, roads, biomes } = this.mapData;
    const mix = Object.entries(biomes || {})
      .sort((a, b) => b[1] - a[1])
      .map(([b, n]) => `${b.slice(0, 3)}:${n}`)
      .join(' ');

    const resByType = resources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});
    const resStr = Object.entries(resByType).map(([t, n]) => `${t}:${n}`).join(' ');

    const lines = [
      `ISO MAP — seed:${String(seed).slice(0, 14)} — ${MAP_W}x${MAP_H}`,
      `biomes: ${mix}`,
      `roads:${roads.length}  structures:${structures.length}  resources: ${resStr}`,
      `drag to pan · wheel to zoom`,
    ];
    this.add
      .text(12, 12, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffd750',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(99999);
  }
}
