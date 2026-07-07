/**
 * NPC entity: Movable character with role-based behavior.
 * Walks to buildings, enters (scale-down + fade), stays inside, then exits and returns home.
 * State machine: idle → walking → entering → inside → exiting → returning → idle
 */
import Phaser from 'phaser';

const SPEED = 40; // px/s

function inferRole(npcId) {
  if (!npcId) return 'villager';
  if (/farmer|crop|harvest/i.test(npcId)) return 'farmer';
  if (/guard|soldier|knight/i.test(npcId)) return 'guard';
  if (/merchant|trader|market/i.test(npcId)) return 'merchant';
  if (/scholar|mage|sage|librarian/i.test(npcId)) return 'scholar';
  if (/builder|carpenter|construct/i.test(npcId)) return 'builder';
  if (/innkeeper|tavern|bartender/i.test(npcId)) return 'innkeeper';
  return 'villager';
}

export default class NPC extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, npcId, name, role) {
    super(scene, x, y, `npc_${npcId}`, 0);

    this.npcId   = npcId;
    this.npcName = name;
    this.role    = role || inferRole(npcId);

    // Home position — NPC returns here after visiting a building
    this.homeX = x;
    this.homeY = y;

    // Movement state
    this.state          = 'idle';
    this.waypoints      = [];
    this.waypointIndex  = 0;
    this.arrivalCb      = null;
    this.wanderTimer    = 0;
    this.wanderDelay    = Phaser.Math.Between(4000, 8000);
    this.questBounceT   = 0;

    scene.add.existing(this);
    this.setDepth(9);

    // Dirección de encaramiento para el sheet direccional 4×3 (down/up/side).
    // El sheet dibuja 'side' mirando a la derecha; W = flipX.
    this.facing = 'down';
    this._animKey = null;
    this._applyAnim(false);

    this.nameText = scene.add.text(x, y - 32, name, {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '11px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

    this.questIcon = scene.add.text(x, y - 44, '!', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '16px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  setHasQuest(hasQuest) {
    this.questIcon.setVisible(hasQuest);
  }

  // ─── Movement API ────────────────────────────────────────────────────────

  /**
   * Walk along a pixel-coordinate waypoint array.
   * Calls onArrival when the last waypoint is reached.
   */
  walkPath(pixelWaypoints, onArrival) {
    if (!pixelWaypoints || pixelWaypoints.length === 0) {
      if (onArrival) onArrival();
      return;
    }
    this.waypoints     = pixelWaypoints;
    this.waypointIndex = 0;
    this.arrivalCb     = onArrival;
    this.state         = 'walking';
  }

  /**
   * Scale-down and fade the NPC into a building.
   * Calls onDone when the animation finishes.
   */
  enterBuilding(building, onDone) {
    this.state           = 'entering';
    this.currentBuilding = building;

    this.scene.tweens.add({
      targets:  this,
      scaleX:   0.15,
      scaleY:   0.15,
      alpha:    0,
      duration: 350,
      ease:     'Sine.easeIn',
      onComplete: () => {
        this.state = 'inside';
        building.onNPCEnter(this);
        if (onDone) onDone();
      },
    });
  }

  /**
   * Appear at (exitX, exitY) and scale back up.
   * Calls onDone when the animation finishes.
   */
  exitBuilding(exitX, exitY, onDone) {
    this.state = 'exiting';
    this.setPosition(exitX, exitY);
    this.setScale(0.15);
    this.setAlpha(0);
    this.setVisible(true);

    if (this.currentBuilding) {
      this.currentBuilding.onNPCExit(this);
      this.currentBuilding = null;
    }

    this.scene.tweens.add({
      targets:  this,
      scaleX:   1,
      scaleY:   1,
      alpha:    1,
      duration: 350,
      ease:     'Sine.easeOut',
      onComplete: () => {
        this.state = 'idle';
        if (onDone) onDone();
      },
    });
  }

  /**
   * Route back to the NPC's home spawn position.
   */
  returnHome(pathfinding) {
    const startTile = pathfinding.worldToTile(this.x, this.y);
    const goalTile  = pathfinding.worldToTile(this.homeX, this.homeY);
    const path      = pathfinding.findPath(startTile.x, startTile.y, goalTile.x, goalTile.y);

    if (path && path.length > 0) {
      const pixelPath = path.map(t => pathfinding.tileToWorld(t.x, t.y));
      pixelPath.push({ x: this.homeX, y: this.homeY }); // exact home
      this.state = 'returning';
      this.walkPath(pixelPath, () => { this.state = 'idle'; });
    } else {
      this.setPosition(this.homeX, this.homeY);
      this.state = 'idle';
    }
  }

  // ─── Update loop ─────────────────────────────────────────────────────────

  update(delta) {
    this.questBounceT += delta;

    // Keep labels following NPC
    this.nameText.setPosition(this.x, this.y - 32);
    if (this.questIcon.visible) {
      this.questIcon.setPosition(
        this.x,
        this.y - 44 + Math.sin(this.questBounceT / 500) * 4
      );
    } else {
      this.questIcon.setPosition(this.x, this.y - 44);
    }

    const moving = this.state === 'walking' || this.state === 'returning';
    if (moving) {
      this._stepMovement(delta);
    } else if (this.state === 'idle') {
      this._idleWander(delta);
    }
    // Anim direccional: caminar mientras se mueve, quieto mirando la última
    // dirección cuando no. (entering/inside/exiting conservan su tween propio.)
    if (this.state === 'idle' || moving) this._applyAnim(moving);
  }

  _stepMovement(delta) {
    if (this.waypointIndex >= this.waypoints.length) {
      this.state = 'idle';
      if (this.arrivalCb) { const cb = this.arrivalCb; this.arrivalCb = null; cb(); }
      return;
    }

    const target = this.waypoints[this.waypointIndex];
    const dx     = target.x - this.x;
    const dy     = target.y - this.y;
    const dist   = Math.sqrt(dx * dx + dy * dy);

    if (dist < 4) {
      this.waypointIndex++;
      if (this.waypointIndex >= this.waypoints.length) {
        this.state = 'idle';
        if (this.arrivalCb) { const cb = this.arrivalCb; this.arrivalCb = null; cb(); }
      }
      return;
    }

    const step = SPEED * (delta / 1000);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this._faceFromDelta(dx, dy);
  }

  /**
   * Elige la dirección de encaramiento a partir del vector de movimiento.
   * Eje dominante manda; las diagonales caen a la cardinal más cercana.
   * 'side' se dibuja mirando a la derecha → flipX cuando va a la izquierda.
   */
  _faceFromDelta(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.facing = 'side';
      this.setFlipX(dx < 0);
    } else {
      this.facing = dy >= 0 ? 'down' : 'up';
      this.setFlipX(false);
    }
  }

  /** Reproduce walk_<dir>/idle_<dir> según la dirección actual (idempotente). */
  _applyAnim(moving) {
    const key = `npc_${this.npcId}_${moving ? 'walk' : 'idle'}_${this.facing}`;
    if (key === this._animKey) return;
    this._animKey = key;
    try { this.play(key, true); } catch (_) { /* animation may not exist */ }
  }

  _idleWander(delta) {
    this.wanderTimer += delta;
    if (this.wanderTimer < this.wanderDelay) return;

    this.wanderTimer  = 0;
    this.wanderDelay  = Phaser.Math.Between(4000, 9000);
    const r = 48;
    const tx = Phaser.Math.Clamp(this.homeX + Phaser.Math.Between(-r, r), 16, 5100);
    const ty = Phaser.Math.Clamp(this.homeY + Phaser.Math.Between(-r, r), 16, 3800);
    this.walkPath([{ x: tx, y: ty }], () => { this.state = 'idle'; });
  }

  destroy(fromScene) {
    if (this.nameText)  this.nameText.destroy();
    if (this.questIcon) this.questIcon.destroy();
    super.destroy(fromScene);
  }
}
