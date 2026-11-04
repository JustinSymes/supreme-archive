# Archive photo recognition

The Add page compares uploaded images with DINOv2 image embeddings. Recognition runs in a Web Worker on the visitor's device. The first search downloads approximately 24 MB of model weights plus the inference runtime from Hugging Face/jsDelivr; subsequent searches can use the browser cache. Uploaded photos are not sent to those services.

Main and gallery images are indexed and grouped by their main image so alternate views never create duplicate results. The browser compares both the full image and, when available, a focused crop. Exact file hashes bypass model loading. Results are suggestions, limited to six; similar releases and colours can still be difficult to distinguish.

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

Model: [Xenova/dinov2-small](https://huggingface.co/Xenova/dinov2-small), pinned to the revision in `build.mjs`. The builder and browser use Transformers.js 3.8.1, q8 weights, a white 224px square preserving image proportions, and the normalized 384-value CLS token. The stored vectors use signed 8-bit quantization and cosine similarity.

The browser prepares the model tensor on the page using DOM canvas (resize to 256, center crop to 224, RGB normalization from the pinned processor). The worker receives only a Float32 tensor and runs the model directly. Do not use `RawImage`/the image pipeline in the worker: WebKit can lack worker `OffscreenCanvas` even when page canvas works. Test with WebKit, rather than relying on a narrow Chromium viewport for mobile compatibility.

Use the plain WASM `.mjs` and `.wasm` files from the exact ONNX Runtime version bundled with Transformers.js. The worker pins these paths explicitly: the default JSEP build has a [known Safari memory issue](https://github.com/microsoft/onnxruntime/issues/26827). Keep `numThreads: 1`. Query tensors are disposed after inference; full-resolution upload previews are reduced before loading the model; failed workers are terminated so retries start with a fresh runtime. Model weights and the archive embeddings are unchanged by this runtime choice.
