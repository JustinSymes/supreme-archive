// Run recognition off the UI thread. Photos stay in the browser.
let ready;
async function initialize(progress) {
  const {AutoModel, Tensor, env} = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
  env.allowLocalModels = false;
  env.backends.onnx.wasm.numThreads = 1;
  // Use the plain WASM build matching Transformers.js's pinned ONNX runtime.
  // The default JSEP build can exhaust iPhone memory during WebAssembly compilation.
  const runtime='https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/';
  env.backends.onnx.wasm.wasmPaths={
    mjs:runtime+'ort-wasm-simd-threaded.mjs',
    wasm:runtime+'ort-wasm-simd-threaded.wasm'
  };
  const response = await fetch('photo-embeddings.json');
  if (!response.ok) throw new Error('Could not load the archive photo index.');
  const index = await response.json();
  const model = await AutoModel.from_pretrained(index.model, {
    revision:index.revision, dtype:index.dtype, device:'wasm',
    session_options:{enableCpuMemArena:false,enableMemPattern:false},
    progress_callback:event => { if(event.status==='progress') progress(event.progress); }
  });
  const entries = index.entries.map(entry => {
    const vector = Int8Array.from(atob(entry.v), c=>c.charCodeAt(0));
    return {...entry, vector, norm:Math.hypot(...vector)};
  });
  return {model, Tensor, entries};
}
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.catch(()=>{}).then(async () => {
    const {id, views} = data;
    try {
      ready ||= initialize(percent=>self.postMessage({id,progress:Math.round(percent)})).catch(error=>{ready=null;throw error;});
      const {model, Tensor, entries} = await ready;
      self.postMessage({id,comparing:true});
      const vectors=[];
      for(const view of views) {
        const input = new Tensor('float32',new Float32Array(view),[1,3,224,224]);
        const output = await model({pixel_values:input});
        const vector = output.last_hidden_state.data.slice(0,384);
        for(const tensor of Object.values(output)) tensor.dispose?.();
        input.dispose();
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
