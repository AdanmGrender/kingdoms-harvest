// Cabeza = coronilla (sombrero) -> línea de hombros, sobre la máscara alfa abierta con R=26 (quita hoja/plumas/cuchillas finas).
// Hombros = 1ª fila (tras top+60) cuyo ancho >= 0.75 x mediana del ancho entre 30-55 % del alto. Uso: node measure_head.js <webp>...
const sharp=require('sharp');
(async()=>{const r=Number(process.env.R)||26;for(const f of process.argv.slice(2)){
const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height;
const m=new Uint8Array(W*H);for(let i=0;i<W*H;i++)m[i]=data[i*4+3]>128?1:0;
const box=(src,mn)=>{const t=new Uint8Array(W*H),o=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=mn?1:0;for(let k=Math.max(0,x-r);k<=Math.min(W-1,x+r);k++)v=mn?v&src[y*W+k]:v|src[y*W+k];t[y*W+x]=v;}
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=mn?1:0;for(let k=Math.max(0,y-r);k<=Math.min(H-1,y+r);k++)v=mn?v&t[k*W+x]:v|t[k*W+x];o[y*W+x]=v;}return o;};
const op=box(box(m,true),false);const w=[];for(let y=0;y<H;y++){let c=0;for(let x=0;x<W;x++)c+=op[y*W+x];w.push(c);}
const top=w.findIndex(c=>c>0);let bot=H-1;while(w[bot]===0)bot--;const h=bot-top+1;
const band=w.slice(top+Math.floor(.3*h),top+Math.floor(.55*h)).sort((a,b)=>a-b);const torso=band[band.length>>1];
let sh=-1;for(let y=top+60;y<=bot;y++)if(w[y]>=0.75*torso){sh=y-top;break;}
let nk=-1,mn=1e9;for(let y=top+30;y<top+sh;y++)if(w[y]<mn){mn=w[y];nk=y-top;}
console.log(JSON.stringify({f:f.split('/').pop(),top,h,headToShoulder:sh,headToNeckMin:nk,neckW:mn,torso}));}})();
