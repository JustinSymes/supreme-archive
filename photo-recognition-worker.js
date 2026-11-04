// Run recognition off the UI thread. Photos stay in the browser.
let ready;
async function initialize() {
  // 1.17.3 provides an actual non-threaded WASM binary. Newer releases use
  // the threaded build even with numThreads=1. Keep JS and WASM versions paired.
  // Use this same runtime and the same DINOv2 weights on phones and desktops.
  const runtime='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
  importScripts(runtime+'ort.wasm.min.js');
  ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmPaths=runtime;
  const response = await fetch('photo-embeddings.json');
  if (!response.ok) throw new Error('Could not load the archive photo index.');
  const index = await response.json();
  const model = await ort.InferenceSession.create(
    `https://huggingface.co/${index.model}/resolve/${index.revision}/onnx/model_quantized.onnx`,
    {executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false,
      freeDimensionOverrides:{batch_size:1,num_channels:3,height:224,width:224}}
  );
  const entries = index.entries.map(entry => {
    const vector = Int8Array.from(atob(entry.v), c=>c.charCodeAt(0));
    return {main:entry.main, vector, norm:Math.hypot(...vector)};
  });
  return {model, Tensor:ort.Tensor, entries};
}
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.catch(()=>{}).then(async () => {
    const {id, views} = data;
    try {
      ready ||= initialize().catch(error=>{ready=null;throw error;});
      const {model, Tensor, entries} = await ready;
      self.postMessage({id,comparing:true});
      const vectors=[];
      for(const view of views) {
        const input = new Tensor('float32',new Float32Array(view),[1,3,224,224]);
        const output = await model.run({pixel_values:input});
        const vector = output.last_hidden_state.data.slice(0,384);
        for(const tensor of Object.values(output)) tensor.dispose?.();
        input.dispose?.();
        const norm = Math.hypot(...vector);
        vectors.push(Array.from(vector,x=>x/norm));
      }
      const scores = new Map();
      for(const entry of entries) {
        let score = -1;
        for(const vector of vectors) {
          let dot = 0;
          for(let i=0;i<384;i++) dot += vector[i]*entry.vector[i];
          score=Math.max(score,dot/entry.norm);
        }
        if(score>(scores.get(entry.main)??-1)) scores.set(entry.main,score);
      }
      self.postMessage({id,results:[...scores].map(([file,score])=>({file,score})).sort((a,b)=>b.score-a.score).slice(0,30)});
    } catch(error) { self.postMessage({id,error:String(error?.message||error)}); }
  });
};
