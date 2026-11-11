# Archive photo recognition

The Add page compares uploaded images with DINOv2 image embeddings. Recognition runs in a Web Worker on the visitor's device. The first search downloads approximately 24 MB of model weights plus the inference runtime from Hugging Face/jsDelivr; subsequent searches can use the browser cache. Uploaded photos are not sent to those services.

Main and gallery images are indexed and grouped by their main image so alternate views never create duplicate results. The browser compares the full image and a central crop. The builder and browser share `photo-color.js`, sampling both lower torso sides to reduce interference from chest artwork. Color provides a bounded bonus only to close visual candidates. Each gallery view keeps its own visual score and color together before results are grouped. A clear blue box logo or small red chest logo helps distinguish similar hoodies. Exact file hashes bypass model loading. Results are suggestions, limited to six; similar releases and colours can still be difficult to distinguish.

For a light neutral hoodie photo, the page also checks whether a connected red chest graphic has the proportions of a cross. A matching light neutral Cross Box Logo Hoodie receives a small ranking bonus only after it passes the normal visual threshold. This shape check runs on the existing 224px canvas and adds no model inference pass or model memory.

The index records `colorVersion: 3`: `c` retains the center color used for hoodie/logo matching; `f` records the lower torso fabric color. The existing visual vote identifies likely hoodies and preserves their established color weighting. Other items use the fabric descriptor, a smaller bonus, and a color distance that tolerates lighting changes. Updating the color samplers requires invalidating cached colors in the builder and rebuilding the complete index; existing model embeddings can still be reused. Browser script and index query versions should change together when the sampling convention changes.

Run `node --test ranking.test.cjs` here for the gallery-view, unrelated-item, and printed-fabric regression checks. Real-photo browser checks are documented in `VALIDATION.md`.

When the top result belongs to a colorway family in the spreadsheet, the results can reserve one slot for another color of that same design. The alternate must still have a close visual embedding and overall score; this keeps related colorways visible when camera lighting changes the apparent fabric color.

When a spreadsheet filename is missing, the builder checks for the exact season suffix present in the item name. Verified replacements are recorded in the index and used for the photo result and saved item. Other missing files are reported for correction in the source archive.

## Refresh after adding or changing archive images

Requires Node.js 22 or newer. From this directory:

```sh
npm ci
node build.mjs
```

The builder reads the live archive CSV. To use a downloaded CSV, pass its path. It reuses embeddings for unchanged file hashes, prints skipped/missing files, and writes `../../photo-embeddings.json`. Let the build finish before committing the generated index. Review skipped files, since a missing file cannot be searched. Commit the updated index alongside item changes.

```sh
node evaluate.mjs
```

This checks retrieval for 20 evenly sampled main images after rotation, background changes, brightness changes, and JPEG compression. It compares top-six retrieval with the previous pixel index. It is a synthetic regression check, not an accuracy estimate for customers' photos. Separately test real photographs, screenshots, an unrelated image, and selecting a match/size in the Add page.

Model: [Xenova/dinov2-small](https://huggingface.co/Xenova/dinov2-small), pinned to the revision in `build.mjs`. The builder uses Transformers.js 3.8.1; the browser runs the identical q8 ONNX weights directly with ONNX Runtime Web. Both use a white 224px square preserving image proportions and the normalized 384-value CLS token. The stored vectors use signed 8-bit quantization and cosine similarity.

The browser prepares the model tensor on the page using DOM canvas (resize to 256, center crop to 224, RGB normalization from the pinned processor). The worker receives only a Float32 tensor and runs the model directly. Do not use `RawImage`/the image pipeline in the worker: WebKit can lack worker `OffscreenCanvas` even when page canvas works. Test with WebKit, rather than relying on a narrow Chromium viewport for mobile compatibility.

The browser pins ONNX Runtime Web **1.17.3**, using its WASM-only JavaScript bundle and matching non-threaded `ort-wasm-simd.wasm` (or non-SIMD binary when required). Keep `numThreads: 1`. The newer runtime previously loaded a threaded binary even with one thread; its default JSEP build also has a [known Safari memory issue](https://github.com/microsoft/onnxruntime/issues/26827). Using the standalone runtime avoids loading Transformers.js and its additional backends in the browser. All devices use the same runtime, model weights, preprocessing, archive embeddings, thresholds, and ranking. There is no lower-quality pixel-matching fallback.

The session fixes the input dimensions to 1×3×224×224 and disables CPU memory arenas and memory patterns. Full-resolution upload previews are reduced before loading the model. The worker is reused during an open search to avoid repeated compilation, then terminated when a result is selected, photo search is closed, or an idle page is hidden. Failed workers are also terminated so retries start with a fresh runtime. Browser download caching can reuse the model files.

When changing the runtime, compare ranked results and scores with the previous desktop worker using identical images. Test both WebKit and Chromium, repeated uploads, an unrelated image, exact archive images, and selecting a match/size. A desktop WebKit test is useful for compatibility checks but does not reproduce an actual iPhone's memory limit; verify on hardware before claiming support for every phone.
