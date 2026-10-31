// Perfil de ancho por fila (cada 8 px desde la cima) con la mascara alfa abierta (radio R, env): node rowprof_open.js <webp>...  -> fila:ancho[x0-x1]
const sharp=require('sharp');
(async()=>{const r=Number(process.env.R)||26;for(const f of process.argv.slice(2)){
const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});const W=info.width,H=info.height;
const m=new Uint8Array(W*H);for(let i=0;i<W*H;i++)m[i]=data[i*4+3]>128?1:0;
const box=(src,mn)=>{const t=new Uint8Array(W*H),o=new Uint8Array(W*H);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=mn?1:0;for(let k=Math.max(0,x-r);k<=Math.min(W-1,x+r);k++)v=mn?v&src[y*W+k]:v|src[y*W+k];t[y*W+x]=v;}
for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=mn?1:0;for(let k=Math.max(0,y-r);k<=Math.min(H-1,y+r);k++)v=mn?v&t[k*W+x]:v|t[k*W+x];o[y*W+x]=v;}return o;};
const op=box(box(m,true),false);const out=[];let top=-1;
for(let y=0;y<H;y++){let c=0,x0=-1,x1=0;for(let x=0;x<W;x++)if(op[y*W+x]){c++;if(x0<0)x0=x;x1=x;}if(top<0&&c>0)top=y;if(top>=0&&(y-top)%10===0&&y-top<=300)out.push((y-top)+':'+c+'['+x0+'-'+x1+']');}
console.log(f.split('/').pop(),'top',top);console.log(out.join(' '));}})();
