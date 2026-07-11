/**
 * ZoneStreamer — streaming del mundo por zonas según la cámara.
 *
 * El mapa se parte en zonas de ZONE_TILES×ZONE_TILES tiles (8×8 → grilla 4×4
 * en el mapa 32×32 de 64px). En vez de crear los ~1024 sprites de terreno +
 * decals + decoraciones + anclas de una sola vez, cada zona se construye
 * cuando entra al rect visible de la cámara (expandido 1 zona de margen) y
 * se destruye cuando sale. Las entidades de gameplay (edificios, NPCs,
 * cultivos, animales, aldeanos, marcadores, estructuras) NO se streamean —
 * son pocas y tienen lógica viva.
 *
 * Uso:
 *   const streamer = new ZoneStreamer(scene, mapData, {
 *     buildZone: (zx, zy) => [ ...GameObjects de esa zona... ],
 *   });
 *   streamer.update();      // desde scene.update() — throttled a ~4 checks/s
 *   streamer.update(true);  // fuerza un check inmediato (primer frame)
 *
 * Limpieza: se auto-registra al SHUTDOWN/DESTROY de la escena y destruye
 * todos los GameObjects vivos. destroy() es idempotente.
 */
import { ZONE_TILES } from './ZoneAnchors';

const CHECK_INTERVAL_MS = 250; // ~4 checks por segundo

export default class ZoneStreamer {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} mapData — { width, height } en tiles
   * @param {object} opts
   * @param {(zx:number, zy:number) => Phaser.GameObjects.GameObject[]} opts.buildZone
   * @param {number} [opts.tileSize=64] px por tile
   * @param {number} [opts.marginZones=1] zonas extra alrededor del viewport
   */
  constructor(scene, mapData, opts = {}) {
    this.scene = scene;
    this.buildZone = opts.buildZone;
    this.tileSize = opts.tileSize ?? 64;
    this.marginZones = opts.marginZones ?? 1;
    this.zonePx = ZONE_TILES * this.tileSize;
    this.zonesX = Math.ceil(mapData.width / ZONE_TILES);
    this.zonesY = Math.ceil(mapData.height / ZONE_TILES);

    /** @type {Map<string, Phaser.GameObjects.GameObject[]>} zona viva → objetos */
    this.live = new Map();
    this._lastCheck = -Infinity;
    this._destroyed = false;

    // Sin fugas: al apagar la escena se destruye todo lo streameado.
    this._onSceneDown = () => this.destroy();
    scene.events.once('shutdown', this._onSceneDown);
    scene.events.once('destroy', this._onSceneDown);
  }

  /**
   * Rect visible de la cámara en coords de mundo. cam.worldView se actualiza
   * recién en preRender — en el primer frame está vacío, así que se replica
   * su fórmula desde scroll/zoom para poder streamear ya desde create().
   */
  _viewRect() {
    const cam = this.scene.cameras.main;
    const wv = cam.worldView;
    if (wv && wv.width > 0 && wv.height > 0) return wv;
    const viewW = cam.width / (cam.zoom || 1);
    const viewH = cam.height / (cam.zoom || 1);
    return {
      x: cam.scrollX + cam.width / 2 - viewW / 2,
      y: cam.scrollY + cam.height / 2 - viewH / 2,
      right: cam.scrollX + cam.width / 2 + viewW / 2,
      bottom: cam.scrollY + cam.height / 2 + viewH / 2,
    };
  }

  /**
   * Crea las zonas que entran al viewport (+margen) y destruye las que salen.
   * Idempotente; throttled internamente (~4 checks/s) salvo force=true.
   */
  update(force = false) {
    if (this._destroyed || !this.buildZone) return;
    const now = this.scene.time.now;
    if (!force && now - this._lastCheck < CHECK_INTERVAL_MS) return;
    this._lastCheck = now;

    const view = this._viewRect();
    const m = this.marginZones;
    const zx0 = Math.max(0, Math.floor(view.x / this.zonePx) - m);
    const zy0 = Math.max(0, Math.floor(view.y / this.zonePx) - m);
    const zx1 = Math.min(this.zonesX - 1, Math.floor((view.right - 1) / this.zonePx) + m);
    const zy1 = Math.min(this.zonesY - 1, Math.floor((view.bottom - 1) / this.zonePx) + m);

    // Descargar zonas que salieron del rango
    for (const [key, objs] of this.live) {
      const comma = key.indexOf(',');
      const zx = +key.slice(0, comma);
      const zy = +key.slice(comma + 1);
      if (zx < zx0 || zx > zx1 || zy < zy0 || zy > zy1) {
        this._destroyObjects(objs);
        this.live.delete(key);
      }
    }

    // Cargar zonas que entraron
    for (let zy = zy0; zy <= zy1; zy++) {
      for (let zx = zx0; zx <= zx1; zx++) {
        const key = `${zx},${zy}`;
        if (this.live.has(key)) continue;
        this.live.set(key, this.buildZone(zx, zy) || []);
      }
    }
  }

  _destroyObjects(objs) {
    for (const o of objs) {
      // GameObjects ya destruidos por otra vía (p.ej. shutdown de escena)
      // no se re-destruyen.
      if (o && o.destroy && o.scene) o.destroy();
    }
  }

  /** Destruye todos los GameObjects streameados. Idempotente. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    for (const objs of this.live.values()) this._destroyObjects(objs);
    this.live.clear();
    if (this.scene) {
      this.scene.events.off('shutdown', this._onSceneDown);
      this.scene.events.off('destroy', this._onSceneDown);
    }
    this.scene = null;
    this.buildZone = null;
  }
}
