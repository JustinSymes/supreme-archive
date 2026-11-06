import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import sharp from 'sharp';
import { pipeline, RawImage, env } from '@huggingface/transformers';
import photoFabricColor from '../../photo-color.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
env.cacheDir = fileURLToPath(new URL('.cache/', import.meta.url));
const model = 'Xenova/dinov2-small';
const revision = 'c2bb04a51fab207c420665f1946016107bffc701';
const output = path.join(root, 'photo-embeddings.json');
const csv = process.argv[2] ? await fs.readFile(process.argv[2], 'utf8') : await (await fetch('https://docs.google.com/spreadsheets/d/1AP4KwfrGxdReQIcCQHcTtoMfMyYs_6Rd5xbCwAHh15w/export?format=csv&gid=0')).text();
const rows = parse(csv, {columns:true, relax_column_count:true, skip_empty_lines:true});
const files = new Map();
const families = {};
const available = new Set(await fs.readdir(root));
const aliases = {};
for (const row of rows) {
  const main = row.image_main?.split('|')[0].trim();
  if (!main || !row.name) continue;
  const color = row.color?.trim();
  const name = row.name.trim();
  if (color && name.toLowerCase().startsWith(color.toLowerCase()+' ')) {
    families[main] = name.slice(color.length).trim().toLowerCase();
  }
  for (const file of [row.image_main, row.image_gallery].filter(Boolean).flatMap(s => s.split('|')).map(s=>s.trim())) {
    if (file && !/^(https?:|\/)|\.\./.test(file)) {
      const season = row.name.match(/\b(SS|FW)\d{2}$/i)?.[0].toLowerCase();
      if (!available.has(file) && season) {
        const candidate = file.replace(/(_(?:front|back|side|detail))?(\.[^.]+)$/, (_,view='',ext)=>`_${season}${view}${ext}`);
        if (available.has(candidate)) aliases[file] = candidate;
      }
      files.set(aliases[file] || file, main);
    }
  }
}
let old = {entries:[]};
try { old = JSON.parse(await fs.readFile(output, 'utf8')); } catch {}
const cache = new Map(old.entries.map(e => [e.hash, {v:e.v,c:old.colorVersion===3?e.c:null,f:old.colorVersion===3?e.f:null}]));
async function garmentColor(bytes) {
  const {data,info} = await sharp(bytes).rotate().resize(96,96,{fit:'contain',background:'#fff'}).flatten({background:'#fff'}).raw().toBuffer({resolveWithObject:true});
  return {c:photoFabricColor.center(data,info.channels),f:photoFabricColor(data,info.channels)};
}
const extractor = await pipeline('image-feature-extraction', model, {revision,dtype:'q8', session_options:{intraOpNumThreads:4}});
const entries = [], skipped = [];
for (const [file, main] of files) {
  try {
    const bytes = await fs.readFile(path.join(root, file));
    const hash = createHash('sha256').update(bytes).digest('hex');
    let {v,c,f} = cache.get(hash) || {};
    if (!v) {
      const {data, info} = await sharp(bytes).rotate().flatten({background:'#fff'}).resize(224,224,{fit:'contain',background:'#fff'}).removeAlpha().raw().toBuffer({resolveWithObject:true});
      const embedding = await extractor(new RawImage(new Uint8Array(data), info.width, info.height, info.channels));
      const values = embedding.data.slice(0,384); // DINOv2 CLS token.
      const norm = Math.hypot(...values);
      v = Buffer.from(Int8Array.from(values, x=>Math.round(x/norm*127)).buffer).toString('base64');
    }
    if(!c || !f) ({c,f}=await garmentColor(bytes));
    cache.set(hash,{v,c,f});
    entries.push({file,main,hash,v,c,f});
  } catch (error) { skipped.push({file,error:error.message}); console.error('Skipped', file, error.message); }
  if ((entries.length+skipped.length)%50===0) {
    console.log(`${entries.length} indexed / ${files.size} images`);
    await fs.writeFile(output, JSON.stringify({version:1,colorVersion:3,model,revision,dtype:'q8',size:224,aliases,families,entries}));
  }
}
await fs.writeFile(output, JSON.stringify({version:1,colorVersion:3,model,revision,dtype:'q8',size:224,aliases,families,entries}));
console.log(JSON.stringify({indexed:entries.length,skipped},null,2));
