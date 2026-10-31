const sharp=require('sharp');
(async()=>{const f=process.argv[2];const{data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});const{width:W,height:H}=info;
const bg=201;let out=[];for(let x0=0;x0<W;x0+=16){let n=0;for(let x=x0;x<Math.min(W,x0+16);x++)for(let y=0;y<H;y++){const i=(y*W+x)*4;if(Math.abs(data[i]-bg)+Math.abs(data[i+1]-bg)+Math.abs(data[i+2]-bg)>60)n++;}out.push(Math.round(n/16));}
console.log(out.join(' '));})();
