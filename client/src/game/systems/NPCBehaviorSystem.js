/**
 * NPCBehaviorSystem: Role-based NPC scheduler.
 * Assigns NPCs to buildings based on their role, routes them via A*, and
 * manages enter/inside/exit/return cycles. Builder NPCs auto-route to
 * construction sites.
 */

const ROLE_BUILDINGS = {
  farmer:   ['barn', 'farm_plot', 'mill', 'stable'],
  builder:  null,     // special: any is_building building
  guard:    ['barracks', 'tower', 'wall'],
  soldier:  ['barracks', 'tower'],
  merchant: ['market', 'tavern', 'embassy'],
  scholar:  ['library', 'throne_room'],
  innkeeper:['tavern'],
  villager: ['tavern', 'market', 'barn'],
};

export default class NPCBehaviorSystem {
  constructor(scene, pathfinding) {
    this.scene = scene;
    this.pathfinding = pathfinding;
    this.buildings = [];
    this.npcs = [];
    this.timers = new Map();          // npc → ms until next assignment
    this.constructionSet = new Set(); // buildings currently under construction
    this.buildingWorker = new Map();  // construction building → assigned npc
  }

  registerBuilding(building) {
    this.buildings.push(building);
    if (building.buildingData?.is_building) {
      this.constructionSet.add(building);
    }
  }

  registerNPC(npc) {
    this.npcs.push(npc);
    // Stagger first assignments 2–12s so NPCs don't all move at once
    this.timers.set(npc, 2000 + Math.random() * 10000);
  }

  onBuildingAdded(building) {
    if (!this.buildings.includes(building)) this.buildings.push(building);
    if (building.buildingData?.is_building) {
      this.constructionSet.add(building);
      // Prompt builder NPCs to check for work soon
      for (const npc of this.npcs) {
        if (npc.role === 'builder' && npc.state === 'idle') {
          const t = this.timers.get(npc) ?? 0;
          if (t > 3000) this.timers.set(npc, 1000 + Math.random() * 2000);
        }
      }
    }
  }

  onConstructionComplete(building) {
    this.constructionSet.delete(building);
    this.buildingWorker.delete(building);
  }

  update(time, delta) {
    for (const npc of this.npcs) {
      if (npc.state !== 'idle') continue;

      let timer = (this.timers.get(npc) ?? 0) - delta;
      if (timer <= 0) {
        timer = 8000 + Math.random() * 12000;
        this._assignTask(npc);
      }
      this.timers.set(npc, timer);
    }
  }

  _assignTask(npc) {
    let target = null;

    if (npc.role === 'builder') {
      target = this._findConstructionSite(npc);
    } else {
      target = this._findRoleBuilding(npc);
    }

    if (!target) return;

    const startTile = this.pathfinding.worldToTile(npc.x, npc.y);
    const entrance  = target.getEntranceTile();
    const path      = this.pathfinding.findPath(startTile.x, startTile.y, entrance.x, entrance.y);
    if (!path || path.length === 0) return;

    const pixelPath = path.map(t => this.pathfinding.tileToWorld(t.x, t.y));

    if (npc.role === 'builder') {
      this.buildingWorker.set(target, npc);
      target.setWorkerPresent(true);
    }

    npc.walkPath(pixelPath, () => {
      npc.enterBuilding(target, () => {
        const stayMs = 5000 + Math.random() * 10000;
        this.scene.time.delayedCall(stayMs, () => {
          if (!npc.active) return;
          const exit = target.getEntrancePixel();
          npc.exitBuilding(exit.x, exit.y, () => {
            if (npc.role === 'builder') {
              this.buildingWorker.delete(target);
              target.setWorkerPresent(false);
            }
            npc.returnHome(this.pathfinding);
          });
        });
      });
    });
  }

  _findConstructionSite(npc) {
    let best = null, bestDist = Infinity;
    for (const b of this.constructionSet) {
      if (this.buildingWorker.get(b) && this.buildingWorker.get(b) !== npc) continue;
      const dx = b.x - npc.x, dy = b.y - npc.y;
      const d = dx*dx + dy*dy;
      if (d < bestDist) { best = b; bestDist = d; }
    }
    return best;
  }

  _findRoleBuilding(npc) {
    const roleList = ROLE_BUILDINGS[npc.role] || ROLE_BUILDINGS.villager;
    const eligible = this.buildings.filter(b =>
      !b.buildingData?.is_building &&
      roleList.includes(b.buildingData?.buildingId)
    );
    if (eligible.length === 0) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }
}
