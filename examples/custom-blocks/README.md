# Customer-defined blocks

Replace the public editor key and supplied namespace IDs in `vanilla.html`.
Serve it over HTTP on an allowed application origin. The pinned SDK and hosted
iframe must both support custom blocks; no release or deployment is performed
by this example. Save complete envelopes and reopen with `emailDocument`.

`react-email.tsx` is customer application code, with customer-owned React,
`@react-email/components` and `@react-email/render`. Tested with React 19.3.1,
components 1.0.12 and render 2.2.0. Section, Row, Column, Text, Button and Img
produce supported fragments. The render library adds a doctype to fragments;
remove that doctype only. Do not strip Html/Head/Body wrappers from a complete
email or silently remove unsupported CSS. Return a standalone body fragment.

Bump the definition version when behavior/defaults/controls change; register
old versions while older emails need field editing. Resolve external product
data into saved JSON props for reproducible exports. Renderers must finish
promptly and avoid side effects. A five-second timeout cannot interrupt
synchronous host JavaScript. Missing renderers retain valid saved output.
