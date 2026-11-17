# Archive photo recognition

The Add page compares uploaded images with DINOv2 image embeddings. Recognition runs in a Web Worker on the visitor's device. The first search downloads approximately 24 MB of model weights plus the inference runtime from Hugging Face/jsDelivr; subsequent searches can use the browser cache. Uploaded photos are not sent to those services.

Main and gallery images are indexed and grouped by their main image so alternate views never create duplicate results. The browser compares the full image and a central crop. When a small or off-center item sits inside a uniform margin, the second view focuses on the foreground and color is sampled from that crop. The builder and browser share `photo-color.js`, sampling both lower torso sides to reduce interference from chest artwork. Color provides a bounded bonus only to close visual candidates. Each gallery view keeps its own visual score and color together before results are grouped. A clear blue box logo or small red chest logo helps distinguish similar hoodies. Exact file hashes bypass model loading. Results are suggestions, limited to six; similar releases and colours can still be difficult to distinguish.

The worker ranks only the main images present in the currently loaded spreadsheet. A newly rebuilt index can contain photos for rows that are not live yet; those photos must not raise the visual threshold or hide an available match.

Photo search also runs U2-NetP salient object segmentation, a category-independent model served from `models/u2netp.onnx` (about 4.6 MB). Its mask removes the background and bounds a crop of the retained photo preview. The page samples colors and logos again from that crop and prepares another DINOv2 view. The crop replaces the original views only when its strongest visual score improves by more than .04, or when it removes a large margin and retains the original visual score within .01. This decision uses visual evidence before color bonuses. There are no item names or category rules in the segmentation stage. It adds a segmentation pass and, for usable masks, a recognition pass; the segmentation session and tensors are released after each attempt. Model failure or an uncertain mask falls back to the original search. Photos stay on the device. Exact-file matches bypass both models.

The segmentation network normalizes exposure by the brightest input channel, following its reference preprocessing. It does not reliably recover an item's true color from strongly tinted lighting. Masks can also miss small objects or merge nearby objects; the original views remain the fallback. See `models/README.md` for model provenance and license, and `foreground.test.cjs` for mask and resource cleanup checks.

Adopted foreground crops also support exposure-aware color comparison. When both crop dimensions are below 75% of the model frame, the center and lower fabric samples agree within 25 RGB units, and the selected sample's mean brightness is 50–120 (80–120 for neutral colors), `photo-color-distance.js` compares colors at a common brightness while retaining a smaller brightness penalty. Gain is capped for near-black reference samples. Other photos keep the previous distance. This applies across categories, adds no model passes, and helps shaded colors avoid being displaced by unrelated dark colorways. It does not estimate or correct arbitrary colored lighting.

For a light neutral hoodie photo, the page also checks whether a connected red chest graphic has the proportions of a cross. A matching light neutral Cross Box Logo Hoodie receives a small ranking bonus only after it passes the normal visual threshold. This shape check runs on the existing 224px canvas and adds no model inference pass or model memory.

For a visibly colored hoodie, the ranking slightly reduces neutral colorway scores when center and lower fabric samples agree in color. This helps a dark purple hoodie photo stay with the purple item instead of a black version with a slightly stronger shape match. It does not apply when chest artwork supplies the color or to shoes and other categories.

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
