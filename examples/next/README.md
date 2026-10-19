# Next.js example

Run `npm ci && npm run build` at the repository root, then `npm install` in this
directory. Set `NEXT_PUBLIC_EDITOR_KEY` to your public editor key, configure the
allowed localhost origin, and run `npm run dev`. This example uses locally built
file packages; production integrations install `@weavour/react` from npm.
`npm run build` verifies the server/client boundary without mounting on the server.
The key is public. Never use NEXT_PUBLIC variables for administrative secrets.
