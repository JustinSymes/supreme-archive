const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const photoFabricColor=require('../../photo-color.js');

async function rank(entries,color=[0,0,0],extraSignals={},categories={}) {
  const results=[];
  const context=vm.createContext({self:{postMessage:data=>results.push(data)},Float32Array,Map,Math,Array,Promise});
  vm.runInContext(fs.readFileSync(require.resolve('../../photo-recognition-worker.js'),'utf8'),context);
  context.fixture={entries:entries.map(([main,similarity,c,f])=>{
    const vector=new Float32Array(384);vector[0]=similarity;vector[1]=Math.sqrt(1-similarity**2);
    return {main,vector,norm:1,color:c,fabricColor:f};
  }),families:{},categories,Tensor:class{},model:{run:async()=>({last_hidden_state:{data:Float32Array.from({length:384},(_,i)=>i===0?1:0)}})}};
  vm.runInContext('ready=Promise.resolve(fixture);self.onmessage({data:{id:1,views:[new ArrayBuffer(0)],signals:'+JSON.stringify({color,...extraSignals})+'}});',context);
  await vm.runInContext('queue',context);
  assert(!results.at(-1).error,results.at(-1).error);
  return results.at(-1).results;
}

test('a weak gallery view cannot donate its color to a strong view',async()=>{
  const results=await rank([
    ['mixed',.85,[255,255,255]],['mixed',.60,[0,0,0]],
    ['correct',.84,[0,0,0]]
  ]);
  assert.equal(results[0].file,'correct');
});
test('matching color cannot rescue an unrelated visual match',async()=>{
  const results=await rank([['garment',.85,[255,255,255]],['unrelated',.54,[0,0,0]]]);
  assert(!results.some(x=>x.file==='unrelated'));
  assert.equal((await rank([['unrelated',.4,[0,0,0]]])).length,0);
});
test('central printed artwork does not become the fabric color',()=>{
  const pixels=new Uint8Array(96*96*4).fill(255);
  for(let y=20;y<86;y++)for(let x=30;x<66;x++)for(let c=0;c<3;c++)pixels[(y*96+x)*4+c]=90;
  for(let y=30;y<70;y++)for(let x=43;x<53;x++){pixels[(y*96+x)*4]=220;pixels[(y*96+x)*4+1]=30;pixels[(y*96+x)*4+2]=20;}
  assert.deepEqual(photoFabricColor(pixels),[90,90,90]);
});
test('neutral hoodie photo does not receive a false small-logo bonus',async()=>{
  const entries=[
    ['Grey_Cross_Box_Logo_Hoodie.png',.84,[210,211,213],[208,208,210]],
    ['Olive_Cross_Box_Logo_Hoodie.png',.82,[124,123,116],[110,110,108]],
    ['Grey_Small_Box_Zip_Up_Hooded_Sweatshirt.png',.83,[135,135,135],[142,142,142]],
    ...Array.from({length:7},(_,i)=>['Other_Hoodie_'+i,.81,[145,145,145],[145,145,145]])
  ];
  const withFalseLogo=await rank(entries,[128,125,120],{fabricColor:[143,141,139],logo:'small'});
  const withoutLogo=await rank(entries,[128,125,120],{fabricColor:[143,141,139],logo:null});
  assert.equal(JSON.stringify(withFalseLogo.map(x=>x.file)),JSON.stringify(withoutLogo.map(x=>x.file)));
});
test('a weak shoe photo can pass when its center color agrees with the strongest visual match',async()=>{
  const entries=[
    ['brown-shoe',.496,[84,64,58],[255,255,255]],
    ['black-shoe',.489,[31,31,32],[31,31,32]],
    ...Array.from({length:5},(_,i)=>['other-shoe-'+i,.43,[100,100,100],[100,100,100]])
  ];
  const categories=Object.fromEntries(entries.map(([name])=>[name,'Shoes']));
  const shoes=await rank(entries,[74,58,53],{},categories);
  assert.equal(shoes[0].file,'brown-shoe');
  assert(shoes[0].score>.55);
  assert(shoes.find(item=>item.file==='black-shoe').score<.55);
  const clothing=await rank(entries,[74,58,53]);
  assert.equal(clothing.length,0);
});
