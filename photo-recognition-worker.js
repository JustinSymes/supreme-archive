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
  const response = await fetch('photo-embeddings.json?v=20261112-mophie');
  if (!response.ok) throw new Error('Could not load the archive photo index.');
  const index = await response.json();
  const model = await ort.InferenceSession.create(
    `https://huggingface.co/${index.model}/resolve/${index.revision}/onnx/model_quantized.onnx`,
    {executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false,
      freeDimensionOverrides:{batch_size:1,num_channels:3,height:224,width:224}}
  );
  const entries = index.entries.map(entry => {
    const vector = Int8Array.from(atob(entry.v), c=>c.charCodeAt(0));
    return {main:entry.main, color:entry.c, fabricColor:entry.f, vector, norm:Math.hypot(...vector)};
  });
  return {model, Tensor:ort.Tensor, entries, families:index.families||{}, categories:index.categories||{}};
}
let queue = Promise.resolve();
self.onmessage = ({data}) => {
  queue = queue.catch(()=>{}).then(async () => {
    const {id, views, signals} = data;
    try {
      ready ||= initialize().catch(error=>{ready=null;throw error;});
      const {model, Tensor, entries, families, categories} = await ready;
      self.postMessage({id,comparing:true});
      const vectors=[];
      async function embed(view) {
        const input = new Tensor('float32',new Float32Array(view),[1,3,224,224]);
        const output = await model.run({pixel_values:input});
        const vector = output.last_hidden_state.data.slice(0,384);
        for(const tensor of Object.values(output)) tensor.dispose?.();
        input.dispose?.();
        const norm = Math.hypot(...vector);
        vectors.push(Array.from(vector,x=>x/norm));
      }
      for(const view of views.slice(0,2)) await embed(view);
      function compareViews() {
        const visualScores = new Map();
        for(const entry of entries) {
          let score = -1;
          for(const vector of vectors) {
            let dot = 0;
            for(let i=0;i<384;i++) dot += vector[i]*entry.vector[i];
            score=Math.max(score,dot/entry.norm);
          }
          entry.visual=score;
          if(score>(visualScores.get(entry.main)??-1)) visualScores.set(entry.main,score);
        }
        return visualScores;
      }
      let visualScores=compareViews();
      const firstPass=[...visualScores].sort((a,b)=>b[1]-a[1]);
      const likelyShoes=firstPass.slice(0,10).filter(([file])=>categories[file]==='Shoes').length>=6;
      // A second shoe near the top usually means the full photo is ambiguous.
      // In portrait photos, compare the lower half as one more view to isolate
      // a shoe in a pair. Other searches keep the original two model passes.
      if(likelyShoes && views[2] && firstPass[0][1]>=.55 &&
         firstPass[0][1]-firstPass[1][1]<.05) {
        await embed(views[2]);
        visualScores=compareViews();
      }
      const likelyHoodie=[...visualScores].sort((a,b)=>b[1]-a[1]).slice(0,10)
        .filter(([file])=>/hoodie|hooded/i.test(file)).length>=5;
      const neutralHoodie=likelyHoodie && signals?.fabricColor &&
        Math.max(...signals.fabricColor)-Math.min(...signals.fabricColor)<=22;
      const scores = new Map();
      const bestVisual=Math.max(...visualScores.values());
      const leadingShoe=firstPass[0]?.[0];
      const shoeColorAgrees=signals?.color && entries.some(entry=>
        entry.main===leadingShoe && entry.visual>=bestVisual-.005 && entry.color &&
        Math.hypot(...entry.color.map((value,i)=>value-signals.color[i]))<25);
      const uncertainShoes=likelyShoes && bestVisual>=.44 && bestVisual<.55 && shoeColorAgrees;
      for(const entry of entries) {
        // Keep each view's appearance and color together. A matching front
        // must not borrow the color of an unrelated reverse or detail view.
        if(entry.visual<Math.max(uncertainShoes ? .42 : .55,bestVisual-.18)) continue;
        let score=entry.visual;
        if(uncertainShoes && signals?.color && entry.color) {
          // For a weak shoe match, the center of the shoe is more useful than
          // the catalog's white backdrop or a photographed shoebox.
          const distance=Math.hypot(...entry.color.map((value,i)=>value-signals.color[i]));
          score+=.13*Math.exp(-distance/50);
        } else {
          const useFabricColor=!likelyHoodie || neutralHoodie;
          const queryColor=useFabricColor?(signals?.fabricColor||signals?.color):signals?.color;
          const archiveColor=useFabricColor?(entry.fabricColor||entry.color):entry.color;
          if(queryColor && archiveColor) {
            // Compare hue/saturation more strongly than brightness: a grey
            // garment in shade should not become a blue colorway.
            const brightness=archiveColor.reduce((sum,value,i)=>sum+value-queryColor[i],0)/3;
            const distance=!useFabricColor?Math.hypot(...archiveColor.map((value,i)=>value-queryColor[i])):
              Math.hypot(...archiveColor.map((value,i)=>value-queryColor[i]-brightness),brightness*.35);
            const weight=likelyShoes ? .04 : (useFabricColor ? .16 : .3);
            score+=weight*Math.exp(-distance/(useFabricColor ? 50 : 35));
          }
        }
        if(likelyHoodie && signals?.logo==='large' && /box.logo.hoodie/i.test(entry.main)) score+=.2;
        const referenceColor=entry.fabricColor||entry.color;
        if(likelyHoodie && signals?.logo==='cross' && /cross.box.logo.hoodie/i.test(entry.main) &&
           referenceColor && Math.max(...referenceColor)-Math.min(...referenceColor)<=15 &&
           Math.min(...referenceColor)>=120) score+=.1;
        if(likelyHoodie && !neutralHoodie && signals?.logo==='small' && /small.box.*(?:zip.up.hooded|hoodie)/i.test(entry.main)) score+=.2;
        if(score>(scores.get(entry.main)??-1)) scores.set(entry.main,score);
      }
      const ranked=[...scores].map(([file,score])=>({file,score})).sort((a,b)=>b.score-a.score);
      const top=ranked[0], family=families[top?.file];
      let related;
      if(family && visualScores.get(top.file)>=.75) {
        related=ranked.slice(1).filter(match=>families[match.file]===family &&
          visualScores.get(match.file)>=visualScores.get(top.file)-.08 && match.score>=top.score-.2)
          .sort((a,b)=>visualScores.get(b.file)-visualScores.get(a.file))[0];
      }
      const results=ranked.slice(0,30);
      if(related && visualScores.get(related.file)>=visualScores.get(ranked[5]?.file)-.02) {
        const match=results.find(item=>item.file===related.file);
        if(match) match.related=true;
        else results.push({...related,related:true});
      }
      self.postMessage({id,results});
    } catch(error) { self.postMessage({id,error:String(error?.message||error)}); }
  });
};
