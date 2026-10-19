# Script-tag example

Run `npm ci && npm run build` at the repository root. Replace the public key in
index.html and allow `http://127.0.0.1:5197` in that editor's settings. Run
`node tests/server.mjs` from the root and open
http://127.0.0.1:5197/examples/vanilla/index.html.
This HTTP-served example loads the locally built classic SDK and the hosted
iframe. For the local private editor stack, set editorUrl/apiUrl explicitly.
Use a matching hosted iframe with application-ready support. Your own release
can serve a pinned copy of dist/editor.js; SDK source is MIT licensed.
