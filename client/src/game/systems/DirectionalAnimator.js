/**
 * DirectionalAnimator — driver de animación de personajes en 8 direcciones.
 *
 * Sheets: una textura por estado (`${texKey}_idle`, `${texKey}_walk`), cada una
 * con 5 filas × N frames: fila 0=S, 1=SE, 2=E, 3=NE, 4=N.
 * Las direcciones del lado oeste (NW/W/SW) reutilizan las filas 3/2/1 con
 * flipX (truco espejo: el artista dibuja 5 direcciones, no 8).
 *
 * FSM: estado (idle|walk) × dirección-como-parámetro. La dirección se cuantiza
 * a 8 sectores de 45° con histéresis de ~100 ms para que no parpadee en las
 * fronteras entre sectores.
 *
 * Spec completa: docs/iso-art-architecture.md §2.
 */

const ROWS_PER_SHEET = 5;
const HYSTERESIS_MS = 100;
const SPEED_EPSILON = 0.5; // px/s — por debajo de esto es idle

// sector (ángulo atan2, 0=E, antihorario) → fila del sheet + espejo
const SECTOR_TO_ROW = [
  { row: 2, flip: false }, // 0 E
  { row: 3, flip: false }, // 1 NE
  { row: 4, flip: false }, // 2 N
  { row: 3, flip: true  }, // 3 NW
  { row: 2, flip: true  }, // 4 W
  { row: 1, flip: true  }, // 5 SW
  { row: 0, flip: false }, // 6 S
  { row: 1, flip: false }, // 7 SE
];

export default class DirectionalAnimator {
  /**
   * Registra las animaciones `${texKey}_${estado}_${fila}` (una vez por juego).
   * @param {Phaser.Scene} scene
   * @param {string} texKey  — prefijo; las texturas deben llamarse `${texKey}_idle`, etc.
   * @param {Object} states  — { idle: { frames: 2, frameRate: 3 }, walk: { frames: 4, frameRate: 8 } }
   */
  static registerAnims(scene, texKey, states) {
    for (const [state, cfg] of Object.entries(states)) {
      const sheetKey = `${texKey}_${state}`;
      for (let row = 0; row < ROWS_PER_SHEET; row++) {
        const key = `${texKey}_${state}_${row}`;
        if (scene.anims.exists(key)) continue;
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(sheetKey, {
            start: row * cfg.frames,
            end:   row * cfg.frames + cfg.frames - 1,
          }),
          frameRate: cfg.frameRate,
          repeat: -1,
        });
      }
    }
  }

  constructor(sprite, texKey) {
    this.sprite = sprite;
    this.texKey = texKey;
    this.state = 'idle';
    this.sector = 6; // mirando al frente (S)
    this._pendingSector = null;
    this._pendingMs = 0;
    this._apply();
  }

  /**
   * Llamar cada frame con la velocidad en PANTALLA (px/s) y delta en ms.
   * La proyección iso 2:1 ya viene comprimida en vy, así el personaje "mira"
   * exactamente hacia donde el jugador lo ve moverse.
   */
  update(vx, vy, dt) {
    const speed = Math.hypot(vx, vy);
    this.state = speed > SPEED_EPSILON ? 'walk' : 'idle';

    if (this.state === 'walk') {
      // Y de pantalla crece hacia abajo → negar para ángulo matemático
      const angle = Math.atan2(-vy, vx);
      const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;

      if (sector !== this.sector) {
        // Histéresis: solo girar si el nuevo sector persiste HYSTERESIS_MS
        if (this._pendingSector === sector) {
          this._pendingMs += dt;
          if (this._pendingMs >= HYSTERESIS_MS) {
            this.sector = sector;
            this._pendingSector = null;
            this._pendingMs = 0;
          }
        } else {
          this._pendingSector = sector;
          this._pendingMs = dt;
        }
      } else {
        this._pendingSector = null;
        this._pendingMs = 0;
      }
    }

    this._apply();
  }

  _apply() {
    const { row, flip } = SECTOR_TO_ROW[this.sector];
    // play(key, true) = ignoreIfPlaying — idempotente y barato
    this.sprite.play(`${this.texKey}_${this.state}_${row}`, true);
    this.sprite.setFlipX(flip);
  }
}
