// Run recognition off the UI thread. Photos stay in the browser.
let ready;
async function initialize(progress) {
  const {pipeline, RawImage, env} = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js');
  env.allowLocalModels = false;
  env.backends.onnx.wasm.numThreads = 1;
  const response = await fetch('photo-embeddings.json');
  if (!response.ok) throw new Error('Could not load the archive photo index.');
  const index = await response.json();
  const extractor = await pipeline('image-feature-extraction', index.model, {
    revision:index.revision, dtype:index.dtype, device:'wasm',
    progress_callback:event => { if(event.status==='progress') progress(event.progress); }
  });
  const entries = index.entries.map(entry => {
    const vector = Int8Array.from(atob(entry.v), c=>c.charCodeAt(0));
    return {...entry, vector, norm:Math.hypot(...vector)};
  });
  return {extractor, RawImage, entries};
}
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.catch(()=>{}).then(async () => {
    const {id, views} = data;
    try {
      ready ||= initialize(percent=>self.postMessage({id,progress:Math.round(percent)})).catch(error=>{ready=null;throw error;});
      const {extractor, RawImage, entries} = await ready;
      self.postMessage({id,comparing:true});
      const vectors=[];
      for(const view of views) {
        const tensor = await extractor(new RawImage(new Uint8Array(view),224,224,3));
        const vector = tensor.data.slice(0,384);
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
    } catch(error) { self.postMessage({id,error:error.message}); }
  });
};
