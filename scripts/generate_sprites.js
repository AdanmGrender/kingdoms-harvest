/**
 * Generates isometric sprite sheets for Kingdoms Harvest.
 * Outputs:
 *   client/public/assets/game/tilesets/buildings.png  512×512, 16 frames 128×128 (4×4 grid)
 *   client/public/assets/game/tilesets/terrain.png    512×512, tiles 32×32 (16/row)
 *   client/public/assets/game/tilesets/farm_tiles.png 256×256, 4 stages 64×64 (4×2 grid)
 */

const { createCanvas } = require('/opt/node22/lib/node_modules/canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../client/public/assets/game/tilesets');

// ── Polygon helper ───────────────────────────────────────────────

function poly(ctx, pts, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
}

// ── Isometric box (cx=center-x, gy=ground-y, hw/hh=diamond half-w/h) ──

function isoBox(ctx, cx, gy, hw, hh, wallH, cTop, cLeft, cRight) {
  const ol = 'rgba(0,0,0,0.35)';
  poly(ctx, [
    [cx - hw, gy], [cx, gy + hh],
    [cx, gy + hh - wallH], [cx - hw, gy - wallH]
  ], cLeft, ol);
  poly(ctx, [
    [cx, gy + hh], [cx + hw, gy],
    [cx + hw, gy - wallH], [cx, gy + hh - wallH]
  ], cRight, ol);
  poly(ctx, [
    [cx - hw, gy - wallH], [cx, gy - hh - wallH],
    [cx + hw, gy - wallH], [cx, gy + hh - wallH]
  ], cTop, ol);
}

function addShadow(ctx, cx, gy, hw, hh) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, gy + hh * 0.6, hw * 0.85, hh * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function battlements(ctx, cx, gy, hw, hh, wallH, color, n = 4) {
  const merlonH = 5;
  // Left edge of top face: (cx-hw, gy-wallH) → (cx, gy-hh-wallH)
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      const t = (i + 0.5) / n;
      const mx = (cx - hw) + (cx - (cx - hw)) * t;
      const my = (gy - wallH) + ((gy - hh - wallH) - (gy - wallH)) * t;
      ctx.fillStyle = color;
      ctx.fillRect(mx - 2, my - merlonH, 4, merlonH);
    }
  }
  // Right edge: (cx, gy-hh-wallH) → (cx+hw, gy-wallH)
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      const t = (i + 0.5) / n;
      const mx = cx + (cx + hw - cx) * t;
      const my = (gy - hh - wallH) + ((gy - wallH) - (gy - hh - wallH)) * t;
      ctx.fillStyle = color;
      ctx.fillRect(mx - 2, my - merlonH, 4, merlonH);
    }
  }
}

function win(ctx, x, y, w, h, lit = false) {
  ctx.fillStyle = lit ? '#ffe082' : '#1a3a5a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, w, h);
  if (lit) {
    ctx.save(); ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(x + 1, y + 1, w - 2, Math.ceil((h - 2) / 2));
    ctx.restore();
  }
}

function chimney(ctx, cx, gy, wallH) {
  const chW = 7; const chH = 14;
  const bx = cx + 12; const by = gy - wallH - 2;
  isoBox(ctx, bx, by, chW / 2, chW / 3, chH, '#2d2d2d', '#111', '#222');
  ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#bbb';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(bx + (i - 1) * 2, by - chH - 2 - i * 4, 2 + i * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function flag(ctx, x, topY, dir, color) {
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, topY + 14); ctx.lineTo(x, topY); ctx.stroke();
  poly(ctx, [[x, topY], [x + dir * 10, topY + 4], [x, topY + 8]], color);
}

// ── Building drawers (cell is 128×128, cx=64 gy=92 hw=40 hh=20) ─

const CX = 64, GY = 92, HW = 40, HH = 20;

function b0_barn(ctx) {
  const wH = 36;
  isoBox(ctx, CX, GY, HW, HH, wH, '#d4a84b', '#7a4a1e', '#a0622a');
  // Gabled roof
  const roofPts = [
    [CX - HW, GY - wH], [CX, GY - HH - wH],
    [CX, GY - HH - wH - 18], [CX - HW, GY - wH - 9]
  ];
  poly(ctx, roofPts, '#b8862a', 'rgba(0,0,0,0.3)');
  poly(ctx, [
    [CX, GY - HH - wH], [CX + HW, GY - wH],
    [CX + HW, GY - wH - 9], [CX, GY - HH - wH - 18]
  ], '#c89830', 'rgba(0,0,0,0.3)');
  win(ctx, CX - 9, GY + HH - wH - 14, 10, 13);
  ctx.fillStyle = '#3a1a00'; ctx.fillRect(CX - 4, GY + HH - wH - 14, 2, 13);
}

function b1_mill(ctx) {
  const wH = 42;
  isoBox(ctx, CX, GY, HW, HH, wH, '#b0b0b0', '#606060', '#8a8a8a');
  // Blades on right face
  const bx = CX + HW - 2, by = GY - wH / 2;
  ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI / 2) + 0.4;
    ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(a) * 16, by + Math.sin(a) * 10); ctx.stroke();
  }
  ctx.fillStyle = '#7a5a10';
  ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
  win(ctx, CX - 5, GY + HH - wH - 18, 8, 9);
}

function b2_wall(ctx) {
  const wH = 20;
  isoBox(ctx, CX, GY, HW, HH, wH, '#9ca3af', '#4b5563', '#6b7280');
  battlements(ctx, CX, GY, HW, HH, wH, '#8090a0', 4);
}

function b3_tower(ctx) {
  const tw = HW * 0.65, th = HH * 0.65, wH = 60;
  isoBox(ctx, CX, GY, tw, th, wH, '#9ca3af', '#4b5563', '#6b7280');
  battlements(ctx, CX, GY, tw, th, wH, '#7a8a9a', 3);
  win(ctx, CX + 4, GY + th - wH - 22, 7, 12);
}

function b4_barracks(ctx) {
  const wH = 38;
  isoBox(ctx, CX, GY, HW, HH, wH, '#ef4444', '#450a0a', '#7f1d1d');
  flag(ctx, CX - HW + 4, GY - wH - 14, 1, '#dc2626');
  flag(ctx, CX + 4, GY - HH - wH - 10, 1, '#b91c1c');
  win(ctx, CX - 7, GY + HH - wH - 16, 8, 9);
}

function b5_tavern(ctx) {
  const wH = 36;
  isoBox(ctx, CX, GY, HW, HH, wH, '#d97706', '#78350f', '#92400e');
  // Lit window
  win(ctx, CX + 8, GY + HH - wH - 18, 9, 11, true);
  // Sign board
  ctx.fillStyle = '#5c2a06'; ctx.fillRect(CX - 18, GY + HH - wH - 26, 16, 8);
  ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('INN', CX - 10, GY + HH - wH - 20);
  ctx.textAlign = 'left';
}

function b6_market(ctx) {
  const wH = 30;
  isoBox(ctx, CX, GY, HW, HH, wH, '#fbbf24', '#b45309', '#d97706');
  // Striped canopy on top face (alternating strips)
  const stripes = 5;
  for (let i = 0; i < stripes; i++) {
    const t1 = i / stripes, t2 = (i + 0.5) / stripes;
    poly(ctx, [
      [(CX - HW) * (1 - t1) + (CX + HW) * t1, (GY - wH) * (1 - t1) + (GY - HH - wH) * t1],
      [(CX - HW) * (1 - t2) + (CX + HW) * t2, (GY - wH) * (1 - t2) + (GY - HH - wH) * t2],
      [(CX - HW) * (1 - t2) + (CX + HW) * t2 + 0, (GY + HH - wH) * (1 - t2) + (GY - wH) * t2],
      [(CX - HW) * (1 - t1) + (CX + HW) * t1 + 0, (GY + HH - wH) * (1 - t1) + (GY - wH) * t1]
    ], i % 2 === 0 ? 'rgba(255,236,153,0.5)' : 'rgba(217,119,6,0.4)');
  }
}

function b7_throne(ctx) {
  const wH = 52;
  isoBox(ctx, CX, GY, HW + 5, HH + 2, wH, '#ffd700', '#7c2d12', '#b45309');
  // Side towers
  isoBox(ctx, CX - HW + 2, GY - 3, 9, 4, wH + 10, '#e6c300', '#5a2008', '#8a3a10');
  isoBox(ctx, CX + HW - 2, GY - 3, 9, 4, wH + 10, '#e6c300', '#5a2008', '#8a3a10');
  win(ctx, CX - 7, GY + HH - wH - 26, 10, 14, true);
  flag(ctx, CX, GY - HH - wH - 14, 1, '#b91c1c');
}

function b8_library(ctx) {
  const wH = 44;
  isoBox(ctx, CX, GY, HW, HH, wH, '#1e40af', '#172554', '#1e3a8a');
  // Arched window
  const wx = CX + 10, wy = GY + HH - wH - 22;
  ctx.fillStyle = '#7dd3fc';
  ctx.fillRect(wx, wy + 4, 7, 10);
  ctx.beginPath(); ctx.arc(wx + 3.5, wy + 4, 3.5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#93c5fd'; ctx.font = '10px serif'; ctx.textAlign = 'center';
  ctx.fillText('📚', CX - 8, GY + HH - wH - 14);
  ctx.textAlign = 'left';
}

function b9_stable(ctx) {
  const wH = 32;
  isoBox(ctx, CX, GY, HW + 8, HH + 4, wH, '#d97706', '#78350f', '#92400e');
  // Hay straws on right face
  ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(CX + 4 + i * 7, GY + HH - wH - 4);
    ctx.lineTo(CX + 2 + i * 7, GY + HH - wH - 13);
    ctx.stroke();
  }
  win(ctx, CX - 12, GY + HH - wH - 18, 12, 17);
}

function b10_smithy(ctx) {
  const wH = 34;
  isoBox(ctx, CX, GY, HW, HH, wH, '#374151', '#111827', '#1f2937');
  chimney(ctx, CX, GY, wH);
  // Orange forge glow
  ctx.save(); ctx.globalAlpha = 0.65;
  const g = ctx.createRadialGradient(CX + 8, GY + HH - wH - 6, 2, CX + 8, GY + HH - wH - 6, 14);
  g.addColorStop(0, '#f97316'); g.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = g; ctx.fillRect(CX - 4, GY + HH - wH - 20, 24, 22);
  ctx.restore();
}

function b11_sawmill(ctx) {
  const wH = 32;
  isoBox(ctx, CX, GY, HW, HH, wH, '#a16207', '#713f12', '#854d0e');
  // Stacked logs
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = '#92400e';
    ctx.strokeStyle = '#5a2d08'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.ellipse(CX + 16, GY + HH - wH + i * 5 - 8, 9, 3, -0.25, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b3010';
    ctx.beginPath();
    ctx.ellipse(CX + 16, GY + HH - wH + i * 5 - 8, 5, 2, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function b12_trap(ctx) {
  const wH = 16;
  isoBox(ctx, CX, GY, HW * 0.55, HH * 0.55, wH, '#fbbf24', '#b45309', '#d97706');
  ctx.fillStyle = '#dc2626'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('!', CX, GY - wH - HH * 0.55 + 2);
  ctx.textAlign = 'left';
}

function b13_embassy(ctx) {
  const wH = 44;
  isoBox(ctx, CX, GY, HW, HH, wH, '#e2e8f0', '#94a3b8', '#cbd5e1');
  flag(ctx, CX - 14, GY - wH - 16, 1, '#0f3460');
  flag(ctx, CX + 10, GY - wH - 16, -1, '#0f3460');
  win(ctx, CX - 6, GY + HH - wH - 24, 9, 14, true);
}

function b14_farmplot(ctx) {
  const wH = 8;
  isoBox(ctx, CX, GY, HW, HH, wH, '#78350f', '#3b1a06', '#4a2008');
  // Furrows across top face
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    const lx = (CX - HW) + (CX - (CX - HW)) * 2 * t;
    const rx = CX + (CX + HW - CX) * 2 * t;
    const ly = (GY - wH) + ((GY - HH - wH) - (GY - wH)) * 2 * t;
    const ry = (GY + HH - wH) + ((GY - wH) - (GY + HH - wH)) * 2 * t;
    ctx.strokeStyle = '#2d1106'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lx, ly + i * 1); ctx.lineTo(rx, ry + i * 1); ctx.stroke();
  }
}

function b15_construction(ctx) {
  const wH = 30;
  const ol = 'rgba(0,0,0,0.3)';
  // Open-top walls
  poly(ctx, [
    [CX - HW, GY], [CX, GY + HH],
    [CX, GY + HH - wH], [CX - HW, GY - wH]
  ], '#92400e', ol);
  poly(ctx, [
    [CX, GY + HH], [CX + HW, GY],
    [CX + HW, GY - wH], [CX, GY + HH - wH]
  ], '#b45309', ol);
  // Scaffolding
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2;
  for (const [px, py] of [
    [CX - HW + 5, GY - wH],
    [CX, GY + HH - wH],
    [CX + HW - 5, GY - wH]
  ]) {
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 22); ctx.stroke();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px - 9, py - 15); ctx.lineTo(px + 9, py - 15); ctx.stroke();
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 2;
  }
}

const BUILDING_DRAWERS = [
  b0_barn, b1_mill, b2_wall, b3_tower, b4_barracks, b5_tavern,
  b6_market, b7_throne, b8_library, b9_stable, b10_smithy, b11_sawmill,
  b12_trap, b13_embassy, b14_farmplot, b15_construction
];

// ── Generate buildings.png ────────────────────────────────────────

function genBuildings() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');

  for (let idx = 0; idx < 16; idx++) {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const ox = col * 128, oy = row * 128;

    ctx.save();
    ctx.translate(ox, oy);
    addShadow(ctx, CX, GY, HW + 6, HH + 3);
    BUILDING_DRAWERS[idx](ctx);
    ctx.restore();
  }

  fs.writeFileSync(path.join(OUT, 'buildings.png'), canvas.toBuffer('image/png'));
  console.log('✓ buildings.png');
}

// ── Terrain tile helpers ──────────────────────────────────────────

function grass1(ctx) {
  ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 22; i++) {
    const px = (i * 7 + 3) % 32, py = (i * 13 + 5) % 32;
    ctx.fillStyle = i % 3 === 0 ? '#4a7028' : '#66a044';
    ctx.fillRect(px, py, 2, 2);
  }
}

function grass2(ctx) {
  ctx.fillStyle = '#4e8030'; ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 22; i++) {
    const px = (i * 11 + 7) % 32, py = (i * 5 + 11) % 32;
    ctx.fillStyle = i % 3 === 0 ? '#3a6020' : '#5a9038';
    ctx.fillRect(px, py, 2, 2);
  }
}

const TERRAIN_DRAWERS = [
  // 0 GRASS1
  (ctx) => { grass1(ctx); },
  // 1 GRASS2
  (ctx) => { grass2(ctx); },
  // 2 DIRT
  (ctx) => {
    ctx.fillStyle = '#8b6343'; ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = (i % 2) === 0 ? '#7a5535' : '#9a7050';
      ctx.fillRect((i * 9 + 5) % 30, (i * 7 + 3) % 30, 3, 2);
    }
  },
  // 3 DIRT_LIGHT
  (ctx) => {
    ctx.fillStyle = '#b08060'; ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = '#c09070';
      ctx.fillRect((i * 7 + 3) % 30, (i * 11 + 7) % 30, 2, 2);
    }
  },
  // 4 WATER
  (ctx) => {
    ctx.fillStyle = '#1e6fa8'; ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#2a86c8'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 5 + i * 8);
      ctx.bezierCurveTo(8, 3 + i * 8, 16, 8 + i * 8, 24, 5 + i * 8);
      ctx.lineTo(32, 5 + i * 8); ctx.stroke();
    }
  },
  // 5 SAND
  (ctx) => {
    ctx.fillStyle = '#d4b483'; ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = '#c0a070';
      ctx.fillRect((i * 13 + 7) % 31, (i * 7 + 5) % 31, 1, 1);
    }
  },
  // 6 STONE
  (ctx) => {
    ctx.fillStyle = '#9ca3af'; ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 0.5;
    for (let x = 0; x < 32; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 32); ctx.stroke(); }
    for (let y = 0; y < 32; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(32, y); ctx.stroke(); }
  },
  // 7 FLOWER_RED
  (ctx) => {
    grass1(ctx);
    for (let i = 0; i < 5; i++) {
      const px = (i * 7 + 4) % 24 + 4, py = (i * 5 + 6) % 20 + 6;
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py + 5); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 8 FLOWER_BLUE
  (ctx) => {
    grass1(ctx);
    for (let i = 0; i < 5; i++) {
      const px = (i * 11 + 3) % 24 + 4, py = (i * 7 + 4) % 20 + 6;
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, py + 5); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }
  },
  // 9 FENCE_H
  (ctx) => {
    grass1(ctx);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, 13, 32, 3); ctx.fillRect(0, 19, 32, 3);
    for (const x of [1, 11, 22]) ctx.fillRect(x, 10, 3, 13);
  },
  // 10 FENCE_V
  (ctx) => {
    grass1(ctx);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(13, 0, 3, 32); ctx.fillRect(19, 0, 3, 32);
    for (const y of [1, 11, 22]) ctx.fillRect(10, y, 13, 3);
  },
  // 11 TREE
  (ctx) => {
    grass1(ctx);
    ctx.fillStyle = '#92400e'; ctx.fillRect(14, 19, 4, 12);
    ctx.fillStyle = '#15803d';
    ctx.beginPath(); ctx.arc(16, 14, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.beginPath(); ctx.arc(16, 11, 7, 0, Math.PI * 2); ctx.fill();
  },
  // 12 ROCK
  (ctx) => {
    ctx.fillStyle = '#9ca3af'; ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 0.5;
    for (let x = 0; x < 32; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 32); ctx.stroke(); }
    for (let y = 0; y < 32; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(32, y); ctx.stroke(); }
    ctx.fillStyle = '#78716c';
    ctx.beginPath(); ctx.ellipse(16, 19, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath(); ctx.ellipse(13, 16, 4, 3, -0.3, 0, Math.PI * 2); ctx.fill();
  },
  // 13 BRIDGE
  (ctx) => {
    ctx.fillStyle = '#1e6fa8'; ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#a16207';
    for (let y = 2; y < 32; y += 6) {
      ctx.fillRect(0, y, 32, 4);
      ctx.strokeStyle = '#854d0e'; ctx.lineWidth = 0.5; ctx.strokeRect(0, y, 32, 4);
    }
  },
  // 14 GRASS_DIRT
  (ctx) => {
    ctx.fillStyle = '#5a8a3a'; ctx.fillRect(0, 0, 32, 16);
    ctx.fillStyle = '#8b6343'; ctx.fillRect(0, 16, 32, 16);
    for (let x = 0; x < 32; x++) {
      const h = 14 + Math.round(Math.sin(x * 0.7) * 2);
      ctx.fillStyle = x % 2 === 0 ? '#6a7840' : '#7a6040';
      ctx.fillRect(x, h, 1, 5);
    }
  },
  // 15 FENCE_CORNER
  (ctx) => {
    grass1(ctx);
    ctx.fillStyle = '#92400e';
    ctx.fillRect(14, 0, 4, 32); ctx.fillRect(0, 14, 32, 4);
    ctx.fillRect(12, 12, 8, 8);
  },
  // 16 GRASS_DARK
  (ctx) => {
    ctx.fillStyle = '#2d6a1e'; ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1e5010' : '#3a7a26';
      ctx.fillRect((i * 11 + 5) % 30, (i * 7 + 9) % 30, 2, 2);
    }
  },
  // 17 COBBLESTONE
  (ctx) => {
    ctx.fillStyle = '#94a3b8'; ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 0.7;
    for (let row = 0; row < 5; row++) {
      const off = row % 2 === 0 ? 0 : 3;
      for (let col = 0; col < 7; col++) ctx.strokeRect(off + col * 6 - 1, row * 6 - 1, 5, 5);
    }
  },
  // 18 TALL_GRASS
  (ctx) => {
    grass2(ctx);
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const px = (i * 7 + 3) % 28 + 2;
      const h = 8 + (i % 3) * 5;
      ctx.beginPath(); ctx.moveTo(px, 30);
      ctx.quadraticCurveTo(px + (i % 3 - 1) * 4, 30 - h / 2, px + (i % 2) * 3 - 1, 30 - h);
      ctx.stroke();
    }
  },
];

// ── Generate terrain.png ──────────────────────────────────────────

function genTerrain() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');

  for (let idx = 0; idx < TERRAIN_DRAWERS.length; idx++) {
    const col = idx % 16;
    const row = Math.floor(idx / 16);
    ctx.save();
    ctx.translate(col * 32, row * 32);
    TERRAIN_DRAWERS[idx](ctx);
    ctx.restore();
  }

  fs.writeFileSync(path.join(OUT, 'terrain.png'), canvas.toBuffer('image/png'));
  console.log('✓ terrain.png');
}

// ── Generate farm_tiles.png ───────────────────────────────────────

function genFarmTiles() {
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');

  for (let watered = 0; watered <= 1; watered++) {
    for (let stage = 0; stage < 4; stage++) {
      ctx.save();
      ctx.translate(stage * 64, watered * 64);

      // Soil base
      ctx.fillStyle = watered ? '#5a3a1a' : '#6b4423';
      ctx.fillRect(0, 0, 64, 64);

      // Furrows
      ctx.strokeStyle = watered ? '#3a2010' : '#4a3015'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(6, 14 + i * 12); ctx.lineTo(58, 14 + i * 12); ctx.stroke();
      }

      if (watered) {
        ctx.save(); ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#3b82f6'; ctx.fillRect(0, 0, 64, 64);
        ctx.restore();
      }

      if (stage >= 1) {
        // Sprouts
        for (let i = 0; i < 4; i++) {
          const sx = 10 + i * 14;
          ctx.fillStyle = '#4ade80'; ctx.fillRect(sx, 26, 4, 10);
          ctx.fillStyle = '#22c55e'; ctx.fillRect(sx - 3, 20, 10, 8);
        }
      }
      if (stage >= 2) {
        // Growing
        for (let i = 0; i < 4; i++) {
          const sx = 10 + i * 14;
          ctx.fillStyle = '#22c55e'; ctx.fillRect(sx, 14, 5, 22);
          ctx.fillStyle = '#16a34a'; ctx.fillRect(sx - 3, 8, 11, 10);
        }
      }
      if (stage >= 3) {
        // Ready - golden tops
        for (let i = 0; i < 4; i++) {
          const sx = 10 + i * 14;
          ctx.fillStyle = '#15803d'; ctx.fillRect(sx, 12, 5, 24);
          ctx.fillStyle = '#eab308'; ctx.fillRect(sx - 4, 4, 13, 10);
          ctx.fillStyle = '#ca8a04'; ctx.fillRect(sx - 3, 5, 3, 8);
          ctx.fillRect(sx + 1, 5, 3, 8); ctx.fillRect(sx + 5, 5, 3, 8);
        }
      }

      ctx.restore();
    }
  }

  fs.writeFileSync(path.join(OUT, 'farm_tiles.png'), canvas.toBuffer('image/png'));
  console.log('✓ farm_tiles.png');
}

// ── Run ───────────────────────────────────────────────────────────

genBuildings();
genTerrain();
genFarmTiles();
console.log('All sprites generated.');
