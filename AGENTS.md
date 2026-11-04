# Supreme Archive workflow rules

## Completing item additions

- After each requested item addition is finished and the relevant checks pass, commit the task's files and push to `origin main` automatically. The user has authorized this as the default workflow; do not ask for confirmation again unless they change this instruction.
- Stage only files belonging to the completed task and requested workflow updates. Preserve unrelated local changes and helper files.
- Report the commit and push result, and clearly identify any separate spreadsheet update still required.
- When adding or renaming an item's main image, refresh `photo-index.json` so photo search can find it. The index is built from the Google Sheet's main image references.
- Also refresh `photo-embeddings.json` after adding or changing main/gallery images: run `node tools/photo-recognition/build.mjs` (install dependencies in `tools/photo-recognition` with `npm ci` first). Let the builder finish and review missing-image warnings before publishing. See `tools/photo-recognition/README.md`.

## Repeat releases and season prefixes

- Before adding any item, check whether Supreme released the same item in an earlier season. Check reliable release sources as well as the existing archive; absence from the archive alone does not establish that an item is new.
- If the item or a closely related name was released in a previous season, add the current season marker at the end of the item name, after the product name (for example, `Black Stripe Polo FW26`). Put the season marker at the end of the image filename before its extension (for example, `black_stripe_polo_fw26.png`). Keep the item entry and image references consistent.
- Do not guess the release history; flag uncertainty if the available sources do not establish whether it is a repeat release.

## Shoe additions

- Before publishing any item in the `Shoes` category, compare its visible shoe bounds with representative existing shoe assets; do not judge scale from canvas dimensions alone.
- Verify the shoe in Build a Fit at both desktop width and mobile width (600 px or narrower).
- The visible shoe should be approximately the same perceived size as the other shoes in the corresponding Build-a-Fit shoe slot on both layouts.
- Prefer a tightly cropped transparent asset with minimal empty padding. Preserve the complete product and its natural proportions.
- If the source canvas or required padding still makes the shoe render too small, add or update a narrowly targeted Build-a-Fit sizing class for that shoe family. Do not enlarge unrelated shoes.
- Check every requested main/alternate shoe image for consistent positioning, but use the row's first/main image when validating Build-a-Fit scale.
- Do not finish or publish a shoe addition until desktop and mobile sizing have both been checked.
