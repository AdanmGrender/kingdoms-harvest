/**
 * PathfindingSystem: A* pathfinding on the 160×120 tile grid.
 * Uses the existing collision layer data plus building footprints as obstacles.
 */

const TILE = 32;

class MinHeap {
  constructor() { this.data = []; }
  push(item) { this.data.push(item); this._up(this.data.length - 1); }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) { this.data[0] = last; this._down(0); }
    return top;
  }
  isEmpty() { return this.data.length === 0; }
  _up(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f > this.data[i].f) {
        [this.data[p], this.data[i]] = [this.data[i], this.data[p]]; i = p;
      } else break;
    }
  }
  _down(i) {
    const n = this.data.length;
    for (;;) {
      let s = i, l = 2*i+1, r = 2*i+2;
      if (l < n && this.data[l].f < this.data[s].f) s = l;
      if (r < n && this.data[r].f < this.data[s].f) s = r;
      if (s === i) break;
      [this.data[s], this.data[i]] = [this.data[i], this.data[s]]; i = s;
    }
  }
}

export default class PathfindingSystem {
  constructor(collisionGrid, mapW, mapH) {
    // Deep-copy so we can mutate for building obstacles without affecting map render
    this.grid = [];
    for (let y = 0; y < mapH; y++) {
      this.grid[y] = collisionGrid[y] ? [...collisionGrid[y]] : new Array(mapW).fill(0);
    }
    this.mapW = mapW;
    this.mapH = mapH;
    this.cache = new Map();
    this.cacheKeys = []; // LRU order
    this.CACHE_MAX = 50;
  }

  /**
   * Mark the 2×2 footprint of a building as blocked.
   * Leaves the tile just below the footprint (entrance) walkable.
   */
  addObstacle(tileX, tileY, tileW = 2, tileH = 2) {
    for (let dy = 0; dy < tileH; dy++) {
      for (let dx = 0; dx < tileW; dx++) {
        const x = tileX + dx, y = tileY + dy;
        if (x >= 0 && x < this.mapW && y >= 0 && y < this.mapH) {
          this.grid[y][x] = 1;
        }
      }
    }
    this._clearCache();
  }

  removeObstacle(tileX, tileY, tileW = 2, tileH = 2) {
    for (let dy = 0; dy < tileH; dy++) {
      for (let dx = 0; dx < tileW; dx++) {
        const x = tileX + dx, y = tileY + dy;
        if (x >= 0 && x < this.mapW && y >= 0 && y < this.mapH) {
          this.grid[y][x] = 0;
        }
      }
    }
    this._clearCache();
  }

  /**
   * Find an A* path from (startX,startY) to (goalX,goalY) in tile coords.
   * Returns [{x,y}] array of tile coords, or null if no path exists.
   * The path does NOT include the start tile.
   */
  findPath(startX, startY, goalX, goalY) {
    startX = Math.max(0, Math.min(this.mapW - 1, Math.round(startX)));
    startY = Math.max(0, Math.min(this.mapH - 1, Math.round(startY)));
    goalX  = Math.max(0, Math.min(this.mapW - 1, Math.round(goalX)));
    goalY  = Math.max(0, Math.min(this.mapH - 1, Math.round(goalY)));

    if (startX === goalX && startY === goalY) return [];

    // Goal must be walkable; if blocked, try adjacent tiles
    if (this.grid[goalY]?.[goalX] === 1) {
      const adj = this._walkableNeighbour(goalX, goalY);
      if (!adj) return null;
      goalX = adj.x; goalY = adj.y;
    }

    const key = `${startX},${startY}:${goalX},${goalY}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this._lruTouch(key);
      return cached;
    }

    // A*
    const open = new MinHeap();
    const cameFrom = new Map();
    const gScore = new Map();

    const sk = `${startX},${startY}`;
    gScore.set(sk, 0);
    open.push({ x: startX, y: startY, f: this._h(startX, startY, goalX, goalY) });

    const DIRS = [[0,1],[0,-1],[1,0],[-1,0]];

    while (!open.isEmpty()) {
      const { x, y } = open.pop();

      if (x === goalX && y === goalY) {
        // Reconstruct
        const path = [];
        let cur = `${x},${y}`;
        while (cameFrom.has(cur)) {
          const [cx, cy] = cur.split(',').map(Number);
          path.unshift({ x: cx, y: cy });
          cur = cameFrom.get(cur);
        }
        this._cacheSet(key, path);
        return path;
      }

      const ck = `${x},${y}`;
      const g = gScore.get(ck) ?? Infinity;

      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.mapW || ny >= this.mapH) continue;
        if (this.grid[ny]?.[nx] === 1) continue;

        const nk = `${nx},${ny}`;
        const ng = g + 1;
        if (ng < (gScore.get(nk) ?? Infinity)) {
          cameFrom.set(nk, ck);
          gScore.set(nk, ng);
          open.push({ x: nx, y: ny, f: ng + this._h(nx, ny, goalX, goalY) });
        }
      }
    }

    this._cacheSet(key, null);
    return null;
  }

  worldToTile(px, py) {
    return { x: Math.floor(px / TILE), y: Math.floor(py / TILE) };
  }

  tileToWorld(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  _h(x, y, gx, gy) { return Math.abs(gx - x) + Math.abs(gy - y); }

  _walkableNeighbour(x, y) {
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < this.mapW && ny < this.mapH && this.grid[ny][nx] !== 1) {
        return { x: nx, y: ny };
      }
    }
    return null;
  }

  _clearCache() { this.cache.clear(); this.cacheKeys = []; }

  _lruTouch(key) {
    const idx = this.cacheKeys.indexOf(key);
    if (idx !== -1) { this.cacheKeys.splice(idx, 1); this.cacheKeys.push(key); }
  }

  _cacheSet(key, value) {
    if (!this.cache.has(key) && this.cacheKeys.length >= this.CACHE_MAX) {
      const evict = this.cacheKeys.shift();
      this.cache.delete(evict);
    }
    this.cache.set(key, value);
    const idx = this.cacheKeys.indexOf(key);
    if (idx !== -1) this.cacheKeys.splice(idx, 1);
    this.cacheKeys.push(key);
  }
}
