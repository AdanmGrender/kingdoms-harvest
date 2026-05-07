/**
 * Generates all sprite sheets for Kingdoms Harvest.
 * Run: node scripts/generate_sprites.js
 *
 * Outputs:
 *   tilesets/buildings.png   512×512, 16 frames 128×128
 *   tilesets/terrain.png     512×512, tiles 32×32
 *   tilesets/farm_tiles.png  256×256, stages 64×64
 *   characters/npc_*.png     64×48 each (2 frames 32×48)
 *   characters/villager.png  128×48 (4 frames 32×48)
 *   animals/chicken.png      128×32 (4 frames 32×32)
 *   animals/cow.png          128×32 (4 frames 32×32)
 *   animals/sheep.png        128×32 (4 frames 32×32)
 */

'use strict';
const { createCanvas } = require('/opt/node22/lib/node_modules/canvas');
const fs = require('fs');
const path = require('path');

const TILES_OUT = path.join(__dirname, '../client/public/assets/game/tilesets');
const CHARS_OUT = path.join(__dirname, '../client/public/assets/game/characters');
const ANIM_OUT  = path.join(__dirname, '../client/public/assets/game/animals');

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill)   { ctx.fillStyle   = fill;   ctx.fill();   }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.8; ctx.stroke(); }
}

// Isometric box: no baked shadow, clean outlines
function isoBox(ctx, cx, gy, hw, hh, wallH, cTop, cLeft, cRight) {
  const ol = 'rgba(0,0,0,0.45)';
  poly(ctx, [[cx-hw,gy],[cx,gy+hh],[cx,gy+hh-wallH],[cx-hw,gy-wallH]], cLeft,  ol);
  poly(ctx, [[cx,gy+hh],[cx+hw,gy],[cx+hw,gy-wallH],[cx,gy+hh-wallH]], cRight, ol);
  poly(ctx, [[cx-hw,gy-wallH],[cx,gy-hh-wallH],[cx+hw,gy-wallH],[cx,gy+hh-wallH]], cTop, ol);
}

function battlements(ctx, cx, gy, hw, hh, wallH, color, n = 5) {
  const mH = 5;
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      const t = (i + 0.5) / n;
      const lx = (cx-hw)*(1-t) + cx*t,         ly = (gy-wallH)*(1-t) + (gy-hh-wallH)*t;
      const rx = cx*(1-t)      + (cx+hw)*t,     ry = (gy-hh-wallH)*(1-t) + (gy-wallH)*t;
      ctx.fillStyle = color;
      ctx.fillRect(lx-2, ly-mH, 4, mH);
      ctx.fillRect(rx-2, ry-mH, 4, mH);
    }
  }
}

function win(ctx, x, y, w, h, lit = false) {
  ctx.fillStyle = lit ? '#ffe082' : '#1a3a5a';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, w, h);
  if (lit) {
    ctx.save(); ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(x+1, y+1, w-2, Math.ceil((h-2)/2));
    ctx.restore();
  }
}

function flag(ctx, x, topY, dir, color) {
  ctx.strokeStyle = '#666'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(x, topY+14); ctx.lineTo(x, topY); ctx.stroke();
  poly(ctx, [[x, topY],[x+dir*10, topY+4],[x, topY+8]], color);
}

function chimney(ctx, cx, gy, wallH) {
  isoBox(ctx, cx+14, gy-wallH+4, 4, 2, 14, '#2d2d2d', '#111', '#222');
  ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#aaa';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(cx+14+(i-1)*2, gy-wallH-12-i*4, 2+i, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDINGS (128×128 per cell, 4×4 grid → 512×512)
// ─────────────────────────────────────────────────────────────────────────────

const CX=64, GY=92, HW=40, HH=20;

function b0_barn(ctx) {
  const wH = 36;
  isoBox(ctx, CX, GY, HW, HH, wH, '#c49a2e','#6b3a14','#8c521e');
  // Gabled roof
  poly(ctx, [[CX-HW,GY-wH],[CX,GY-HH-wH],[CX,GY-HH-wH-18],[CX-HW,GY-wH-9]], '#a07018','rgba(0,0,0,0.3)');
  poly(ctx, [[CX,GY-HH-wH],[CX+HW,GY-wH],[CX+HW,GY-wH-9],[CX,GY-HH-wH-18]], '#b88420','rgba(0,0,0,0.3)');
  // Thatch lines on left roof face
  ctx.strokeStyle='rgba(80,40,0,0.22)'; ctx.lineWidth=1.2;
  for (let r=0; r<5; r++) {
    const t=r/5;
    const x0=CX-HW+(CX-CX+HW)*t, y0=(GY-wH)+(GY-HH-wH-GY+wH)*t;
    const x1=CX+(CX-CX)*t,        y1=(GY-HH-wH)+(GY-HH-wH-GY+HH+wH)*t;
    ctx.beginPath(); ctx.moveTo(x0, y0-9*t); ctx.lineTo(x1, y1-9*t); ctx.stroke();
  }
  // Thatch highlight on right roof edge
  ctx.strokeStyle='rgba(200,160,30,0.35)'; ctx.lineWidth=1;
  for (let r=0; r<4; r++) {
    const t=r/4;
    const x0=CX+(CX+HW-CX)*t, y0=(GY-HH-wH)+(GY-wH-GY+HH+wH)*t;
    ctx.beginPath(); ctx.moveTo(x0, y0-8*t); ctx.lineTo(x0+4, y0-7*t+2); ctx.stroke();
  }
  // Door
  ctx.fillStyle='#3a1a00'; ctx.fillRect(CX-5, GY+HH-wH-2, 10, 18);
  ctx.fillStyle='#5a2a00'; ctx.fillRect(CX-4, GY+HH-wH, 4, 15);
  ctx.fillStyle='rgba(255,220,100,0.15)'; ctx.fillRect(CX-5, GY+HH-wH-2, 3, 18); // door shine
  // Window
  win(ctx, CX+10, GY+HH-wH-18, 10, 12);
  // Plank lines on left face
  ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=1;
  for (let i=1; i<5; i++) {
    const t=i/5, y=GY-wH*t;
    ctx.beginPath(); ctx.moveTo(CX-HW, y); ctx.lineTo(CX, y+HH); ctx.stroke();
  }
}

function b1_mill(ctx) {
  const wH = 44;
  const tw = HW*0.7, th = HH*0.7;
  isoBox(ctx, CX, GY, tw, th, wH, '#c0c0b8','#505850','#787870');
  // Stone rows on left face
  ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5;
  for (let r=1; r<5; r++) { const y=GY-wH*r/5; ctx.beginPath(); ctx.moveTo(CX-tw,y); ctx.lineTo(CX,y+th); ctx.stroke(); }
  // Mill blades
  const bx=CX+tw-2, by=GY-wH*0.55;
  ctx.strokeStyle='#8b6914'; ctx.lineWidth=4;
  for (let i=0; i<4; i++) {
    const a=i*Math.PI/2+0.35;
    ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+Math.cos(a)*22, by+Math.sin(a)*14); ctx.stroke();
  }
  ctx.fillStyle='#c8a030';
  for (let i=0; i<4; i++) {
    const a=i*Math.PI/2+0.35;
    const ex=bx+Math.cos(a)*22, ey=by+Math.sin(a)*14;
    ctx.fillRect(ex-4, ey-6, 8, 12);
  }
  ctx.fillStyle='#7a5a10'; ctx.beginPath(); ctx.arc(bx,by,5,0,Math.PI*2); ctx.fill();
  win(ctx, CX-5, GY+th-wH-10, 8, 10);
}

function b2_wall(ctx) {
  const wH = 22;
  isoBox(ctx, CX, GY, HW, HH, wH, '#8090a8','#3a4858','#506070');
  // Stone block texture on right face
  ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.5;
  for (let row=0; row<3; row++) {
    const off=(row%2===0)?0:7, y0=GY+HH-wH+row*7;
    for (let col=0; col<6; col++) ctx.strokeRect(CX+off+col*13-HW*0.5, y0, 12, 6);
  }
  // Arrow slits
  ctx.fillStyle='#0d1520';
  ctx.fillRect(CX+8,  GY+HH-wH+1, 2, 9);
  ctx.fillRect(CX+22, GY+HH-wH+1, 2, 9);
  ctx.fillRect(CX+36, GY+HH-wH+1, 2, 9);
  battlements(ctx, CX, GY, HW, HH, wH, '#607080', 6);
  // Gate arch on right face
  ctx.fillStyle='#111'; ctx.fillRect(CX+14, GY-wH+5, 4, 11); ctx.fillRect(CX+15, GY-wH+3, 2, 3);
}

function b3_tower(ctx) {
  const tw=HW*0.55, th=HH*0.55, wH=66;
  isoBox(ctx, CX, GY, tw, th, wH, '#9ca3af','#374151','#4b5563');
  // Brick/stone texture on right face
  ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.lineWidth=0.6;
  for (let row=0; row<6; row++) {
    const off=(row%2===0)?0:5, y0=GY+th-wH+row*10;
    for (let col=0; col<4; col++) {
      ctx.strokeRect(CX+off+col*10-tw*0.3, y0, 9, 9);
    }
  }
  // Arrow slits on left face
  ctx.fillStyle='#111';
  ctx.fillRect(CX-tw*0.55, GY-wH*0.55, 2, 10);
  ctx.fillRect(CX-tw*0.2,  GY-wH*0.75, 2, 10);
  battlements(ctx, CX, GY, tw, th, wH, '#5a6a7a', 4);
  win(ctx, CX+3, GY+th-wH-28, 5, 14);
  win(ctx, CX-8, GY-wH-18, 5, 12);
  // Red conical roof
  poly(ctx, [[CX-tw,GY-wH],[CX,GY-th-wH-14],[CX+tw,GY-wH]], '#c03028');
  poly(ctx, [[CX-tw,GY-wH],[CX,GY-th-wH],[CX,GY-th-wH-14]], '#902018');
}

function b4_barracks(ctx) {
  const wH = 40;
  isoBox(ctx, CX, GY, HW, HH, wH, '#cc3333','#3a0a0a','#6a1010');
  flag(ctx, CX-HW+6, GY-wH-18, 1, '#dc2626');
  flag(ctx, CX+4, GY-HH-wH-13, 1, '#b91c1c');
  // Arched door
  ctx.fillStyle='#1a0a00';
  ctx.fillRect(CX-5, GY+HH-wH-2, 10, 18);
  ctx.beginPath(); ctx.arc(CX, GY+HH-wH-2, 5, Math.PI, 0); ctx.fill();
  win(ctx, CX+12, GY+HH-wH-20, 8, 11);
  // Red stripe on left face
  ctx.fillStyle='rgba(180,10,10,0.3)';
  ctx.fillRect(CX-HW, GY-wH/2, HW, 6);
}

function b5_tavern(ctx) {
  const wH = 36;
  isoBox(ctx, CX, GY, HW, HH, wH, '#c07010','#682808','#8a3808');
  // Wood plank texture on left face
  ctx.strokeStyle='rgba(0,0,0,0.14)'; ctx.lineWidth=1;
  for (let r=1; r<5; r++) {
    const t=r/5, y=GY-wH*t;
    ctx.beginPath(); ctx.moveTo(CX-HW, y); ctx.lineTo(CX, y+HH); ctx.stroke();
  }
  win(ctx, CX+8, GY+HH-wH-20, 11, 13, true);
  win(ctx, CX+22, GY-wH-14, 8, 10, true);
  // Hanging sign board (pixel art — no text)
  const sx=CX-22, sy=GY+HH-wH-33;
  ctx.fillStyle='#3a1a04'; ctx.fillRect(sx, sy, 20, 12);
  ctx.strokeStyle='#7a3808'; ctx.lineWidth=0.8; ctx.strokeRect(sx, sy, 20, 12);
  // Pixel art mug icon on sign
  ctx.fillStyle='#d4a020'; // mug body
  ctx.fillRect(sx+4, sy+3, 8, 6);
  ctx.fillRect(sx+12, sy+4, 3, 4); // handle outer
  ctx.fillStyle='#3a1a04'; ctx.fillRect(sx+13, sy+5, 1, 2); // handle inner cutout
  ctx.fillStyle='rgba(200,240,255,0.6)'; ctx.fillRect(sx+4, sy+3, 4, 2); // foam
  // Sign chain hooks
  ctx.fillStyle='#888'; ctx.fillRect(sx+2, sy-3, 1, 3); ctx.fillRect(sx+17, sy-3, 1, 3);
  // Thatch eave lines on left roof
  ctx.strokeStyle='rgba(120,70,10,0.25)'; ctx.lineWidth=1.5;
  for (let r=0; r<4; r++) {
    const y=GY-wH-2+r*3;
    ctx.beginPath(); ctx.moveTo(CX-HW, y); ctx.lineTo(CX, y-HH); ctx.stroke();
  }
}

function b6_market(ctx) {
  const wH = 28;
  isoBox(ctx, CX, GY, HW+4, HH+2, wH, '#f0b820','#8a4010','#c07020');
  // Awning extensions
  poly(ctx, [[CX-HW-4,GY-wH],[CX,GY-HH-wH],[CX,GY-HH-wH+7],[CX-HW-4,GY-wH+8]], '#e8a018','rgba(0,0,0,0.3)');
  poly(ctx, [[CX,GY-HH-wH],[CX+HW+4,GY-wH],[CX+HW+4,GY-wH+8],[CX,GY-HH-wH+7]], '#f5c030','rgba(0,0,0,0.3)');
  // Awning stripes on top face
  for (let i=0; i<5; i++) {
    const t1=i/5, t2=(i+0.5)/5;
    const ax1=CX-HW-4+((HW+4)*2)*t1, ay1=GY-wH+(HH+2)*2*t1;
    const ax2=CX-HW-4+((HW+4)*2)*t2, ay2=GY-wH+(HH+2)*2*t2;
    if (i%2===0) { ctx.fillStyle='rgba(255,230,60,0.4)'; ctx.fillRect(ax1,GY-wH-2,ax2-ax1,5); }
  }
  // Goods
  ctx.fillStyle='#ef4444'; ctx.fillRect(CX+18, GY+HH+2-wH-15, 5, 5);
  ctx.fillStyle='#f97316'; ctx.fillRect(CX+25, GY+HH+2-wH-13, 5, 5);
  ctx.fillStyle='#eab308'; ctx.fillRect(CX+31, GY+HH+2-wH-11, 5, 5);
}

function b7_throne(ctx) {
  const wH = 54;
  isoBox(ctx, CX, GY, HW+6, HH+3, wH, '#ffd700','#6a1a05','#a83010');
  // Side towers
  isoBox(ctx, CX-HW+2, GY-4, 10, 5, wH+14, '#e8c400','#4a1405','#7a2010');
  isoBox(ctx, CX+HW-2, GY-4, 10, 5, wH+14, '#e8c400','#4a1405','#7a2010');
  win(ctx, CX-8, GY+HH-wH-32, 12, 20, true);
  win(ctx, CX+14, GY-wH-24, 9, 14, true);
  flag(ctx, CX, GY-HH-wH-17, 1, '#b91c1c');
  // Tower peaks
  ctx.fillStyle='#c03028';
  ctx.beginPath(); ctx.moveTo(CX-HW+2,GY-wH-14); ctx.lineTo(CX-HW+7,GY-wH-30); ctx.lineTo(CX-HW+12,GY-wH-14); ctx.fill();
  ctx.beginPath(); ctx.moveTo(CX+HW-12,GY-wH-14); ctx.lineTo(CX+HW-7,GY-wH-30); ctx.lineTo(CX+HW-2,GY-wH-14); ctx.fill();
  // Gold rim highlight
  ctx.strokeStyle='rgba(255,250,180,0.6)'; ctx.lineWidth=1.5;
  poly(ctx, [[CX-HW-6,GY-wH],[CX,GY-HH-wH],[CX+HW+6,GY-wH],[CX,GY+HH-wH]], null, 'rgba(255,240,100,0.5)');
  // Extra shimmer dots on top face
  ctx.fillStyle='rgba(255,250,150,0.5)';
  for (const [dx,dy] of [[-10,-5],[5,-10],[20,-5],[35,-2]]) ctx.fillRect(CX+dx, GY-HH-wH+dy, 3, 2);
  // Side tower flags
  flag(ctx, CX-HW+5, GY-wH-22, 1, '#dc2626');
  flag(ctx, CX+HW-5, GY-wH-22, -1, '#dc2626');
}

function b8_library(ctx) {
  const wH = 46;
  isoBox(ctx, CX, GY, HW, HH, wH, '#2563eb','#1e2080','#1a3aaf');
  // Arched windows on right face
  for (const wx of [CX+7, CX+20]) {
    const wy = GY+HH-wH-28;
    ctx.fillStyle='#93c5fd'; ctx.fillRect(wx, wy+5, 7, 14);
    ctx.beginPath(); ctx.arc(wx+3.5, wy+5, 3.5, Math.PI, 0); ctx.fill();
    ctx.fillStyle='#1e40af'; ctx.fillRect(wx+3, wy+5, 1, 15); ctx.fillRect(wx, wy+11, 7, 1);
  }
  // Pixel art book spines on left face
  const booksData = [
    [CX-36, GY-wH/2-7, '#dc2626'],
    [CX-31, GY-wH/2-9, '#1e40af'],
    [CX-26, GY-wH/2-6, '#15803d'],
    [CX-21, GY-wH/2-8, '#7e22ce'],
    [CX-16, GY-wH/2-5, '#92400e'],
  ];
  for (const [bx, by, bc] of booksData) {
    ctx.fillStyle=bc; ctx.fillRect(bx, by, 4, 13);
    ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.fillRect(bx, by, 1, 13);
    ctx.fillStyle='rgba(0,0,0,0.18)'; ctx.fillRect(bx+3, by, 1, 13);
  }
}

function b9_stable(ctx) {
  const wH = 30;
  isoBox(ctx, CX, GY, HW+10, HH+5, wH, '#b87020','#5a2808','#7a3810');
  // Stall doors on right face
  for (const dx of [CX+4, CX+18]) {
    ctx.fillStyle='#8b4513'; ctx.fillRect(dx, GY+HH+5-wH, 9, 20);
    ctx.strokeStyle='#5a2a06'; ctx.lineWidth=0.7; ctx.strokeRect(dx, GY+HH+5-wH, 9, 20);
    ctx.fillStyle='#6b3410'; ctx.fillRect(dx+4, GY+HH+5-wH, 1, 20);
    ctx.fillRect(dx, GY+HH+5-wH+9, 9, 1);
  }
  // Hay on left face
  ctx.strokeStyle='#f0c030'; ctx.lineWidth=1.5;
  for (let i=0; i<5; i++) {
    const bx=CX-HW-2+i*7;
    ctx.beginPath(); ctx.moveTo(bx, GY-4); ctx.quadraticCurveTo(bx+3, GY-12, bx+1, GY-18); ctx.stroke();
  }
  // Roof overhang
  poly(ctx, [[CX-HW-10,GY-wH],[CX,GY-HH-wH],[CX,GY-HH-wH+7],[CX-HW-10,GY-wH+8]], 'rgba(180,110,30,0.6)','rgba(0,0,0,0.3)');
}

function b10_smithy(ctx) {
  const wH = 36;
  isoBox(ctx, CX, GY, HW, HH, wH, '#2d3748','#0d1117','#111827');
  chimney(ctx, CX, GY, wH);
  // Forge glow
  ctx.save(); ctx.globalAlpha=0.65;
  const g = ctx.createRadialGradient(CX+10, GY+HH-wH-4, 1, CX+10, GY+HH-wH-4, 22);
  g.addColorStop(0,'#f97316'); g.addColorStop(0.5,'rgba(249,115,22,0.4)'); g.addColorStop(1,'rgba(249,115,22,0)');
  ctx.fillStyle=g; ctx.fillRect(CX-2, GY+HH-wH-24, 30, 28);
  ctx.restore();
  // Door with orange glow
  ctx.fillStyle='#ea6010'; ctx.fillRect(CX+4, GY+HH-wH-2, 10, 20);
  ctx.fillStyle='#fbbf24'; ctx.fillRect(CX+6, GY+HH-wH, 6, 16);
  // Sparks
  ctx.fillStyle='rgba(255,220,50,0.9)';
  for (const [sx,sy] of [[CX+13,GY+HH-wH-10],[CX+19,GY+HH-wH-16],[CX+8,GY+HH-wH-20]])
    ctx.fillRect(sx, sy, 2, 2);
  // Anvil
  ctx.fillStyle='#374151'; ctx.fillRect(CX+20, GY+HH-wH-8, 14, 6); ctx.fillRect(CX+23, GY+HH-wH-11, 8, 3);
}

function b11_sawmill(ctx) {
  const wH = 30;
  isoBox(ctx, CX, GY, HW, HH, wH, '#8a5a10','#5a2a08','#6a3a0e');
  // Circular saw blade
  const sx=CX+HW-4, sy=GY-wH*0.5;
  ctx.fillStyle='#c8c8c8'; ctx.beginPath(); ctx.arc(sx,sy,14,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e8e8e8'; ctx.beginPath(); ctx.arc(sx,sy,10,0,Math.PI*2); ctx.fill();
  for (let i=0; i<14; i++) {
    const a=i*Math.PI/7;
    ctx.fillStyle='#888'; ctx.fillRect(sx+Math.cos(a)*11-1, sy+Math.sin(a)*7-1, 3, 3);
  }
  ctx.fillStyle='#555'; ctx.beginPath(); ctx.arc(sx,sy,4,0,Math.PI*2); ctx.fill();
  // Stacked logs
  for (let i=0; i<3; i++) {
    ctx.fillStyle='#7a4010'; ctx.beginPath();
    ctx.ellipse(CX-14, GY+HH-wH+i*6-8, 12, 4, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle='#5a2a06'; ctx.beginPath();
    ctx.ellipse(CX-14, GY+HH-wH+i*6-8, 7, 2.5, -0.2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle='#9b6030'; ctx.lineWidth=0.5; ctx.beginPath();
    ctx.ellipse(CX-14, GY+HH-wH+i*6-8, 4, 1.5, -0.2, 0, Math.PI*2); ctx.stroke();
  }
}

function b12_trap(ctx) {
  const wH = 18;
  isoBox(ctx, CX, GY, HW*0.5, HH*0.5, wH, '#d4a010','#7a5010','#b07020');
  // Warning triangle
  const tx=CX, ty=GY-wH-HH*0.5-14;
  ctx.fillStyle='#dc2626';
  ctx.beginPath(); ctx.moveTo(tx,ty-8); ctx.lineTo(tx+9,ty+7); ctx.lineTo(tx-9,ty+7); ctx.closePath(); ctx.fill();
  ctx.fillStyle='white'; ctx.font='bold 9px sans-serif'; ctx.textAlign='center';
  ctx.fillText('!', tx, ty+6); ctx.textAlign='left';
  // Spike tips
  ctx.fillStyle='#b0b0b0';
  for (const dx of [-10,-3,4,11]) { ctx.fillRect(CX+dx-1, GY+HH*0.5-5, 2, 7); ctx.fillRect(CX+dx-1, GY+HH*0.5-7, 2, 2); }
}

function b13_embassy(ctx) {
  const wH = 46;
  isoBox(ctx, CX, GY, HW, HH, wH, '#e8eef8','#7a8a9a','#aab4c8');
  // Columns on right face — wider capitals
  ctx.fillStyle='#f4f8ff';
  for (const dx of [CX+5, CX+17, CX+29]) {
    ctx.fillRect(dx+1, GY+HH-wH+6, 3, wH-10); // shaft
    ctx.fillRect(dx-1, GY+HH-wH+2, 7, 5);      // capital top
    ctx.fillRect(dx-1, GY+HH-4,    7, 4);       // base
  }
  ctx.fillStyle='rgba(200,210,230,0.5)';
  for (const dx of [CX+5, CX+17, CX+29]) {
    ctx.fillRect(dx+2, GY+HH-wH+6, 1, wH-10); // column highlight
  }
  flag(ctx, CX-12, GY-wH-22, 1, '#0f3460');
  flag(ctx, CX+14, GY-wH-22, -1, '#0f3460');
  win(ctx, CX-8, GY+HH-wH-32, 10, 20, true);
  // Pediment triangle (top face decoration)
  ctx.strokeStyle='rgba(140,155,180,0.9)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(CX-HW,GY-wH); ctx.lineTo(CX,GY-HH-wH-12); ctx.lineTo(CX+HW,GY-wH); ctx.stroke();
  // Fill pediment
  ctx.fillStyle='rgba(220,228,245,0.35)';
  ctx.beginPath(); ctx.moveTo(CX-HW,GY-wH); ctx.lineTo(CX,GY-HH-wH-12); ctx.lineTo(CX+HW,GY-wH); ctx.closePath(); ctx.fill();
  // Frieze band below pediment
  ctx.fillStyle='rgba(150,165,190,0.4)';
  ctx.fillRect(CX-HW, GY-wH-1, HW*2, 5);
}

function b14_farmplot(ctx) {
  const wH = 10;
  isoBox(ctx, CX, GY, HW, HH, wH, '#92400e','#3a1a06','#5a2a0e');
  // Furrows on top face
  for (let i=0; i<5; i++) {
    const t=(i+0.5)/5;
    const x1=CX-HW+(HW)*(2*t), y1=GY-wH+HH*(1-2*t);
    const x2=CX+(HW)*(2*t-1)+HW, y2=GY-wH-HH*(2*t-1)+HH;
    ctx.strokeStyle='#2d1106'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1+HW, y1-HH); ctx.stroke();
  }
}

function b15_construction(ctx) {
  const wH = 32;
  const ol='rgba(0,0,0,0.3)';
  poly(ctx, [[CX-HW,GY],[CX,GY+HH],[CX,GY+HH-wH],[CX-HW,GY-wH]], '#8a4a1e', ol);
  poly(ctx, [[CX,GY+HH],[CX+HW,GY],[CX+HW,GY-wH],[CX,GY+HH-wH]], '#a86030', ol);
  // Scaffolding poles
  ctx.strokeStyle='#d97706'; ctx.lineWidth=2.5;
  for (const [px,py] of [[CX-HW+6,GY-wH],[CX,GY+HH-wH],[CX+HW-6,GY-wH]]) {
    ctx.beginPath(); ctx.moveTo(px,py+4); ctx.lineTo(px,py-28); ctx.stroke();
  }
  ctx.strokeStyle='#b45309'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(CX-HW+6,GY-wH-14); ctx.lineTo(CX+HW-6,GY-wH-14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(CX-HW+6,GY-wH-24); ctx.lineTo(CX+HW-6,GY-wH-24); ctx.stroke();
  // Partial brickwork
  for (let i=0; i<2; i++) {
    ctx.fillStyle = i%2===0 ? '#c4742a' : '#b86820';
    ctx.fillRect(CX-HW+2, GY-i*(wH/3)-6, HW*0.8, 5);
  }
  // Pixel art hammer (head + handle)
  ctx.fillStyle='#909090'; ctx.fillRect(CX-7, GY-wH-40, 14, 5); // head
  ctx.fillStyle='#b0b0b0'; ctx.fillRect(CX-7, GY-wH-40, 14, 2); // top highlight
  ctx.fillStyle='#606060'; ctx.fillRect(CX-7, GY-wH-36, 14, 1); // bottom shadow
  ctx.fillStyle='#c89050'; ctx.fillRect(CX-1, GY-wH-35, 3, 8);  // handle
  ctx.fillStyle='#a87030'; ctx.fillRect(CX+1, GY-wH-35, 1, 8);  // handle shadow
}

function genBuildings() {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  const drawers = [b0_barn,b1_mill,b2_wall,b3_tower,b4_barracks,b5_tavern,
                   b6_market,b7_throne,b8_library,b9_stable,b10_smithy,b11_sawmill,
                   b12_trap,b13_embassy,b14_farmplot,b15_construction];
  for (let idx=0; idx<16; idx++) {
    const col=idx%4, row=Math.floor(idx/4);
    ctx.save(); ctx.translate(col*128, row*128);
    drawers[idx](ctx);
    ctx.restore();
  }
  fs.writeFileSync(path.join(TILES_OUT,'buildings.png'), canvas.toBuffer('image/png'));
  console.log('✓ buildings.png');
}

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN (32×32 per tile, 16/row, 512×512 sheet)
// ─────────────────────────────────────────────────────────────────────────────

function grassBase(ctx, base, v1, v2) {
  ctx.fillStyle = base; ctx.fillRect(0,0,32,32);
  for (let i=0; i<24; i++) {
    ctx.fillStyle = i%3===0 ? v1 : v2;
    ctx.fillRect((i*7+3)%30, (i*11+5)%30, 2, 2);
  }
}

const T = [
  // 0 GRASS1 – bright lush green
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    // Micro details
    ctx.fillStyle='#78b050'; for (const [x,y] of [[5,8],[14,22],[24,12],[8,26]]) ctx.fillRect(x,y,1,2);
  },
  // 1 GRASS2 – darker variation
  ctx => {
    grassBase(ctx,'#4e8030','#3a6020','#5a9038');
    ctx.fillStyle='#3a7025'; for (const [x,y] of [[10,5],[20,18],[3,25],[28,10]]) ctx.fillRect(x,y,2,3);
  },
  // 2 DIRT – warm brown
  ctx => {
    ctx.fillStyle='#8b6343'; ctx.fillRect(0,0,32,32);
    for (let i=0; i<18; i++) {
      ctx.fillStyle = (i%2)===0 ? '#7a5535' : '#9a7050';
      ctx.fillRect((i*9+5)%30,(i*7+3)%30,3,2);
    }
    ctx.fillStyle='#6a4828'; for (const [x,y] of [[8,15],[20,8],[15,25],[5,3]]) ctx.fillRect(x,y,2,2);
  },
  // 3 DIRT_LIGHT
  ctx => {
    ctx.fillStyle='#b08060'; ctx.fillRect(0,0,32,32);
    for (let i=0; i<18; i++) { ctx.fillStyle='#c09070'; ctx.fillRect((i*7+3)%30,(i*11+7)%30,2,2); }
  },
  // 4 WATER – deep blue with shimmer
  ctx => {
    ctx.fillStyle='#1460a0'; ctx.fillRect(0,0,32,32);
    ctx.fillStyle='#1870b8';
    for (let y=0; y<32; y+=8) ctx.fillRect(0,y,32,4);
    ctx.strokeStyle='#3898d8'; ctx.lineWidth=1;
    for (let i=0; i<4; i++) {
      ctx.beginPath(); ctx.moveTo(0,4+i*8);
      ctx.bezierCurveTo(8,2+i*8, 16,7+i*8, 24,4+i*8); ctx.lineTo(32,4+i*8); ctx.stroke();
    }
    ctx.fillStyle='rgba(180,230,255,0.3)';
    for (const [x,y] of [[4,3],[14,12],[22,5],[8,19],[26,22]]) ctx.fillRect(x,y,4,1);
  },
  // 5 SAND
  ctx => {
    ctx.fillStyle='#d4b483'; ctx.fillRect(0,0,32,32);
    for (let i=0; i<30; i++) { ctx.fillStyle='#c0a068'; ctx.fillRect((i*13+7)%31,(i*7+5)%31,1,1); }
    ctx.fillStyle='#e8c898'; for (const [x,y] of [[6,10],[16,4],[24,18],[10,26],[28,8]]) ctx.fillRect(x,y,2,2);
  },
  // 6 STONE – pavement
  ctx => {
    ctx.fillStyle='#9ca3af'; ctx.fillRect(0,0,32,32);
    ctx.strokeStyle='#5a6370'; ctx.lineWidth=0.7;
    for (let x=0; x<32; x+=8) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,32); ctx.stroke(); }
    for (let y=0; y<32; y+=8) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(32,y); ctx.stroke(); }
    // Weathering
    ctx.fillStyle='rgba(0,0,0,0.08)'; for (const [x,y] of [[2,2],[10,10],[18,4],[26,20],[6,24]]) ctx.fillRect(x,y,3,2);
  },
  // 7 FLOWER_RED
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    for (let i=0; i<6; i++) {
      const px=(i*7+4)%24+4, py=(i*5+6)%20+6;
      ctx.strokeStyle='#16a34a'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px,py+6); ctx.lineTo(px,py); ctx.stroke();
      ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.arc(px,py,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fca5a5'; ctx.fillRect(px-1,py-1,2,2);
    }
  },
  // 8 FLOWER_BLUE
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    for (let i=0; i<6; i++) {
      const px=(i*11+3)%24+4, py=(i*7+4)%20+6;
      ctx.strokeStyle='#16a34a'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px,py+6); ctx.lineTo(px,py); ctx.stroke();
      ctx.fillStyle='#3b82f6'; ctx.beginPath(); ctx.arc(px,py,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#bfdbfe'; ctx.fillRect(px-1,py-1,2,2);
    }
  },
  // 9 FENCE_H
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    ctx.fillStyle='#92400e';
    ctx.fillRect(0,13,32,3); ctx.fillRect(0,20,32,3);
    for (const x of [1,11,22]) { ctx.fillRect(x,10,3,16); ctx.fillStyle='#7a3408'; ctx.fillRect(x,10,1,16); ctx.fillStyle='#92400e'; }
  },
  // 10 FENCE_V
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    ctx.fillStyle='#92400e';
    ctx.fillRect(13,0,3,32); ctx.fillRect(20,0,3,32);
    for (const y of [1,11,22]) { ctx.fillRect(10,y,13,3); ctx.fillStyle='#7a3408'; ctx.fillRect(10,y,13,1); ctx.fillStyle='#92400e'; }
  },
  // 11 TREE
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    // Shadow
    ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(18,26,7,3,0,0,Math.PI*2); ctx.fill();
    // Trunk
    ctx.fillStyle='#7a4010'; ctx.fillRect(14,19,4,13);
    ctx.fillStyle='#5a2c08'; ctx.fillRect(14,19,1,13);
    // Foliage layers
    ctx.fillStyle='#1a7a30'; ctx.beginPath(); ctx.arc(16,16,11,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#22a040'; ctx.beginPath(); ctx.arc(14,12,8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#2db050'; ctx.beginPath(); ctx.arc(18,10,6,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3aca60'; ctx.beginPath(); ctx.arc(16,8,4,0,Math.PI*2); ctx.fill();
    // Light highlight
    ctx.fillStyle='rgba(100,255,100,0.2)'; ctx.beginPath(); ctx.arc(15,8,3,0,Math.PI*2); ctx.fill();
  },
  // 12 ROCK
  ctx => {
    grassBase(ctx,'#9ca3af','#8090a0','#aab5c0');
    ctx.fillStyle='rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.ellipse(18,24,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#78716c'; ctx.beginPath(); ctx.ellipse(16,18,11,8,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#8a8278'; ctx.beginPath(); ctx.ellipse(14,16,7,5,-0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#a09890'; ctx.beginPath(); ctx.ellipse(12,14,4,3,-0.3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(11,13,2,1.5,0,0,Math.PI*2); ctx.fill();
  },
  // 13 BRIDGE
  ctx => {
    ctx.fillStyle='#1460a0'; ctx.fillRect(0,0,32,32);
    ctx.fillStyle='#1870b8'; for (let y=0; y<32; y+=8) ctx.fillRect(0,y,32,4);
    ctx.fillStyle='#a06010';
    for (let y=2; y<32; y+=7) { ctx.fillRect(0,y,32,5); ctx.fillStyle='#7a4808'; ctx.fillRect(0,y,32,1); ctx.fillStyle='#a06010'; }
    ctx.fillStyle='#7a4808'; ctx.fillRect(0,0,2,32); ctx.fillRect(30,0,2,32);
  },
  // 14 GRASS_DIRT blend
  ctx => {
    ctx.fillStyle='#5a8a3a'; ctx.fillRect(0,0,32,16);
    ctx.fillStyle='#8b6343'; ctx.fillRect(0,16,32,16);
    for (let x=0; x<32; x++) {
      const h=14+Math.round(Math.sin(x*0.8)*2.5);
      ctx.fillStyle=x%2===0?'#6a7840':'#7a6040'; ctx.fillRect(x,h,1,6);
    }
    for (let i=0; i<10; i++) { ctx.fillStyle='#4a6828'; ctx.fillRect((i*6+3)%30,4+(i%4)*3,2,4); }
  },
  // 15 FENCE_CORNER
  ctx => {
    grassBase(ctx,'#5a8a3a','#4a7028','#6ea040');
    ctx.fillStyle='#92400e';
    ctx.fillRect(14,0,4,32); ctx.fillRect(0,14,32,4); ctx.fillRect(12,12,8,8);
    ctx.fillStyle='#7a3408'; ctx.fillRect(14,0,1,32); ctx.fillRect(0,14,32,1);
  },
  // 16 GRASS_DARK
  ctx => {
    ctx.fillStyle='#2d6a1e'; ctx.fillRect(0,0,32,32);
    for (let i=0; i<20; i++) {
      ctx.fillStyle = i%2===0 ? '#1e5010' : '#3a7a26';
      ctx.fillRect((i*11+5)%30,(i*7+9)%30,2,2);
    }
    ctx.fillStyle='#488830'; for (const [x,y] of [[4,6],[15,14],[26,4],[8,24],[22,20]]) ctx.fillRect(x,y,1,3);
  },
  // 17 COBBLESTONE
  ctx => {
    ctx.fillStyle='#94a3b8'; ctx.fillRect(0,0,32,32);
    ctx.strokeStyle='#5a6880'; ctx.lineWidth=0.8;
    for (let row=0; row<6; row++) {
      const off=row%2===0?0:3;
      for (let col=0; col<8; col++) ctx.strokeRect(off+col*6-1, row*6-1, 5, 5);
    }
    ctx.fillStyle='rgba(0,0,0,0.07)';
    for (const [x,y] of [[1,1],[7,7],[4,13],[10,3],[16,9],[22,15],[28,1],[13,19],[25,22]]) ctx.fillRect(x,y,2,2);
  },
  // 18 TALL_GRASS
  ctx => {
    grassBase(ctx,'#4e8030','#3a6020','#5a9038');
    ctx.strokeStyle='#2a8020'; ctx.lineWidth=1.5;
    for (let i=0; i<12; i++) {
      const px=(i*7+3)%28+2, h=10+(i%4)*5;
      ctx.beginPath(); ctx.moveTo(px,31);
      ctx.quadraticCurveTo(px+(i%3-1)*5, 31-h/2, px+(i%2)*4-2, 31-h); ctx.stroke();
    }
  },
];

function genTerrain() {
  const canvas = createCanvas(512,512);
  const ctx = canvas.getContext('2d');
  for (let idx=0; idx<T.length; idx++) {
    const col=idx%16, row=Math.floor(idx/16);
    ctx.save(); ctx.translate(col*32, row*32);
    T[idx](ctx); ctx.restore();
  }
  fs.writeFileSync(path.join(TILES_OUT,'terrain.png'), canvas.toBuffer('image/png'));
  console.log('✓ terrain.png');
}

// ─────────────────────────────────────────────────────────────────────────────
// FARM TILES (64×64 per stage, 4 stages × 2 states, 256×256)
// ─────────────────────────────────────────────────────────────────────────────

function genFarmTiles() {
  const canvas = createCanvas(256,256);
  const ctx = canvas.getContext('2d');
  for (let watered=0; watered<=1; watered++) {
    for (let stage=0; stage<4; stage++) {
      ctx.save(); ctx.translate(stage*64, watered*64);
      // Soil base
      ctx.fillStyle = watered ? '#4a2e10' : '#5c3a18';
      ctx.fillRect(0,0,64,64);
      // Furrow rows
      ctx.strokeStyle = watered ? '#2e1a06' : '#3a2008'; ctx.lineWidth=2;
      for (let i=0; i<5; i++) { ctx.beginPath(); ctx.moveTo(6,12+i*10); ctx.lineTo(58,12+i*10); ctx.stroke(); }
      // Soil texture
      ctx.fillStyle = watered ? '#5a3a20' : '#6e4826';
      for (let i=0; i<12; i++) ctx.fillRect((i*11+8)%56+4,(i*7+6)%54+4,3,2);
      // Water tint
      if (watered) { ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle='#3b82f6'; ctx.fillRect(0,0,64,64); ctx.restore(); }
      // Sprouts (stage 1+)
      if (stage>=1) {
        const sproutColor = watered ? '#4ade80' : '#22c55e';
        for (let i=0; i<5; i++) {
          const sx=8+i*12;
          ctx.fillStyle='#16a34a'; ctx.fillRect(sx,30,4,14);
          ctx.fillStyle=sproutColor; ctx.fillRect(sx-3,22,10,10);
          ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(sx-2,23,4,3);
        }
      }
      // Growing (stage 2+)
      if (stage>=2) {
        for (let i=0; i<5; i++) {
          const sx=8+i*12;
          ctx.fillStyle='#15803d'; ctx.fillRect(sx,14,4,30);
          ctx.fillStyle = watered ? '#4ade80' : '#22c55e';
          ctx.fillRect(sx-5,8,14,12);
          ctx.fillStyle='#16a34a'; ctx.fillRect(sx-3,6,10,8);
          ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(sx-2,8,5,4);
        }
      }
      // Ready (stage 3)
      if (stage>=3) {
        for (let i=0; i<5; i++) {
          const sx=8+i*12;
          ctx.fillStyle='#14532d'; ctx.fillRect(sx,12,4,32);
          // Golden grain head
          ctx.fillStyle='#eab308'; ctx.fillRect(sx-5,4,14,10);
          ctx.fillStyle='#f59e0b'; ctx.fillRect(sx-4,3,12,8);
          ctx.fillStyle='#fcd34d'; ctx.fillRect(sx-3,3,4,6);
          // Individual grain tips
          ctx.fillStyle='#ca8a04';
          for (let g=0; g<4; g++) ctx.fillRect(sx-4+g*3,2,2,3);
          // Sparkle
          ctx.fillStyle='rgba(255,255,200,0.6)'; ctx.fillRect(sx-2,4,3,2);
        }
      }
      ctx.restore();
    }
  }
  fs.writeFileSync(path.join(TILES_OUT,'farm_tiles.png'), canvas.toBuffer('image/png'));
  console.log('✓ farm_tiles.png');
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC SPRITES (32×48 per frame, 2 frames → 64×48 per file)
// ─────────────────────────────────────────────────────────────────────────────

// Base character drawing — Dragon Quest-inspired chibi proportions
function drawNPC(ctx, frame, opts) {
  const { skin, hair, shirt, pants, boots, hatFn, extraFn } = opts;
  const bob = frame === 1 ? 1 : 0;
  const legAnim = frame === 1 ? 2 : 0;

  // ── HEAD at (11, 3+bob)
  const hx=11, hy=3+bob;

  // Hair behind (back of head)
  ctx.fillStyle=hair; ctx.fillRect(hx,hy,10,3); ctx.fillRect(hx-1,hy+3,2,7); ctx.fillRect(hx+9,hy+3,2,7); ctx.fillRect(hx,hy+10,10,3);

  // Hat/accessory (drawn on top of back-hair, before face)
  if (hatFn) hatFn(ctx, hx, hy, frame);

  // Head/face skin
  ctx.fillStyle=skin;
  ctx.fillRect(hx+1,hy,8,12);
  ctx.fillRect(hx,hy+1,1,10); ctx.fillRect(hx+9,hy+1,1,10);

  // Eyes
  ctx.fillStyle='#1a0800'; ctx.fillRect(hx+2,hy+4,2,2); ctx.fillRect(hx+6,hy+4,2,2);
  ctx.fillStyle='rgba(255,255,255,0.75)'; ctx.fillRect(hx+2,hy+4,1,1); ctx.fillRect(hx+6,hy+4,1,1);
  // Eyebrows
  ctx.fillStyle=hair; ctx.fillRect(hx+2,hy+2,3,1); ctx.fillRect(hx+6,hy+2,3,1);
  // Nose
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(hx+4,hy+7,2,1);
  // Mouth
  ctx.fillStyle='#b06050'; ctx.fillRect(hx+3,hy+9,4,1);
  // Cheek blush
  ctx.fillStyle='rgba(240,130,110,0.25)'; ctx.fillRect(hx+1,hy+7,2,3); ctx.fillRect(hx+7,hy+7,2,3);
  // Front hair strands
  ctx.fillStyle=hair; ctx.fillRect(hx+1,hy,3,2); ctx.fillRect(hx+7,hy,3,2);

  // ── NECK
  const ny=hy+12;
  ctx.fillStyle=skin; ctx.fillRect(hx+3,ny,4,3);

  // ── BODY at (9, ny+3)
  const by=ny+3;
  ctx.fillStyle=shirt;
  ctx.fillRect(hx-1,by,12,10); // torso
  ctx.fillRect(hx-4,by,4,9);   // left arm
  ctx.fillRect(hx+9,by,4,9);   // right arm
  // Shirt fold / shadow
  ctx.fillStyle='rgba(0,0,0,0.12)'; ctx.fillRect(hx-1,by+8,12,2); ctx.fillRect(hx+4,by,1,10);

  // Hands (skin)
  ctx.fillStyle=skin; ctx.fillRect(hx-4,by+9,4,3); ctx.fillRect(hx+9,by+9,4,3);

  // Belt
  ctx.fillStyle='#4a2808'; ctx.fillRect(hx-1,by+10,12,2);

  // Extra (for items / accessories on body)
  if (extraFn) extraFn(ctx, hx, hy, by, frame);

  // ── LEGS at (by+12)
  const ly=by+12;
  ctx.fillStyle=pants;
  ctx.fillRect(hx,ly,5,9+legAnim);
  ctx.fillRect(hx+5,ly,5,9-legAnim);
  // Leg shade
  ctx.fillStyle='rgba(0,0,0,0.1)'; ctx.fillRect(hx,ly,1,9+legAnim); ctx.fillRect(hx+5,ly,1,9-legAnim);

  // ── BOOTS
  const boot_y=ly+9;
  ctx.fillStyle=boots;
  ctx.fillRect(hx-1,boot_y+legAnim,6,4);
  ctx.fillRect(hx+4,boot_y-legAnim,6,4);
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(hx-1,boot_y+legAnim,6,1); ctx.fillRect(hx+4,boot_y-legAnim,6,1);
}

// Individual NPC configs

const NPC_CONFIGS = {
  farmer: {
    skin:'#e8c080', hair:'#7b3f00', shirt:'#4a8040', pants:'#7a4020', boots:'#5a2a10',
    hatFn(ctx,hx,hy) {
      // Straw hat: wide brim + round crown
      ctx.fillStyle='#c4920a'; ctx.fillRect(hx-4,hy-1,18,2); // brim
      ctx.fillStyle='#d4a517'; ctx.fillRect(hx+1,hy-5,8,5); // crown
      ctx.fillStyle='#b07808'; ctx.fillRect(hx+1,hy-6,8,2);  // hat band
      ctx.fillStyle='#e8b820'; ctx.fillRect(hx+2,hy-5,3,4); // highlight
    },
    extraFn(ctx,hx,_hy,by) {
      // Hoe tool
      ctx.strokeStyle='#7a4010'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(hx+13,by); ctx.lineTo(hx+18,by+12); ctx.stroke();
      ctx.fillStyle='#909090'; ctx.fillRect(hx+16,by-2,6,4);
    },
  },
  baker: {
    skin:'#f0d4a8', hair:'#a05020', shirt:'#e8e0d8', pants:'#4060a0', boots:'#202020',
    hatFn(ctx,hx,hy) {
      // Tall chef hat
      ctx.fillStyle='#f0f0f0'; ctx.fillRect(hx+1,hy-12,8,12); // tall puff
      ctx.fillStyle='#e0e0e0'; ctx.fillRect(hx+2,hy-11,3,10); // shadow
      ctx.fillStyle='#ddd';    ctx.fillRect(hx-1,hy-2,12,2); // brim band
    },
    extraFn(ctx,hx,_hy,by) {
      // Apron
      ctx.fillStyle='rgba(240,235,230,0.85)'; ctx.fillRect(hx,by+2,9,8);
      ctx.strokeStyle='rgba(200,195,190,0.8)'; ctx.lineWidth=0.5; ctx.strokeRect(hx,by+2,9,8);
      // Rolling pin
      ctx.fillStyle='#c8a060'; ctx.fillRect(hx-5,by+5,5,3);
      ctx.fillStyle='#e0b878'; ctx.fillRect(hx-4,by+5,3,3);
    },
  },
  princess: {
    skin:'#f8d0b0', hair:'#6a3010', shirt:'#9030c0', pants:'#7020a0', boots:'#f0d050',
    hatFn(ctx,hx,hy) {
      // Crown
      ctx.fillStyle='#ffd700';
      ctx.fillRect(hx+1,hy-5,8,5); // crown base
      // 5 points
      for (let i=0; i<5; i++) { ctx.fillRect(hx+1+i*2,hy-8,2,4); }
      ctx.fillStyle='#ff4080'; ctx.fillRect(hx+4,hy-7,2,2); // jewel
      ctx.fillStyle='rgba(255,255,200,0.6)'; ctx.fillRect(hx+2,hy-4,4,2); // gold shine
    },
    extraFn(ctx,hx,_hy,by) {
      // Dress skirt flare
      ctx.fillStyle='#7020a0'; ctx.fillRect(hx-2,by+8,14,4);
      ctx.fillStyle='#9030c0'; ctx.fillRect(hx-1,by+7,12,3);
      // White collar
      ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fillRect(hx,by,9,3);
      // Gold trim on sleeves
      ctx.fillStyle='#ffd700'; ctx.fillRect(hx-4,by+7,4,2); ctx.fillRect(hx+9,by+7,4,2);
    },
  },
  wizard: {
    skin:'#d8b880', hair:'#eeeeee', shirt:'#1a1a6e', pants:'#1a1a6e', boots:'#4a1080',
    hatFn(ctx,hx,hy) {
      // Tall pointed hat
      ctx.fillStyle='#6020a0';
      ctx.beginPath(); ctx.moveTo(hx+5,hy-20); ctx.lineTo(hx-2,hy-1); ctx.lineTo(hx+12,hy-1); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#4a1080';
      ctx.beginPath(); ctx.moveTo(hx+5,hy-20); ctx.lineTo(hx-2,hy-1); ctx.lineTo(hx+5,hy-6); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#f0c030'; ctx.fillRect(hx+3,hy-14,2,2); // star
      // Hat brim
      ctx.fillStyle='#5a1898'; ctx.fillRect(hx-3,hy-3,16,3);
      ctx.fillStyle='#7830b0'; ctx.fillRect(hx-2,hy-3,14,2);
    },
    extraFn(ctx,hx,_hy,by) {
      // White beard
      ctx.fillStyle='#e0e0e0'; ctx.fillRect(hx+1,by-3,8,6); ctx.fillRect(hx+2,by+3,6,4);
      // Staff
      ctx.strokeStyle='#7a5010'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(hx-5,by); ctx.lineTo(hx-5,by+20); ctx.stroke();
      ctx.fillStyle='#60c0f0'; ctx.beginPath(); ctx.arc(hx-5,by-2,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(150,230,255,0.6)'; ctx.beginPath(); ctx.arc(hx-6,by-3,2,0,Math.PI*2); ctx.fill();
    },
  },
  knight: {
    skin:'#d0c0a8', hair:'#404040', shirt:'#808090', pants:'#606070', boots:'#484858',
    hatFn(ctx,hx,hy) {
      // Full helmet
      ctx.fillStyle='#909098';
      ctx.fillRect(hx,hy,10,13); // covers whole head
      ctx.fillRect(hx-1,hy+2,12,9);
      // Visor slit
      ctx.fillStyle='#202028';
      ctx.fillRect(hx+2,hy+5,6,2);
      // Helmet ridge
      ctx.fillStyle='#a0a0b0';
      ctx.fillRect(hx+4,hy-2,2,15);
      ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(hx+4,hy,1,6);
      // Chin guard
      ctx.fillStyle='#707080'; ctx.fillRect(hx+1,hy+11,8,3);
    },
    extraFn(ctx,hx,_hy,by) {
      // Red tabard
      ctx.fillStyle='#8b1010'; ctx.fillRect(hx+1,by,7,10);
      ctx.fillStyle='#6a0a0a'; ctx.fillRect(hx+4,by,1,10);
      // Chain mail sides
      ctx.fillStyle='#888898'; ctx.fillRect(hx-1,by,2,10); ctx.fillRect(hx+8,by,2,10);
      // Shield hint
      ctx.fillStyle='#808098'; ctx.fillRect(hx+11,by,5,8);
      ctx.strokeStyle='#ffd700'; ctx.lineWidth=0.7; ctx.strokeRect(hx+11,by,5,8);
    },
  },
  merchant: {
    skin:'#e0b870', hair:'#302010', shirt:'#c88a10', pants:'#6a3808', boots:'#4a2808',
    hatFn(ctx,hx,hy) {
      // Wide brown hat
      ctx.fillStyle='#5a2c08'; ctx.fillRect(hx-4,hy-2,18,3); // brim
      ctx.fillStyle='#7a3c10'; ctx.fillRect(hx+1,hy-7,8,5); // crown
      ctx.fillStyle='#906020'; ctx.fillRect(hx+1,hy-2,8,2); // band
      ctx.fillStyle='rgba(255,200,80,0.5)'; ctx.fillRect(hx+3,hy-6,3,3);
    },
    extraFn(ctx,hx,_hy,by) {
      // Gold trim on shirt
      ctx.fillStyle='#ffd700';
      ctx.fillRect(hx-1,by,2,2); ctx.fillRect(hx+8,by,2,2);
      ctx.fillRect(hx,by+9,9,2);
      // Coin pouch
      ctx.fillStyle='#7a5010'; ctx.beginPath(); ctx.arc(hx+14,by+4,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#c0900a'; ctx.beginPath(); ctx.arc(hx+14,by+4,3,0,Math.PI*2); ctx.fill();
      // Pixel art coin mark (cross pattern)
      ctx.fillStyle='#ffd700';
      ctx.fillRect(hx+13, by+2, 3, 1); ctx.fillRect(hx+13, by+6, 3, 1);
      ctx.fillRect(hx+12, by+3, 5, 3); ctx.fillRect(hx+14, by+1, 1, 6);
    },
  },
  ranger: {
    skin:'#d4a870', hair:'#2a1a08', shirt:'#1a4a20', pants:'#1a3a18', boots:'#5a3010',
    hatFn(ctx,hx,hy) {
      // Green hood (covers head with pointed front)
      ctx.fillStyle='#1a4a20';
      ctx.fillRect(hx-1,hy-2,12,14); // hood body
      ctx.beginPath(); ctx.moveTo(hx+5,hy-10); ctx.lineTo(hx-1,hy-2); ctx.lineTo(hx+11,hy-2); ctx.closePath(); ctx.fill(); // point
      ctx.fillStyle='#153a18';
      ctx.beginPath(); ctx.moveTo(hx+5,hy-10); ctx.lineTo(hx-1,hy-2); ctx.lineTo(hx+5,hy); ctx.closePath(); ctx.fill(); // shadow
      // Face opening
      ctx.fillStyle=opts_placeholder; // will be overridden by head draw
    },
    extraFn(ctx,hx,_hy,by) {
      // Quiver on back
      ctx.fillStyle='#7a4010'; ctx.fillRect(hx+11,by-4,5,14);
      ctx.fillStyle='#5a2808'; ctx.fillRect(hx+11,by-4,5,2);
      // Arrow shafts
      for (let i=0; i<3; i++) {
        ctx.strokeStyle='#c8a060'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(hx+12+i,by-4); ctx.lineTo(hx+13+i,by-12); ctx.stroke();
      }
      // Cloak darker outer edge
      ctx.fillStyle='rgba(10,30,12,0.4)'; ctx.fillRect(hx-1,by,2,10); ctx.fillRect(hx+8,by,2,10);
    },
  },
};

// Fix ranger: doesn't need opts_placeholder
NPC_CONFIGS.ranger.hatFn = function(ctx,hx,hy,frame) {
  ctx.fillStyle='#1a4a20';
  ctx.fillRect(hx-1,hy-2,12,14);
  ctx.beginPath(); ctx.moveTo(hx+5,hy-10); ctx.lineTo(hx-1,hy-2); ctx.lineTo(hx+11,hy-2); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#153a18';
  ctx.beginPath(); ctx.moveTo(hx+5,hy-10); ctx.lineTo(hx-1,hy-2); ctx.lineTo(hx+5,hy); ctx.closePath(); ctx.fill();
  // Leaf pattern
  ctx.fillStyle='rgba(30,80,30,0.5)'; ctx.fillRect(hx+4,hy-8,2,3); ctx.fillRect(hx+7,hy,2,3);
};

function genNPCSprites() {
  const npcNames = ['farmer','baker','princess','wizard','knight','merchant','ranger'];
  for (const name of npcNames) {
    const canvas = createCanvas(64,48);
    const ctx = canvas.getContext('2d');
    const conf = NPC_CONFIGS[name];
    // Frame 0
    ctx.save(); drawNPC(ctx, 0, conf); ctx.restore();
    // Frame 1
    ctx.save(); ctx.translate(32,0); drawNPC(ctx, 1, conf); ctx.restore();
    fs.writeFileSync(path.join(CHARS_OUT,`npc_${name}.png`), canvas.toBuffer('image/png'));
    console.log(`✓ npc_${name}.png`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VILLAGER SPRITE (32×48 per frame, 4 frames → 128×48)
// ─────────────────────────────────────────────────────────────────────────────

const VILLAGER_ROLE_COLORS = {
  default:    { shirt:'#6b7280', pants:'#374151', boots:'#1f2937', skin:'#d4a070', hair:'#7a4010' },
  farmer:     { shirt:'#4a8040', pants:'#7a4020', boots:'#5a2a10', skin:'#d4a870', hair:'#6a3008' },
  woodcutter: { shirt:'#8b4513', pants:'#4a2808', boots:'#3a1808', skin:'#c8904c', hair:'#3a2010' },
  miner:      { shirt:'#606060', pants:'#404040', boots:'#282828', skin:'#c89060', hair:'#303030' },
  soldier:    { shirt:'#808090', pants:'#505060', boots:'#303040', skin:'#d0b880', hair:'#404040' },
  merchant:   { shirt:'#c88a10', pants:'#6a3808', boots:'#4a2808', skin:'#e0b870', hair:'#302010' },
  builder:    { shirt:'#c89030', pants:'#603808', boots:'#483008', skin:'#d0a060', hair:'#5a3010' },
};

function drawVillager(ctx, frame, colorKey) {
  const c = VILLAGER_ROLE_COLORS[colorKey] || VILLAGER_ROLE_COLORS.default;
  drawNPC(ctx, frame, {
    skin: c.skin, hair: c.hair, shirt: c.shirt, pants: c.pants, boots: c.boots,
    hatFn: null, extraFn: null,
  });
}

function genVillagerSprite() {
  // 4 frames: idle0, idle1, walk0, walk1
  const canvas = createCanvas(128,48);
  const ctx = canvas.getContext('2d');
  // Use default appearance
  for (let f=0; f<4; f++) {
    ctx.save(); ctx.translate(f*32,0);
    drawVillager(ctx, f%2, 'default');
    ctx.restore();
  }
  fs.writeFileSync(path.join(CHARS_OUT,'villager.png'), canvas.toBuffer('image/png'));
  console.log('✓ villager.png');
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMAL SPRITES (32×32 per frame, 4 frames → 128×32)
// Frames: 0=idle0, 1=idle1, 2=walk0, 3=walk1
// ─────────────────────────────────────────────────────────────────────────────

function drawChicken(ctx, frame) {
  const bob = (frame===1||frame===3) ? 1 : 0;
  const legL = (frame>=2) ? (frame===2 ? 2 : -2) : 0;

  // Body
  ctx.fillStyle='#f0f0e0';
  ctx.beginPath(); ctx.ellipse(16,19+bob,8,6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#e8e8d8';
  ctx.beginPath(); ctx.ellipse(14,18+bob,5,4,0.2,0,Math.PI*2); ctx.fill();

  // Tail feathers
  ctx.fillStyle='#e0dfd0';
  ctx.beginPath(); ctx.moveTo(8,18+bob); ctx.lineTo(4,14+bob); ctx.lineTo(8,16+bob); ctx.lineTo(6,12+bob); ctx.lineTo(10,15+bob); ctx.fill();

  // Wing
  ctx.fillStyle='#d8d8c8';
  ctx.beginPath(); ctx.ellipse(15,19+bob,5,3,-0.2,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.15)'; ctx.lineWidth=0.7;
  for (let i=0; i<3; i++) { ctx.beginPath(); ctx.moveTo(12+i*2,17+bob); ctx.lineTo(13+i*2,22+bob); ctx.stroke(); }

  // Head
  ctx.fillStyle='#f0f0e0';
  ctx.beginPath(); ctx.arc(21,13+bob,5,0,Math.PI*2); ctx.fill();

  // Comb
  ctx.fillStyle='#e02020';
  ctx.fillRect(20,8+bob,2,5); ctx.fillRect(22,9+bob,2,4); ctx.fillRect(18,9+bob,2,4);

  // Wattle
  ctx.fillStyle='#d01010';
  ctx.beginPath(); ctx.arc(20,17+bob,2,0,Math.PI*2); ctx.fill();

  // Beak
  ctx.fillStyle='#e0a020';
  if (frame===1) { // pecking
    ctx.beginPath(); ctx.moveTo(24,15+bob); ctx.lineTo(28,18+bob); ctx.lineTo(24,17+bob); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(25,13+bob); ctx.lineTo(29,14+bob); ctx.lineTo(25,15+bob); ctx.fill();
  }

  // Eye
  ctx.fillStyle='#1a0800'; ctx.beginPath(); ctx.arc(22,12+bob,1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillRect(22,11+bob,1,1);

  // Legs
  ctx.strokeStyle='#e0a020'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(15,24+bob); ctx.lineTo(13,30+legL); ctx.lineTo(11,31+legL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(17,24+bob); ctx.lineTo(19,30-legL); ctx.lineTo(21,31-legL); ctx.stroke();
}

function drawCow(ctx, frame) {
  const bob = (frame===1||frame===3) ? 1 : 0;
  const legAnim = frame>=2 ? (frame===2 ? 2 : -2) : 0;

  // Body shadow
  ctx.fillStyle='rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.ellipse(16,29,12,3,0,0,Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle='#f0f0e8'; ctx.beginPath(); ctx.ellipse(16,18+bob,11,8,0,0,Math.PI*2); ctx.fill();
  // Spots
  ctx.fillStyle='#2a2a2a';
  ctx.beginPath(); ctx.ellipse(10,16+bob,4,3,0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(20,20+bob,3,2,-0.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f0f0e8'; ctx.beginPath(); ctx.ellipse(17,17+bob,2,1.5,0,0,Math.PI*2); ctx.fill();

  // Udder
  ctx.fillStyle='#f5c0b0'; ctx.beginPath(); ctx.ellipse(16,25+bob,5,3,0,0,Math.PI*2); ctx.fill();

  // Head
  ctx.fillStyle='#f0f0e8'; ctx.fillRect(22,10+bob,8,10);
  // Nose
  ctx.fillStyle='#f0c0b0'; ctx.fillRect(23,17+bob,6,4);
  ctx.fillStyle='#a06060'; ctx.beginPath(); ctx.arc(25,19+bob,1.5,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(28,19+bob,1.5,0,Math.PI*2); ctx.fill();

  // Eyes
  ctx.fillStyle='#1a0800'; ctx.beginPath(); ctx.arc(24,13+bob,1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillRect(24,12+bob,1,1);

  // Horns
  ctx.fillStyle='#e8d080';
  ctx.beginPath(); ctx.moveTo(24,10+bob); ctx.lineTo(22,5+bob); ctx.lineTo(26,10+bob); ctx.fill();
  ctx.beginPath(); ctx.moveTo(29,10+bob); ctx.lineTo(31,5+bob); ctx.lineTo(27,10+bob); ctx.fill();

  // Ears
  ctx.fillStyle='#f0c0a0'; ctx.beginPath(); ctx.ellipse(22,12+bob,2,3,-0.3,0,Math.PI*2); ctx.fill();

  // Legs
  ctx.fillStyle='#d8d8d0';
  ctx.fillRect(9,24+bob,4,7+legAnim); ctx.fillRect(14,24+bob,4,7-legAnim);
  ctx.fillRect(19,24+bob,4,7+legAnim); ctx.fillRect(24,24+bob,4,7-legAnim);
  // Hooves
  ctx.fillStyle='#555';
  ctx.fillRect(9,30+bob+legAnim,4,2); ctx.fillRect(14,30+bob-legAnim,4,2);
  ctx.fillRect(19,30+bob+legAnim,4,2); ctx.fillRect(24,30+bob-legAnim,4,2);

  // Tail
  ctx.strokeStyle='#c8c8c0'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(5,18+bob); ctx.quadraticCurveTo(2,22+bob,4,26+bob); ctx.stroke();
}

function drawSheep(ctx, frame) {
  const bob = (frame===1||frame===3) ? 1 : 0;
  const legAnim = frame>=2 ? (frame===2 ? 2 : -2) : 0;

  // Body shadow
  ctx.fillStyle='rgba(0,0,0,0.1)';
  ctx.beginPath(); ctx.ellipse(16,29,9,3,0,0,Math.PI*2); ctx.fill();

  // Fluffy body (multiple overlapping ovals for wool texture)
  ctx.fillStyle='#e8e8e8';
  ctx.beginPath(); ctx.ellipse(16,18+bob,10,8,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f0f0f0';
  ctx.beginPath(); ctx.ellipse(12,16+bob,5,4,0.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(20,16+bob,5,4,-0.2,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16,13+bob,5,4,0,0,Math.PI*2); ctx.fill();
  // Wool texture dots
  ctx.fillStyle='#d0d0d0';
  for (const [x,y] of [[10,19],[14,14],[20,20],[22,17],[12,22],[18,13]]) {
    ctx.beginPath(); ctx.arc(x,y+bob,2,0,Math.PI*2); ctx.fill();
  }

  // Head (black face)
  ctx.fillStyle='#2a2a2a'; ctx.beginPath(); ctx.arc(24,14+bob,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#3a3a3a'; ctx.beginPath(); ctx.arc(22,14+bob,3,0,Math.PI*2); ctx.fill();
  // Ears
  ctx.fillStyle='#2a2a2a'; ctx.beginPath(); ctx.ellipse(22,11+bob,2,3,-0.2,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#604040'; ctx.beginPath(); ctx.ellipse(22,11+bob,1,2,-0.2,0,Math.PI*2); ctx.fill();

  // Eyes
  ctx.fillStyle='#ffd080'; ctx.beginPath(); ctx.arc(23,13+bob,1.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a0800'; ctx.beginPath(); ctx.arc(23,13+bob,0.8,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.fillRect(23,12+bob,1,1);

  // Nose
  ctx.fillStyle='#c06060'; ctx.fillRect(23,16+bob,4,2);
  ctx.fillStyle='#904040'; ctx.beginPath(); ctx.arc(24,16+bob,1,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(26,16+bob,1,0,Math.PI*2); ctx.fill();

  // Legs (black)
  ctx.fillStyle='#2a2a2a';
  ctx.fillRect(10,24+bob,3,7+legAnim); ctx.fillRect(15,24+bob,3,7-legAnim);
  ctx.fillRect(20,24+bob,3,7+legAnim); ctx.fillRect(25,24+bob,3,7-legAnim);
}

function genAnimalSprites() {
  const animals = [
    { name:'chicken', drawFn: drawChicken },
    { name:'cow',     drawFn: drawCow     },
    { name:'sheep',   drawFn: drawSheep   },
  ];
  for (const { name, drawFn } of animals) {
    const canvas = createCanvas(128,32);
    const ctx = canvas.getContext('2d');
    for (let f=0; f<4; f++) {
      ctx.save(); ctx.translate(f*32,0);
      drawFn(ctx, f);
      ctx.restore();
    }
    fs.writeFileSync(path.join(ANIM_OUT,`${name}.png`), canvas.toBuffer('image/png'));
    console.log(`✓ ${name}.png`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

genBuildings();
genTerrain();
genFarmTiles();
genNPCSprites();
genVillagerSprite();
genAnimalSprites();
console.log('\n✅ All sprites generated.');
