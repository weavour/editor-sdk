# React example

From the repository root, run `npm ci && npm run build`. Then in this directory:
`npm install` and `VITE_EDITOR_KEY=your_public_key npm run dev`. Allow the shown
origin in your editor settings. This example uses the locally built packages via
file dependencies; published integrations use `npm install @weavour/react`.
Optional `VITE_EDITOR_URL` and `VITE_API_URL` select the local private editor stack.
These are public browser settings, never credentials. Run `npm run build` to
verify production bundling. Your application handles persistence and sending.
