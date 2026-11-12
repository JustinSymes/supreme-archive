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

function photoFocusCrop(image){
  // A small item surrounded by a plain margin is easy to lose at 224px.
  // Detect that framing only when all four corners agree on the background.
  const side=128,canvas=document.createElement('canvas');
  canvas.width=canvas.height=side;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.fillStyle='white';ctx.fillRect(0,0,side,side);
  ctx.drawImage(image,0,0,side,side);
  const pixels=ctx.getImageData(0,0,side,side).data;
  canvas.width=canvas.height=1;
  const corners=[];
  for(const startY of [0,side-4]) for(const startX of [0,side-4]) {
    const sum=[0,0,0],squares=[0,0,0];
    for(let y=startY;y<startY+4;y++) for(let x=startX;x<startX+4;x++) {
      const offset=(y*side+x)*4;
      for(let channel=0;channel<3;channel++) {
        const value=pixels[offset+channel];
        sum[channel]+=value;squares[channel]+=value*value;
      }
    }
    const mean=sum.map(value=>value/16);
    if(mean.some((value,i)=>Math.sqrt(Math.max(0,squares[i]/16-value*value))>9)) return null;
    corners.push(mean);
  }
  const background=[0,1,2].map(i=>corners.reduce((sum,color)=>sum+color[i],0)/4);
  if(corners.some(color=>Math.hypot(...color.map((value,i)=>value-background[i]))>20)) return null;
  let left=side,right=0,top=side,bottom=0,count=0;
  for(let y=0;y<side;y++) for(let x=0;x<side;x++) {
    const offset=(y*side+x)*4;
    const distance=Math.hypot(...background.map((value,i)=>pixels[offset+i]-value));
    if(distance<=45) continue;
    count++;left=Math.min(left,x);right=Math.max(right,x);
    top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  const width=right-left+1,height=bottom-top+1;
  if(count<side*side*.02 || width<24 || height<24 || width*height>side*side*.72) return null;
  const displacement=Math.hypot((left+right+1)/2-side/2,(top+bottom+1)/2-side/2)/side;
  if(displacement<.09 && Math.max(width,height)>side*.65) return null;
  const padding=Math.max(3,Math.round(Math.max(width,height)*.06));
  const x=Math.max(0,left-padding),y=Math.max(0,top-padding);
  const endX=Math.min(side,right+padding+1),endY=Math.min(side,bottom+padding+1);
  return {x:x/side*image.naturalWidth,y:y/side*image.naturalHeight,
    width:(endX-x)/side*image.naturalWidth,height:(endY-y)/side*image.naturalHeight};
}

function hasRedCrossLogo(pixels){
  const side=224, mask=new Uint8Array(side*side), seen=new Uint8Array(side*side);
  // Look for a connected red cross near the chest. Red text, skin, and a
  // horizontal box logo have different proportions and row widths.
  for(let y=50;y<185;y++) for(let x=60;x<165;x++) {
    const offset=(y*side+x)*4,r=pixels[offset],g=pixels[offset+1],b=pixels[offset+2];
    if(r>75 && r>g*1.4 && r>b*1.35) mask[y*side+x]=1;
  }
  for(let y=50;y<185;y++) for(let x=60;x<165;x++) {
    const start=y*side+x;
    if(!mask[start] || seen[start]) continue;
    const stack=[start], component=[];
    seen[start]=1;
    let left=x,right=x,top=y,bottom=y;
    while(stack.length) {
      const point=stack.pop(),px=point%side,py=(point/side)|0;
      component.push(point);
      left=Math.min(left,px);right=Math.max(right,px);
      top=Math.min(top,py);bottom=Math.max(bottom,py);
      for(const next of [point-1,point+1,point-side,point+side]) {
        if(mask[next] && !seen[next]) {seen[next]=1;stack.push(next);}
      }
    }
    const width=right-left+1,height=bottom-top+1;
    if(component.length<80 || component.length>1000 || width<12 || width>60 ||
       height<12 || height>65 || width/height<.65 || width/height>1.5) continue;
    const bands=[0,0,0,0,0];
    for(const point of component) {
      const row=(point/side)|0;
      bands[Math.min(4,Math.floor(5*(row-top)/height))]++;
    }
    if(bands[1]>bands[0]*1.7 && bands[2]>bands[4]*1.7 &&
       bands[0]>bands[4]*.55 && bands[4]>bands[0]*.55) return true;
  }
  return false;
}

function photoSignals(image,bounds){
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const draw=size=>{
    canvas.width=canvas.height=size;
    ctx.fillStyle='white';ctx.fillRect(0,0,size,size);
    const {x,y,width,height}=bounds||{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};
    const scale=Math.min(size/width,size/height);
    ctx.drawImage(image,x,y,width,height,(size-width*scale)/2,(size-height*scale)/2,width*scale,height*scale);
    return ctx.getImageData(0,0,size,size).data;
  };
  const pixels=draw(96),fabricColor=photoFabricColor(pixels),color=photoCenterColor(pixels);
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
  const neutralTone=Math.max(...color)-Math.min(...color)<=22 &&
    Math.max(...fabricColor)-Math.min(...fabricColor)<=22 &&
    Math.min(...color,...fabricColor)>=115 &&
    Math.hypot(...color.map((value,i)=>value-fabricColor[i]))<50;
  const logo=neutralTone && hasRedCrossLogo(rgb) ? 'cross' : cyan>=80 ? 'large' :
    red>=5 && red<=150 && redRight-redLeft<20 && redBottom-redTop<15 ? 'small' : null;
  return {color,fabricColor,logo};
}


let photoSearchId = 0;
let photoWorker;
let photoIndex;
const pendingPhotos = new Map();

function recognitionViews(image,focusCrop) {
  const crop = focusCrop||garmentCrop(image);
  const lowerShoe=image.naturalHeight>image.naturalWidth*1.15 ? {
    x:0,y:image.naturalHeight*.42,width:image.naturalWidth,height:image.naturalHeight*.58
  } : null;
  return [null, crop, ...(lowerShoe ? [lowerShoe] : [])].map(bounds => {
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
    photoWorker=new Worker('photo-recognition-worker.js?v=20261112-mophie');
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
    photoIndex ||= fetch('photo-embeddings.json?v=20261112-mophie').then(response=>{
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
      const focusCrop=photoFocusCrop(preview);
      const views=recognitionViews(preview,focusCrop);
      const signals=photoSignals(preview,focusCrop);
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
    if(results.length && related) {
      const position=results.findIndex(match=>match.file===related.file);
      // For tops, keep one visually related colorway near the leading design
      // when lighting makes its color harder to place. Shoes with the same
      // name can be different releases, so preserve their existing order.
      if(position<0 || catalog.get(results[0].file)?.category==='Tops') {
        if(position>=0) results.splice(position,1);
        results.splice(1,0,related);
        results.length=Math.min(results.length,6);
      }
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
