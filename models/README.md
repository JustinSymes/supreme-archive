# Photo foreground model

`u2netp.onnx` is the small U2-NetP salient object segmentation model by Xuebin Qin and collaborators. Source: https://github.com/xuebinqin/U-2-Net (Apache 2.0; see U2Net-LICENSE).

ONNX distribution: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx

Verified MD5: `8e83ca70e441ab06c318d82300c84806`, matching the rembg U2netpSession download checksum. The model is served locally with the site, approximately 4.6 MB. Input normalization and mask normalization follow https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2netp.py and its BaseSession. Browser resizing uses nearest sampling for the segmentation input; the original resolution photo supplies the final masked crop.
