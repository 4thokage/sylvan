# Scanner and Life Counter Features Are Removed

The card scanner (camera + OCR via tesseract.js) and the life counter tool have been removed from the codebase and navigation. They were experimental features that pulled in large client-side dependencies, had no backend model, and were not tied to the core wishlist/collection/trade workflow.

Removing them means:

- `src/lib/scanner/`, `src/routes/scan/`, `ScannerView.svelte`, and the tesseract dependency are gone.
- `src/routes/tools/life/` is gone.
- No data migration is needed because neither feature wrote to the database.

The trade-off is losing two convenience utilities. The benefit is a smaller bundle, fewer runtime dependencies, less maintenance surface, and a clearer product focus on collection, wishlists, and trades. Re-adding either feature later should be a deliberate product decision with its own design and ADR.

This decision is recorded so a future reader does not reintroduce them as "missing" features without considering the dependency and UX cost.
