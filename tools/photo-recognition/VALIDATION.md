# Fabric color ranking checks

Compared the production ranking at commit `8d6b974` with the new ranking through the Add page. Tests uploaded photos, bypassing the exact-file shortcut except for the explicitly labeled archive-file test. Photos were kept outside the repository and were not added to the recognition index.

| Photo | Previous Chromium result | Updated Chromium result |
| --- | --- | --- |
| User's grey Kate Moss tee on a wooden floor | Correct color second; blue first | Grey first |
| [Seller's grey Kate Moss tee on a hanger](https://www.grailed.com/listings/5301009-supreme-kate-moss-photo-tee-medium-grey) | Correct color third; red first | Grey first |
| User's rust box-logo hoodie on a colored background | Correct item first | Correct item first |
| User's purple small-box facemask hoodie on carpet | Correct item sixth | Correct item sixth |
| [Seller's black CDG Air Force 1s on a shoebox](https://www.grailed.com/listings/64091530-comme-des-garcons-x-nike-x-supreme-split-air-force-1-low-black-2018-cdg-x-supreme) | Correct item absent | Correct item absent |
| Unrelated red camera icon | No match | No match |
| Exact white CDG Air Force 1 archive PNG | Exact item only | Exact item only |

Repeated updated checks in desktop WebKit at a 390px viewport. Both grey tees and the rust hoodie were first, the purple hoodie remained in the suggestions, the unrelated image was rejected, and the exact-file shortcut worked. The CDG shoe appeared sixth in WebKit but was absent in Chromium; browser rasterization can affect close rankings. This is a small regression set, not an overall accuracy estimate. Desktop WebKit does not reproduce an actual iPhone's memory limit.

The runtime, model, number of inference passes, and worker disposal behavior were unchanged. Three automated regression tests cover visual/color pairing per gallery view, rejection of visually unrelated items, and keeping central print colors out of the fabric sample.

## Neutral hoodie lighting check (2026-11-06)

The [seller's grey Cross Box Logo Hoodie](https://www.grailed.com/listings/34744456-supreme-supreme-cross-box-logo-heather-grey-hoodie) and a crop of the user's screenshot were tested in Chromium and WebKit at mobile width. Before the change, the seller photo omitted the exact item from six suggestions in Chromium, and the screenshot crop ranked an olive hoodie first. After the change, the seller photo includes the exact item fourth in both browsers; the screenshot crop ranks it first in Chromium and fifth in WebKit. Grey Kate Moss photos stay first; rust and purple hoodie photos retain their prior results; the unrelated red camera remains rejected; an exact archive PNG still returns only its own item. The screenshot crop is small and compressed, so its rankings do not measure performance on the original full-resolution photo.

Neutral hoodie photos now use the lower fabric sample with brightness-tolerant color matching. Saturated hoodie photos keep the previous center sample and weighting. The small chest logo bonus is disabled for neutral hoodie photos because the cross design produced a false small-logo signal in the screenshot crop. The model and inference passes are unchanged, so this adjustment adds no model memory use. Four automated ranking tests pass.

## Shoe photo check (2026-11-10)

Added category labels to the photo index and compared seller photos through the Add page in Chromium and WebKit at a 390px viewport. Portrait shoe photos with a close first and second visual match now compare the lower part of the photo as a third view; other photos keep two model passes. A weak shoe match can pass the existing display threshold when its leading archive view also agrees with the photo's center color. The DINOv2 model and weights are unchanged.

| Photo | Previous Chromium | Updated Chromium | Updated WebKit |
| --- | --- | --- | --- |
| [White CDG Air Force 1 seller pair](https://www.grailed.com/listings/36618416-comme-des-garcons-x-nike-x-supreme-supreme-cdg-air-force-1-low-eyes-white-low-2017-cdg-eyes) | Correct item second | First | Second |
| [Brown Air Force 1 seller pair](https://www.grailed.com/listings/95555039-nike-x-supreme-supreme-x-nike-air-force-1-low) | No match | Correct item only | Correct item only |
| [Snow Camo Air Force 1 seller pair](https://www.grailed.com/listings/110556364-nike-x-supreme-supreme-air-force-1-low-snow-camo-size-us-9-5) | Correct item only | Correct item only | Correct item only |
| [Wheat Air Force 1 seller shoe](https://www.grailed.com/listings/76569423-nike-x-supreme-nike-air-force-1-low-supreme-wheat) | Correct item first | First | First |
| [Black CDG Air Force 1 seller pair](https://www.grailed.com/listings/64091530-comme-des-garcons-x-nike-x-supreme-split-air-force-1-low-black-2018-cdg-x-supreme) | Correct item fifth | Fifth | Fifth |

Both grey Kate Moss photos and the rust hoodie still rank first. The purple hoodie stays in the suggestions, an unrelated red camera is rejected, and an exact archive image still resolves to one item. The [Adidas Samba seller photo](https://www.grailed.com/listings/105460452-adidas-adidas-samba-og-white-black-gum-men-s-us-5-5-women-s-us-7) and a plain Nike Air Force 1 photo still produce false shoe suggestions, as they did before this update. These are a limited regression set; desktop WebKit does not reproduce an iPhone's memory limits. Five ranking tests pass.

## Related colorway order (2026-11-11)

The matcher already marked one visually close colorway of the leading item as related, but the Add page moved it near the top only when it was outside the first six suggestions. It now also moves an existing related **Top** into second place. The original leading match stays first, and the list still contains at most six items. Shoe results keep their previous order because visually similar Air Force 1 releases can be different designs.

In a Chromium check with the user's grey Kate Moss tee photo, Grey Kate Moss stayed first and a Kate Moss colorway moved from sixth to second. In desktop WebKit at a 390px viewport, Grey stayed first and Blue Kate Moss moved from fourth to second. The seller's grey Kate Moss photo already had another Kate Moss colorway second and was unchanged. The other real-photo checks kept their Chromium suggestion order: five seller shoe photos, the rust and purple hoodies, the unrelated red camera, and the exact archive image. The two unrelated shoe photos still produce false suggestions. The model, index, and number of inference passes are unchanged. Desktop WebKit is not a substitute for testing on an iPhone.

## Red cross logo ranking (2026-11-11)

The [grey Cross Box Logo Hoodie seller photo](https://www.grailed.com/listings/34744456-supreme-supreme-cross-box-logo-heather-grey-hoodie) ranked the exact hoodie fourth in both Chromium and desktop WebKit at 390px before this change; it ranks first in both after. A small crop of the user's earlier screenshot remained first in Chromium and moved from fifth to first in WebKit. The change detects a connected red cross on light neutral fabric and gives the matching light neutral archive hoodie a bounded bonus after the usual visual filter. This avoids boosting other Cross Box Logo colors that have different colored logos.

The grey Kate Moss photos, black CDG Air Force 1 photo, rust and purple hoodie photos, unrelated red camera, and exact archive image kept their prior suggestion order in both browsers. An archive scan of 342 hoodie and hooded main images found nine red cross-shaped regions; the added neutral-fabric checks isolate the grey Cross Box Logo Hoodie among those images. This is a targeted ranking improvement, not an overall recognition accuracy estimate. The model and inference passes are unchanged; desktop WebKit does not reproduce an iPhone's memory limit.
