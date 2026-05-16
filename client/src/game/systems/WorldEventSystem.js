/**
 * WorldEventSystem: renders animated event markers on the world map
 * and wires them into SelectionSystem for tap-to-open.
 */

const TILE_SIZE = 32;

const RARITY_COLOR = {
  common:   0x9ca3af,
  uncommon: 0x3b82f6,
  rare:     0xffd700,
};

const RARITY_GLOW_ALPHA = {
  common:   0.18,
  uncommon: 0.28,
  rare:     0.45,
};

export default class WorldEventSystem {
  constructor(scene, selectionSystem) {
    this.scene = scene;
    this.selectionSystem = selectionSystem;
    this.markers = []; // { event, icon, glow, dot, tweens[] }
  }

  loadEvents(events) {
    this.clearMarkers();
    for (const event of events) {
      if (event.is_claimed) {
        this._createClaimedMarker(event);
      } else {
        this._createActiveMarker(event);
      }
    }
  }

  _createActiveMarker(event) {
    const px = event.tile_x * TILE_SIZE + TILE_SIZE / 2;
    const py = event.tile_y * TILE_SIZE + TILE_SIZE / 2;
    const color  = RARITY_COLOR[event.rarity]      || RARITY_COLOR.common;
    const gAlpha = RARITY_GLOW_ALPHA[event.rarity] || RARITY_GLOW_ALPHA.common;

    const tweens = [];

    // Pulsing ellipse glow
    const glow = this.scene.add.ellipse(px, py, 44, 22, color, gAlpha);
    glow.setDepth(17);
    tweens.push(this.scene.tweens.add({
      targets: glow,
      scaleX: 1.3, scaleY: 1.3,
      alpha: { from: gAlpha * 0.5, to: gAlpha },
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    }));

    // Floating icon
    const icon = this.scene.add.text(px, py - 22, event.icon, {
      fontSize: '20px',
    }).setOrigin(0.5, 0.5).setDepth(20);

    tweens.push(this.scene.tweens.add({
      targets: icon,
      y: py - 28,
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    }));

    // Small rarity dot
    const dot = this.scene.add.ellipse(px + 10, py - 30, 7, 7, color, 0.9)
      .setDepth(21);

    // Register with selection system
    this.selectionSystem.register(icon, 'world_event', {
      eventId:     event.id,
      title:       event.title,
      description: event.description,
      icon:        event.icon,
      rarity:      event.rarity,
      rewards:     event.rewards,
      expires_at:  event.expires_at,
      is_claimed:  false,
    });

    this.markers.push({ event, icon, glow, dot, tweens });
  }

  _createClaimedMarker(event) {
    const px = event.tile_x * TILE_SIZE + TILE_SIZE / 2;
    const py = event.tile_y * TILE_SIZE + TILE_SIZE / 2;

    // Dimmed checkmark at the location — no interaction
    const icon = this.scene.add.text(px, py - 22, '✓', {
      fontSize: '14px',
      color: '#4ade80',
    }).setOrigin(0.5, 0.5).setDepth(20).setAlpha(0.4);

    this.markers.push({ event, icon, glow: null, dot: null, tweens: [] });
  }

  /** Mark a single event as claimed without full reload. */
  markClaimed(eventId) {
    const marker = this.markers.find((m) => m.event.id === eventId);
    if (!marker || !marker.glow) return; // already claimed

    // Stop and destroy animated objects
    for (const t of marker.tweens) { this.scene.tweens.remove(t); }
    marker.tweens = [];
    if (marker.glow)  { marker.glow.destroy();  marker.glow  = null; }
    if (marker.dot)   { marker.dot.destroy();    marker.dot   = null; }

    // Deregister from tap system
    this.selectionSystem.unregister(marker.icon);

    // Replace icon with claimed check
    marker.icon.setText('✓')
      .setStyle({ fontSize: '14px', color: '#4ade80' })
      .setAlpha(0.4);
  }

  clearMarkers() {
    for (const m of this.markers) {
      for (const t of m.tweens) { this.scene.tweens.remove(t); }
      if (m.glow) m.glow.destroy();
      if (m.dot)  m.dot.destroy();
      if (m.icon) {
        this.selectionSystem.unregister(m.icon);
        m.icon.destroy();
      }
    }
    this.markers = [];
  }

  destroy() {
    this.clearMarkers();
  }
}
