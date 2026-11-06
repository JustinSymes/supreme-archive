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
