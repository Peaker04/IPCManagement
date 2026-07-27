# Generated API contracts

`openapi.json` is exported from the backend's Swashbuckle metadata and
`schema.ts` is generated from that document. Do not edit either file by hand.

Run `npm run gen:api` from the repository root after changing a controller or
DTO. CI runs `npm run check:api-contract` and fails when the checked-in files
are stale.

These files are the generated wire-contract baseline. Existing handwritten
frontend types remain in place until the feature-by-feature migration step.
