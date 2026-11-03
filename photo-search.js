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

function photoVector(image, crop){
  const canvas=document.createElement("canvas");
  canvas.width=canvas.height=24;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.fillStyle="white";ctx.fillRect(0,0,24,24);
  if(crop){
    ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,24,24);
    const data=ctx.getImageData(0,0,24,24);
    for(let i=0;i<data.data.length;i+=4){
      const r=data.data[i],g=data.data[i+1],b=data.data[i+2];
      if((r+g+b)/3>115 && Math.max(r,g,b)-Math.min(r,g,b)<28){
        data.data[i]=data.data[i+1]=data.data[i+2]=255;
      }
    }
    ctx.putImageData(data,0,0);
  }
  else ctx.drawImage(image,0,0,24,24);
  const pixels=ctx.getImageData(0,0,24,24).data;
  const values=[];
  for(let i=0;i<pixels.length;i+=4) values.push(pixels[i]>>4,pixels[i+1]>>4,pixels[i+2]>>4);
  return values;
}

function photoFamily(name){
  return name.replace(/^(?:black|white|navy|grey|gray|red|blue|pink|brown|green|camo)\s+/i,"").replace(/\s+(?:FW|SS)\d{2}$/i,"").toLowerCase();
}

document.getElementById("cameraButton").onclick = () => photoInput.click();
document.getElementById("photoBack").onclick = () => {
  photoPanel.hidden = true;
  photoInput.value = "";
};

photoInput.onchange = async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  photoPanel.hidden = false;
  photoActions.hidden = true;
  photoMatches.replaceChildren();
  photoStatus.textContent = "Comparing your photo with the archive…";
  const preview = document.getElementById("photoPreview");
  const objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  try {
    await preview.decode();
    if (!items.length) throw new Error("Archive items are still loading. Please try again.");
    const response = await fetch("photo-index.json");
    if (!response.ok) throw new Error("Photo search is unavailable. Please search by name.");
    const index = await response.json();
    let exactHash = "";
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      exactHash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
    }
    const crop=garmentCrop(preview);
    const queries=[photoVector(preview,crop)];
    const darkPixels=Array.from({length:576},(_,i)=>queries[0].slice(i*3,i*3+3)).filter(rgb=>Math.max(...rgb)<7&&Math.max(...rgb)-Math.min(...rgb)<3).length;
    const blackGarment=Boolean(crop)&&darkPixels>80;
    const catalog = new Map(items.map(item => [item.image.split("|")[0].trim(), item]));
    const ranked = index.map(entry => {
      const distance=Math.min(...queries.map(query=>{
        let sum=0;
        for(let i=0;i<1728;i++) sum+=Math.abs(query[i]-parseInt(entry.v[i],16));
        return sum/1728;
      }));
      const item=catalog.get(entry.file);
      const garmentPenalty=crop && crop.width/crop.height>.7 && crop.width/crop.height<1.8 && item?.category!=="Tops" ? .7 : 0;
      const colorPenalty=blackGarment&&item&&!/^Black\b/i.test(item.name) ? .18 : 0;
      return {item, distance:entry.hash===exactHash&&exactHash?-1:distance+garmentPenalty+colorPenalty};
    }).filter(result => result.item).sort((a,b) => a.distance - b.distance);
    const votes=new Map();
    ranked.slice(0,20).forEach((result,i)=>{
      const key=photoFamily(result.item.name);
      const vote=votes.get(key)||{count:0,weight:0};
      vote.count++;vote.weight+=1/(i+1);votes.set(key,vote);
    });
    const family=[...votes].filter(([,vote])=>vote.count>=3).sort((a,b)=>b[1].weight-a[1].weight)[0]?.[0];
    const grouped=family ? ranked.filter(result=>photoFamily(result.item.name)===family&&(!blackGarment||/^Black\b/i.test(result.item.name))) : [];
    const confidentGroup=grouped.length>0 && grouped[0].distance<3;
    const exactMatch=ranked[0]?.distance===-1;
    const results=exactMatch ? ranked.slice(0,1) : confidentGroup ? grouped.slice(0,6) : ranked.slice(0,6);
    if (!ranked.length || (ranked[0].distance > 2.5 && !confidentGroup)) {
      photoStatus.textContent = "No close visual match found. You can request this item or go back.";
    } else {
      photoStatus.textContent = "Possible matches — select the exact item, then choose its size.";
      results.forEach(({item}) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "photo-match";
        const img = document.createElement("img");
        img.src = item.image.split("|")[0].trim();
        img.alt = "";
        const label = document.createElement("span");
        label.textContent = item.name;
        button.append(img, label);
        button.onclick = () => {
          selectedItem = item;
          document.getElementById("search").value = item.name;
          setSizeOptions(item);
          photoPanel.hidden = true;
          document.getElementById("result").replaceChildren();
          document.getElementById("size").focus();
        };
        photoMatches.appendChild(button);
      });
    }
    photoActions.hidden = false;
  } catch (error) {
    photoStatus.textContent = error.message || "Could not check this photo. Please search by name.";
    photoActions.hidden = false;
  } finally {
    URL.revokeObjectURL(objectUrl);
    photoInput.value = "";
  }
};
