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
