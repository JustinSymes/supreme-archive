const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
async function segment(mask,fail=false,side=320){
  let released=0,disposed=0;
  const context=vm.createContext({ort:{Tensor:class{dispose(){disposed++;}},InferenceSession:{create:async()=>({inputNames:['input'],outputNames:['mask'],run:async()=>{if(fail)throw Error('inference failed');return {mask:{data:mask,dispose(){disposed++;}}};},release:async()=>{released++;}})}}});
  vm.runInContext(fs.readFileSync(require.resolve('../../photo-foreground.js'),'utf8'),context);
  context.input=new Float32Array(3*side*side).buffer;
  try{return {result:await vm.runInContext('photoSegmentForeground(input)',context),released,disposed};}
  catch(error){return {error,released,disposed};}
}
test('foreground mask preserves an off-center object and releases model tensors',async()=>{
  const mask=new Float32Array(320*320);
  for(let y=40;y<200;y++)for(let x=30;x<150;x++)mask[y*320+x]=1;
  const {result,released,disposed}=await segment(mask);
  assert(result);assert(result.bounds.x<30/320);assert(result.bounds.y<40/320);
  assert(result.bounds.x+result.bounds.width>=150/320);
  assert(result.bounds.y+result.bounds.height>=200/320);
  assert.equal(released,1);assert.equal(disposed,2);
});
test('uniform masks cannot fabricate a foreground crop',async()=>{
  const {result,released}=await segment(new Float32Array(320*320).fill(.8));
  assert.equal(result,null);assert.equal(released,1);
});
test('segmentation failures release the session and input',async()=>{
  const {error,released,disposed}=await segment(null,true);
  assert.match(error.message,/inference failed/);assert.equal(released,1);assert.equal(disposed,1);
});

test('full-frame and center-cropped masks retain their coordinate system',async()=>{
  const mask=new Float32Array(320*320);
  for(let y=50;y<250;y++)for(let x=0;x<100;x++)mask[y*320+x]=1;
  for(const side of [224,320]) {
    const {result}=await segment(mask,false,side);
    assert.equal(result.fullFrame,side===320);
    assert.equal(result.bounds.x,0);
    assert(result.bounds.x+result.bounds.width>=100/320);
  }
});

async function retryForeground({improvement=true,fail=false,strong=false,embedFail=false}={}) {
  const messages=[],calls=[];
  let inputs=0,disposedInputs=0;
  let context;
  const view=axis=>{const v=new Float32Array(3*224*224);v[axis]=1;return v.buffer;};
  const vector=(a,b)=>Float32Array.from({length:384},(_,i)=>i===0?a:i===1?b:i===2?Math.sqrt(1-a*a-b*b):0);
  const entries=[{main:'original.jpg',vector:vector(strong ? .9 : .75,.1),norm:1},
    {main:'retry.jpg',vector:vector(.1,improvement ? .85 : .77),norm:1}];
  context=vm.createContext({Float32Array,Map,Math,Array,Promise,setTimeout,clearTimeout,
    console:{warn(){}},importScripts(){},
    photoSegmentForeground:async buffer=>{const fullFrame=buffer.byteLength===3*320*320*4;calls.push(fullFrame);if(fullFrame&&fail)throw Error('retry failed');return {fullFrame,mask:new Float32Array(320*320),bounds:{x:.2,y:.2,width:.5,height:.5}};},
    self:{postMessage(data){messages.push(data);if(data.foregroundMask)queueMicrotask(()=>context.self.onmessage({data:{id:data.id,foregroundPrepared:true,result:{view:view(data.foregroundMask.fullFrame?1:0),signals:{}}}}));}},
    fixture:{entries,families:{},categories:{},Tensor:class{constructor(type,data){this.data=data;inputs++;}dispose(){disposedInputs++;}},
      model:{run:async({pixel_values})=>{if(embedFail&&pixel_values.data[1]===1)throw Error('embedding failed');return {last_hidden_state:{data:pixel_values.data.slice(0,384),dispose(){}}};}}}
  });
  vm.runInContext(fs.readFileSync(require.resolve('../../photo-recognition-worker.js'),'utf8'),context);
  context.views=[view(0)];context.segmentation=new Float32Array(3*320*320).buffer;
  vm.runInContext('ready=Promise.resolve(fixture);self.onmessage({data:{id:1,views,segmentation,signals:{}}});',context);
  await vm.runInContext('queue',context);
  assert(!messages.at(-1).error,messages.at(-1).error);
  assert.equal(disposedInputs,inputs,'all inference inputs released');
  return {results:messages.at(-1).results,calls};
}

test('a stronger full-frame crop can recover an item absent from the original results',async()=>{
  const {results,calls}=await retryForeground();
  assert.equal(results[0].file,'retry.jpg');assert.deepEqual(calls,[false,true]);
});

test('a marginal or failed retry preserves the original item',async()=>{
  for(const options of [{improvement:false},{fail:true},{embedFail:true}])assert.equal((await retryForeground(options)).results[0].file,'original.jpg');
});

test('a strong crop away from frame edges does not pay for another model pass',async()=>{
  const {results,calls}=await retryForeground({strong:true});
  assert.equal(results[0].file,'original.jpg');assert.deepEqual(calls,[false]);
});
