const photoInput = document.getElementById("photoInput");
const photoPanel = document.getElementById("photoPanel");
const photoStatus = document.getElementById("photoStatus");
const photoMatches = document.getElementById("photoMatches");
const photoActions = document.getElementById("photoActions");

function garmentCrop(image){
  return {
    x:image.naturalWidth*.12,
    y:image.naturalHeight*.10,
    width:image.naturalWidth*.76,
    height:image.naturalHeight*.80
  };
}

function photoSignals(image){
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const draw=size=>{
    canvas.width=canvas.height=size;
    ctx.fillStyle='white';ctx.fillRect(0,0,size,size);
    const scale=Math.min(size/image.naturalWidth,size/image.naturalHeight);
    ctx.drawImage(image,(size-image.naturalWidth*scale)/2,(size-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale);
    return ctx.getImageData(0,0,size,size).data;
  };
  const pixels=draw(96),samples=[[],[],[]];
  for(let y=38;y<68;y++) for(const start of [35,52]) for(let x=start;x<start+10;x++) {
    const offset=(y*96+x)*4;
    for(let channel=0;channel<3;channel++) samples[channel].push(pixels[offset+channel]);
  }
  const color=samples.map(values=>values.sort((a,b)=>a-b)[values.length>>1]);
  const rgb=draw(224),sum=color[0]+color[1]+color[2];
  let cyan=0,red=0,redLeft=224,redRight=0,redTop=224,redBottom=0;
  for(let y=65;y<125;y++) for(let x=72;x<152;x++) {
    const offset=(y*224+x)*4,r=rgb[offset],g=rgb[offset+1],b=rgb[offset+2],total=r+g+b;
    if(!total || Math.hypot(r/total-color[0]/sum,g/total-color[1]/sum,b/total-color[2]/sum)<=.14) continue;
    if(b>r*1.12 && g>r*1.15 && g>60) cyan++;
    if(r>g*1.4 && r>b*1.35 && r>75) {
      red++;redLeft=Math.min(redLeft,x);redRight=Math.max(redRight,x);
      redTop=Math.min(redTop,y);redBottom=Math.max(redBottom,y);
    }
  }
  canvas.width=canvas.height=1;
  const logo=cyan>=80 ? 'large' : red>=5 && red<=150 && redRight-redLeft<20 && redBottom-redTop<15 ? 'small' : null;
  return {color,logo};
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
function recognizePhoto(id, views, signals) {
  if(!photoWorker) {
    photoWorker=new Worker('photo-recognition-worker.js?v=20261105-family');
    photoWorker.onmessage=({data})=>{
      if(data.id===photoSearchId) {
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
    photoWorker.postMessage({id,views,signals},views);
  });
}

function releasePhotoWorker(){
  if(!photoWorker) return;
  photoWorker.terminate();
  photoWorker=null;
  for(const pending of pendingPhotos.values()) pending.reject(new Error('Photo search closed.'));
  pendingPhotos.clear();
}
// Do not retain model memory after photo search is closed or left in the background.
// Reopening photo search uses the same model through the browser's download cache.
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && !pendingPhotos.size) releasePhotoWorker();
});
window.addEventListener('pagehide',releasePhotoWorker);

document.getElementById('cameraButton').onclick=()=>photoInput.click();
document.getElementById('photoBack').onclick=()=>{
  photoSearchId++;
  releasePhotoWorker();
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
      const views=recognitionViews(preview);
      const signals=photoSignals(preview);
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
      photoStatus.textContent='Loading photo recognition. First use may take a moment.';
      matches=await recognizePhoto(id,views,signals);
    }
    if(id!==photoSearchId) return;
    matches=matches.filter(match=>catalog.has(match.file));
    const best=matches[0]?.score??0;
    const results=matches.filter(match=>match.score>=.55&&match.score>=best-.1).slice(0,6);
    const related=matches.find(match=>match.related && catalog.has(match.file));
    if(results.length && related && !results.some(match=>match.file===related.file)) {
      results.splice(1,0,related);
      results.length=Math.min(results.length,6);
    }
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
          selectedItem=item;
          document.getElementById('search').value=item.name;
          setSizeOptions(item);
          releasePhotoWorker();
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
