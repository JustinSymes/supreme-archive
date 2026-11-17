const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
async function segment(mask,fail=false){
  let released=0,disposed=0;
  const context=vm.createContext({ort:{Tensor:class{dispose(){disposed++;}},InferenceSession:{create:async()=>({inputNames:['input'],outputNames:['mask'],run:async()=>{if(fail)throw Error('inference failed');return {mask:{data:mask,dispose(){disposed++;}}};},release:async()=>{released++;}})}}});
  vm.runInContext(fs.readFileSync(require.resolve('../../photo-foreground.js'),'utf8'),context);
  context.input=new Float32Array(3*224*224).buffer;
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
