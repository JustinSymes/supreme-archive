// U2-NetP salient object segmentation; all image processing stays on device.
async function photoSegmentForeground(buffer) {
  const mean=[.485,.456,.406],std=[.229,.224,.225],source=new Float32Array(buffer);
  const fullFrame=source.length===3*320*320;
  if(!fullFrame && source.length!==3*224*224) return null;
  const input=new Float32Array(3*320*320);
  let maximum=1e-6;
  if(fullFrame) {
    for(const value of source) maximum=Math.max(maximum,value);
    for(let c=0;c<3;c++)for(let i=0;i<320*320;i++)
      input[c*320*320+i]=(source[c*320*320+i]/maximum-mean[c])/std[c];
  } else {
    for(let c=0;c<3;c++)for(let i=0;i<224*224;i++) maximum=Math.max(maximum,source[c*224*224+i]*std[c]+mean[c]);
    for(let c=0;c<3;c++)for(let y=0;y<320;y++)for(let x=0;x<320;x++)
      input[c*320*320+y*320+x]=((source[c*224*224+Math.floor(y*224/320)*224+Math.floor(x*224/320)]*std[c]+mean[c])/maximum-mean[c])/std[c];
  }
  let session,tensor,output;
  try {
    session=await ort.InferenceSession.create('models/u2netp.onnx',{executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false});
    tensor=new ort.Tensor('float32',input,[1,3,320,320]);
    output=await session.run({[session.inputNames[0]]:tensor});
    const mask=output[session.outputNames[0]].data;
    let low=Infinity,high=-Infinity;
    for(const value of mask){low=Math.min(low,value);high=Math.max(high,value);}
    if(high-low<.1) return null;
    let left=224,right=0,top=224,bottom=0,count=0;
    for(let y=0;y<224;y++)for(let x=0;x<224;x++) {
      const alpha=Math.max(0,Math.min(1,(mask[Math.floor(y*320/224)*320+Math.floor(x*320/224)]-low)/(high-low)));
      if(alpha>.5){count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    if(count<224*224*.04||count>224*224*.9||right-left<20||bottom-top<20) return null;
    left=Math.max(0,left-8);right=Math.min(224,right+9);top=Math.max(0,top-8);bottom=Math.min(224,bottom+9);
    return {fullFrame,mask:Float32Array.from(mask,value=>(value-low)/(high-low)),bounds:{x:left/224,y:top/224,width:(right-left)/224,height:(bottom-top)/224}};
  } finally {
    for(const value of Object.values(output||{})) value.dispose?.();
    tensor?.dispose?.();await session?.release();
  }
}

