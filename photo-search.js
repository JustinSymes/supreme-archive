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
const pendingPhotos = new Map();

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
    photoWorker=new Worker('photo-recognition-worker.js?v=20261104-mobile');
    photoWorker.onmessage=({data})=>{
      if(data.id===photoSearchId) {
        if(data.progress!==undefined) photoStatus.textContent='Loading photo recognition ('+data.progress+'%). First use may take a moment.';
        if(data.comparing) photoStatus.textContent='Comparing your photo with the archive...';
      }
      const pending=pendingPhotos.get(data.id);
      if(pending && (data.results || data.error)) {
        pendingPhotos.delete(data.id);
        data.error ? pending.reject(new Error(data.error)) : pending.resolve(data.results);
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
    if(exact) matches=[{file:exact.main,score:1}];
    else {
      photoStatus.textContent='Loading photo recognition. First use may take a moment.';
      matches=await recognizePhoto(id,recognitionViews(preview));
    }
    if(id!==photoSearchId) return;
    matches=matches.filter(match=>catalog.has(match.file));
    const best=matches[0]?.score??0;
    const results=matches.filter(match=>match.score>=.55&&match.score>=best-.1).slice(0,6);
    if(!results.length) photoStatus.textContent='No confident match found. Try a closer photo, search by name, or request this item.';
    else {
      photoStatus.textContent='Closest matches: select the exact item, then choose its size.';
      for(const match of results) {
        const original=catalog.get(match.file);
        const item={...original,image:original.image.split('|').map(file=>index.aliases?.[file.trim()]||file.trim()).join('|')};
        const button=document.createElement('button');button.type='button';button.className='photo-match';
        const img=document.createElement('img');img.src=item.image.split('|')[0].trim();img.alt='';
        const label=document.createElement('span');label.textContent=item.name;
        button.append(img,label);
        button.onclick=()=>{
          selectedItem=item;document.getElementById('search').value=item.name;setSizeOptions(item);
          photoPanel.hidden=true;document.getElementById('result').replaceChildren();document.getElementById('size').focus();
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
