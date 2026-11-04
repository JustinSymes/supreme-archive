// Retrieval check using altered archive photos, without the exact-file shortcut.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {pipeline, RawImage, env} from '@huggingface/transformers';
const root=fileURLToPath(new URL('../../',import.meta.url));
env.cacheDir=fileURLToPath(new URL('.cache/',import.meta.url));
const index=JSON.parse(await fs.readFile(root+'photo-embeddings.json','utf8'));
const old=JSON.parse(await fs.readFile(root+'photo-index.json','utf8'));
const extractor=await pipeline('image-feature-extraction',index.model,{dtype:'q8',session_options:{intraOpNumThreads:2}});
const entries=index.entries.map(e=>{const v=new Int8Array(Buffer.from(e.v,'base64'));return {...e,v,norm:Math.hypot(...v)};});
const samples=index.entries.filter(e=>e.file===e.main).filter((_,i)=>i%Math.floor(index.entries.filter(e=>e.file===e.main).length/20)===0).slice(0,20);
let hits=0,oldHits=0;
for(const sample of samples) {
  const altered=await sharp(root+sample.file).flatten({background:'#eee5db'}).resize(320,320,{fit:'contain',background:'#eee5db'}).rotate(9,{background:'#eee5db'}).modulate({brightness:.85}).jpeg({quality:70}).toBuffer();
  const {data,info}=await sharp(altered).resize(224,224,{fit:'contain',background:'#fff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const tensor=await extractor(new RawImage(new Uint8Array(data),info.width,info.height,info.channels));
  const query=tensor.data.slice(0,384),norm=Math.hypot(...query);
  const scores=new Map();
  for(const e of entries){let dot=0;for(let i=0;i<384;i++) dot+=query[i]*e.v[i];const score=dot/norm/e.norm;scores.set(e.main,Math.max(scores.get(e.main)??-1,score));}
  const ranked=[...scores].sort((a,b)=>b[1]-a[1]);
  const rank=ranked.findIndex(([file])=>file===sample.main)+1;
  if(rank<=6) hits++;
  const pixels=await sharp(altered).resize(24,24,{fit:'fill'}).removeAlpha().raw().toBuffer();
  const previous=old.map(e=>({file:e.file,distance:[...pixels].reduce((sum,p,i)=>sum+Math.abs((p>>4)-parseInt(e.v[i],16)),0)})).sort((a,b)=>a.distance-b.distance);
  const previousRank=previous.findIndex(e=>e.file===sample.main)+1;
  if(previousRank>0&&previousRank<=6) oldHits++;
  console.log(JSON.stringify({file:sample.file,rank,previousRank,score:ranked[rank-1]?.[1]}));
}
console.log(JSON.stringify({samples:samples.length,top6:hits,previousPixelTop6:oldHits}));
if(hits<samples.length*.8) process.exitCode=1;
