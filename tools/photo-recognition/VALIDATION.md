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

## Plain-margin foreground crop (2026-11-12)

Placed existing real item photos at the edges of a 1400px white test canvas to simulate uploads with large plain margins. The full image remains the first model view. A focused second view replaces the fixed center crop only when four small corner samples agree on a uniform background and the foreground occupies a smaller or displaced region. Color samples come from that same focused area. The model and number of inference passes are unchanged.

| Framed photo | Before | After in Chromium and desktop WebKit |
| --- | --- | --- |
| User's grey Kate Moss tee at upper left | White tees first | Grey Kate Moss first |
| Seller's grey Kate Moss tee at lower right | White tees first | Grey Kate Moss first |
| Grey Cross Box Logo Hoodie seller photo at lower right | Other hoodies first | Grey Cross Box Logo Hoodie first |
| Brown Air Force 1 seller photo at lower right | No match | No match in Chromium; Brown Air Force 1 in WebKit |
| Snow Camo Air Force 1 seller photo at upper left | No match | No match |

The original unframed Kate Moss, Cross Box Logo, Snow Camo, Brown Air Force 1, Adidas Samba, and red camera photos kept their result order in both browsers. A framed red camera icon still gives false sticker suggestions, as it did before. These altered photos test framing robustness, not general recognition accuracy or iPhone memory behavior.

## Colored hoodie photos (2026-11-16)

Compared the previous worker with the updated worker using seven held out uploads through the Add page in Chromium and desktop WebKit at 390px. The user's purple Small Box Zip Up photo moved from second to first in both browsers; the black hoodie with a similar shape moved below it. Both grey Kate Moss tee photos and the rust Box Logo Hoodie stayed first. The black CDG Air Force 1 photo kept its target fifth, the unrelated red camera still returned no match, and the exact archive shoe image still returned only its own item. The worker now reduces neutral colorway scores slightly when a hoodie photo's center and lower fabric samples both show the same strong color. A unit test checks that colorful chest artwork does not trigger this adjustment. This small set does not measure overall recognition accuracy or iPhone memory behavior.

## General foreground segmentation (2026-11-17)

Added U2-NetP segmentation, exposure normalization for its input, background masking, and a crop made from the higher resolution photo preview. The segmentation stage has no item or category rules. Its view is selected using visual similarity before color ranking, with the original views retained when the mask fails or does not provide sufficient evidence.

Created three stress fixtures from held out real photos: resized inside a 1000px textured brown canvas, placed off center, darkened to 70% brightness, and JPEG compressed. These are controlled alterations, not new natural photographs. No evaluation photo or alteration was added to the index.

| Stress fixture | Previous Chromium | Updated Chromium | Updated desktop WebKit |
| --- | --- | --- | --- |
| Grey Kate Moss tee | Exact item absent | Exact item second | Exact item second |
| Purple Small Box Zip Up | Exact item absent | Exact item fifth | Exact item sixth |
| Snow Camo Air Force 1 | No match | No match | No match |

The seven original uploads were also checked in both browsers at 390px: both grey tees, rust hoodie and purple hoodie still lead their results; the CDG shoe remains within six suggestions; the unrelated red camera remains rejected; and the exact archive image returns only itself. Similar-looking shoe results and color under dark lighting remain limitations. These checks are a small regression set, not a general accuracy estimate.

Measured full searches after the first load took approximately 3.6–4.4 seconds in Chromium and 4.5–6.2 seconds in desktop WebKit while both suites ran on the same machine. First searches took 7.4–9.6 seconds. Exact-file shortcuts took under 100ms. The model adds about 4.6 MB and its inference session is released after each segmentation attempt. Desktop WebKit does not establish iPhone memory or speed limits. Automated tests cover mask bounds, rejection of uniform masks, release after inference failure, and the existing ranking regressions.

## Exposure-aware foreground colors (2026-11-17)

Compared color ranking against the segmentation release using the same three controlled stress fixtures and seven original uploads in Chromium and desktop WebKit. The darkened, off-center grey tee moves from second to first in both browsers. The darkened purple item's exact match moves from fifth in Chromium/sixth in WebKit to second in both. The small shoe fixture still returns no match. No test image was added to the recognition index.

The original tee and hoodie photos retain their leading matches, the CDG shoe remains in the suggestions, the red camera is rejected, and exact-file matching still works. Six additional Chromium uploads checked the grey Cross Box Logo hoodie, brown and snow-camo shoes, red and black mophie accessories, and an unrelated Adidas Samba photo. Their suggestion lists were unchanged. The Adidas false positives remain a known limitation.

Exposure compensation applies only to small, adopted foreground crops with agreeing color samples; it excludes deep shadows, dark neutral colors, and bright samples. It uses no item names or category rules and adds no inference passes or downloads. Tests include generic colors at several exposure levels, shaded neutrals, and preservation of the original ranking for large foregrounds and dark neutral crops. This limited set does not establish broad real-world accuracy or color constancy under tinted lighting.

## Complete-photo segmentation retry (2026-11-18)

The initial segmentation view inherits DINO's enlarged center crop, which can clip an off-center item. The search now tries an independent 320px view of the complete photo when the first mask approaches a frame edge or visual similarity remains below .8. A retry must improve visual similarity by more than .04 to replace the current crop and its color signals. This uses the existing models without item names or category rules. Failed or marginal retries preserve the selected results, and inference inputs are released on failure.

Checked 16 uploads in Chromium and desktop WebKit at a 390px viewport: seven original uploads from the earlier regression set, three existing stress fixtures, and six new edge-positioned variants of the held out tee, hoodie, and snow-camo shoe photos. The new variants are resized, darkened and JPEG-compressed on a textured canvas; they are controlled framing tests, not new natural photos. None were added to the index.

The left-edge purple Small Box Zip Up fixture previously omitted the exact FW24 item from all six suggestions in both browsers. It now includes it second in both. The other five edge fixtures retain their previous exact-item positions: both tees lead, the left shoe matches, and the right shoe matches in Chromium but remains absent in WebKit. The right-edge hoodie remains absent in Chromium and second in WebKit. The three existing stress fixtures retain their outcomes, including the unresolved small shoe. Original tees and hoodies still lead, the CDG shoe stays within six suggestions, the unrelated red camera is rejected, and exact-file matching returns only its own item. WebKit item selection and size options also passed.

Twenty automated tests pass, including coordinate-system preservation, recovery from a stronger alternate crop, rejection of a marginal retry, segmentation/embedding failure fallback, resource cleanup, and skipping the retry for strong interior crops. A qualifying search adds one segmentation pass and up to one recognition pass, so difficult photos can take longer. Desktop WebKit does not establish iPhone memory or speed behavior, and this small set does not establish overall recognition accuracy.
