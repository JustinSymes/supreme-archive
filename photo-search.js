const photoInput = document.getElementById("photoInput");
const photoPanel = document.getElementById("photoPanel");
const photoStatus = document.getElementById("photoStatus");
const photoMatches = document.getElementById("photoMatches");
const photoActions = document.getElementById("photoActions");

function garmentCrop(image){
  const scale = Math.min(256 / image.naturalWidth, 256 / image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d", {willReadFrequently:true});
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width, height = canvas.height;
  const seen = new Uint8Array(width * height);
  let best = null;
  for(let start=0;start<seen.length;start++){
    if(seen[start]) continue;
    seen[start]=1;
    const k=start*4;
    if((data[k]+data[k+1]+data[k+2])/3 > 105) continue;
    const queue=[start];
    let left=width, right=0, top=height, bottom=0, touchesEdge=false;
    for(let head=0;head<queue.length;head++){
      const pos=queue[head], x=pos%width, y=Math.floor(pos/width);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      if(x===0||y===0||x===width-1||y===height-1) touchesEdge=true;
      for(const neighbor of [pos-1,pos+1,pos-width,pos+width]){
        if(neighbor<0||neighbor>=seen.length||seen[neighbor]) continue;
        const nx=neighbor%width;
        if(Math.abs(nx-x)>1) continue;
        seen[neighbor]=1;
        const j=neighbor*4;
        if((data[j]+data[j+1]+data[j+2])/3<=105) queue.push(neighbor);
      }
    }
    const aspect=(right-left+1)/(bottom-top+1);
    if(!touchesEdge && aspect<2.2 && aspect>.4 && bottom-top>height*.07 && (!best||queue.length>best.area)) best={left,right,top,bottom,area:queue.length};
  }
  if(!best||best.area<80) return null;
  const padding=Math.max(best.right-best.left,best.bottom-best.top)*.07;
  return {
    x:Math.max(0,(best.left-padding)/scale),
    y:Math.max(0,(best.top-padding)/scale),
    width:Math.min(image.naturalWidth,(best.right-best.left+1+padding*2)/scale),
    height:Math.min(image.naturalHeight,(best.bottom-best.top+1+padding*2)/scale)
  };
}


let photoSearchId = 0;
let photoWorker;
let photoIndex;
let lightPhotoIndex;
let useLightPhotoSearch=false;
const pendingPhotos = new Map();

function photoFamily(name){
  return name.replace(/^(?:black|white|navy|grey|gray|red|blue|pink|brown|green|camo)\s+/i,'').replace(/\s+(?:FW|SS)\d{2}$/i,'').toLowerCase();
}

function lightPhotoFeatures(image){
  const crop=garmentCrop(image);
  const side=crop?crop.width*.03:0;
  const above=crop?crop.height*.30:0;
  const below=crop?crop.height*.05:0;
  const expanded=crop?{
    x:Math.max(0,crop.x-side),y:Math.max(0,crop.y-above),
    width:Math.min(image.naturalWidth-crop.x+side,crop.width+side*2),
    height:Math.min(image.naturalHeight-crop.y+above,crop.height+above+below)
  }:null;
  const queries=[crop,expanded].filter(Boolean).map(bounds=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='white';ctx.fillRect(0,0,24,24);
    ctx.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height,0,0,24,24);
    const data=ctx.getImageData(0,0,24,24);
    for(let i=0;i<data.data.length;i+=4){
      const r=data.data[i],g=data.data[i+1],b=data.data[i+2];
      if((r+g+b)/3>115&&Math.max(r,g,b)-Math.min(r,g,b)<28) data.data[i]=data.data[i+1]=data.data[i+2]=255;
    }
    const query=[];
    for(let i=0;i<data.data.length;i+=4) query.push(data.data[i]>>4,data.data[i+1]>>4,data.data[i+2]>>4);
    return query;
  });
  if(!queries.length){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='white';ctx.fillRect(0,0,24,24);ctx.drawImage(image,0,0,24,24);
    const data=ctx.getImageData(0,0,24,24).data,query=[];
    for(let i=0;i<data.length;i+=4) query.push(data[i]>>4,data[i+1]>>4,data[i+2]>>4);
    queries.push(query);
  }
  const blackGarment=Boolean(crop)&&Array.from({length:576},(_,i)=>queries[0].slice(i*3,i*3+3)).filter(rgb=>Math.max(...rgb)<7&&Math.max(...rgb)-Math.min(...rgb)<3).length>80;
  return {queries,crop,blackGarment};
}

async function lightPhotoMatches({queries,crop,blackGarment},catalog){
  lightPhotoIndex ||= fetch('photo-index.json').then(response=>{
    if(!response.ok) throw new Error('The lighter photo index could not load.');
    return response.json();
  }).catch(error=>{lightPhotoIndex=null;throw error;});
  const index=await lightPhotoIndex;
  const ranked=index.map(entry=>{
    const item=catalog.get(entry.file);
    if(!item) return null;
    let distance=Infinity;
    for(const query of queries){
      let sum=0;
      for(let i=0;i<1728;i++) sum+=Math.abs(query[i]-parseInt(entry.v[i],16));
      distance=Math.min(distance,sum/1728);
    }
    if(crop&&crop.width/crop.height>.7&&crop.width/crop.height<1.8&&item.category!=='Tops') distance+=.7;
    if(blackGarment&&!/^Black\b/i.test(item.name)) distance+=.18;
    return {item,distance};
  }).filter(Boolean).sort((a,b)=>a.distance-b.distance);
  const votes=new Map();
  ranked.slice(0,20).forEach((result,i)=>{
    const family=photoFamily(result.item.name);
    const vote=votes.get(family)||{count:0,weight:0};
    vote.count++;vote.weight+=1/(i+1);votes.set(family,vote);
  });
  const family=[...votes].filter(([,vote])=>vote.count>=3).sort((a,b)=>b[1].weight-a[1].weight)[0]?.[0];
  const grouped=family?ranked.filter(result=>photoFamily(result.item.name)===family&&(!blackGarment||/^Black\b/i.test(result.item.name))):[];
  const cutoff=blackGarment?3.5:3;
  const candidates=grouped.length&&grouped[0].distance<cutoff?grouped:ranked;
  if(!candidates.length||candidates[0].distance>=cutoff) return [];
  return candidates.slice(0,6).map(result=>({file:result.item.image.split('|')[0].trim(),score:1-result.distance/8}));
}

function recognitionViews(image) {
  const crop = garmentCrop(image);
  return [null, ...(crop ? [crop] : [])].map(bounds => {
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=224;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='white';ctx.fillRect(0,0,224,224);
    const {x,y,width,height}=bounds||{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
    const scale=Math.min(224/width,224/height);
    ctx.drawImage(image,x,y,width,height,(224-width*scale)/2,(224-height*scale)/2,width*scale,height*scale);
    // Match the pinned DINOv2 processor: resize 224 -> 256, center crop
    // to 224, rescale, then normalize RGB in channel-first order.
    // DOM canvas works on iPhone even when worker OffscreenCanvas does not.
    const resized=document.createElement('canvas');
    resized.width=resized.height=256;
    const resizeContext=resized.getContext('2d',{willReadFrequently:true});
    resizeContext.drawImage(canvas,0,0,256,256);
    const rgba=resizeContext.getImageData(16,16,224,224).data;
    const pixels=224*224;
    const values=new Float32Array(3*pixels);
    const mean=[.485,.456,.406],std=[.229,.224,.225];
    for(let i=0;i<pixels;i++) for(let channel=0;channel<3;channel++) {
      values[channel*pixels+i]=(Math.fround(rgba[i*4+channel]/255)-mean[channel])/std[channel];
    }
    return values.buffer;
  });
}
function recognizePhoto(id, views) {
  if(!photoWorker) {
    photoWorker=new Worker('photo-recognition-worker.js?v=20261104-light');
    photoWorker.onmessage=({data})=>{
      if(data.id===photoSearchId) {
        if(data.progress!==undefined) photoStatus.textContent='Loading photo recognition ('+data.progress+'%). First use may take a moment.';
        if(data.comparing) photoStatus.textContent='Comparing your photo with the archive...';
      }
      const pending=pendingPhotos.get(data.id);
      if(pending && (data.results || data.error)) {
        pendingPhotos.delete(data.id);
        data.error ? pending.reject(new Error(data.error)) : pending.resolve(data.results);
        if(data.error) {
          // A failed WASM initialization cannot be reused. Release it before retrying.
          for(const other of pendingPhotos.values()) other.reject(new Error(data.error));
          pendingPhotos.clear();photoWorker.terminate();photoWorker=null;
        }
      }
    };
    photoWorker.onerror=()=>{
      for(const pending of pendingPhotos.values()) pending.reject(new Error('Photo recognition could not load. Check your connection and try again.'));
      pendingPhotos.clear();photoWorker.terminate();photoWorker=null;
    };
  }
  return new Promise((resolve,reject)=>{
    pendingPhotos.set(id,{resolve,reject});
    photoWorker.postMessage({id,views},views);
  });
}

document.getElementById('cameraButton').onclick=()=>photoInput.click();
document.getElementById('photoBack').onclick=()=>{
  photoSearchId++;
  photoPanel.hidden=true;
  photoInput.value='';
};
photoInput.onchange=async()=>{
  const file=photoInput.files?.[0];
  if(!file) return;
  const id=++photoSearchId;
  photoPanel.hidden=false;photoActions.hidden=false;
  photoMatches.replaceChildren();
  photoStatus.textContent='Checking your photo...';
  const preview=document.getElementById('photoPreview');
  const objectUrl=URL.createObjectURL(file);
  preview.src=objectUrl;
  try {
    await preview.decode();
    if(id!==photoSearchId) return;
    if(!items.length) throw new Error('Archive items are still loading. Please try again.');
    photoIndex ||= fetch('photo-embeddings.json').then(response=>{
      if(!response.ok) throw new Error('Could not load the archive photo index.');
      return response.json();
    }).catch(error=>{photoIndex=null;throw error;});
    const index=await photoIndex;
    if(id!==photoSearchId) return;
    const catalog=new Map(items.map(item=>[item.image.split('|')[0].trim(),item]));
    let exact;
    if(crypto.subtle) {
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
      exact=index.entries.find(entry=>entry.hash===hash && catalog.has(entry.main));
    }
    if(id!==photoSearchId) return;
    let matches;
    let lighterMode=false;
    if(exact) matches=[{file:exact.main,score:1}];
    else {
      const views=recognitionViews(preview);
      const lightFeatures=lightPhotoFeatures(preview);
      // Release the full-resolution camera image before allocating the model.
      const scale=Math.min(1,1024/Math.max(preview.naturalWidth,preview.naturalHeight));
      if(scale<1) {
        const thumbnail=document.createElement('canvas');
        thumbnail.width=Math.round(preview.naturalWidth*scale);
        thumbnail.height=Math.round(preview.naturalHeight*scale);
        const ctx=thumbnail.getContext('2d');
        ctx.fillStyle='white';ctx.fillRect(0,0,thumbnail.width,thumbnail.height);
        ctx.drawImage(preview,0,0,thumbnail.width,thumbnail.height);
        preview.src=thumbnail.toDataURL('image/jpeg',.85);
        thumbnail.width=thumbnail.height=1;
        URL.revokeObjectURL(objectUrl);
        await preview.decode();
      }
      if(id!==photoSearchId) return;
      if(!useLightPhotoSearch){
        photoStatus.textContent='Loading photo recognition. First use may take a moment.';
        try { matches=await recognizePhoto(id,views); }
        catch(error){
          console.warn('Using lighter photo search:',error);
          useLightPhotoSearch=true;
        }
      }
      if(useLightPhotoSearch){
        if(id!==photoSearchId) return;
        photoStatus.textContent='Checking with the lighter photo search...';
        matches=await lightPhotoMatches(lightFeatures,catalog);
        lighterMode=true;
      }
    }
    if(id!==photoSearchId) return;
    matches=matches.filter(match=>catalog.has(match.file));
    const best=matches[0]?.score??0;
    const results=matches.filter(match=>match.score>=.55&&match.score>=best-.1).slice(0,6);
    if(!results.length) photoStatus.textContent='No confident match found. Try a closer photo, search by name, or request this item.';
    else {
      photoStatus.textContent=lighterMode
        ? 'Using lighter photo search on this phone. Check the item carefully before adding it.'
        : 'Closest matches: select the exact item, then choose its size.';
      for(const match of results) {
        const original=catalog.get(match.file);
        const item={...original,image:original.image.split('|').map(file=>index.aliases?.[file.trim()]||file.trim()).join('|')};
        const button=document.createElement('button');button.type='button';button.className='photo-match';
        const img=document.createElement('img');img.src=item.image.split('|')[0].trim();img.alt='';
        const label=document.createElement('span');label.textContent=item.name;
        button.append(img,label);
        button.onclick=()=>{
          selectedItem=item;
          document.getElementById('search').value=item.name;
          setSizeOptions(item);
          photoPanel.hidden=true;
          const selectedResult=document.createElement('div');
          selectedResult.className='result-item selected';
          const selectedImage=document.createElement('img');
          selectedImage.src=item.image.split('|')[0].trim();
          selectedImage.alt='';
          const selectedName=document.createElement('div');
          selectedName.textContent=item.name;
          selectedResult.append(selectedImage,selectedName);
          document.getElementById('result').replaceChildren(selectedResult);
          window.scrollTo({top:0,behavior:'smooth'});
        };
        photoMatches.appendChild(button);
      }
    }
  } catch(error) {
    if(id===photoSearchId) {
      const reason=error.name==='EncodingError' ? 'This photo format could not be opened. Try a JPEG or PNG photo.' : String(error.message||'Please try again or search by name.').slice(0,180);
      photoStatus.textContent='Could not complete photo recognition. '+reason;
    }
    console.error('Photo recognition:',error);
  } finally {
    URL.revokeObjectURL(objectUrl);
    if(id===photoSearchId) photoInput.value='';
  }
};
