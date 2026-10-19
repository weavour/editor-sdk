# Contributing

Use Node 22.12+ and npm. Run `npm ci`, `npm run verify`, then
`npx playwright install chromium firefox webkit` and `npm run test:browser`.
These checks require no private checkout, credentials or Weavour account.

Keep framework wrappers thin. Add regression coverage for lifecycle, messaging
or public contract changes. Never send credentials, real user data or private
hosted-editor code in issues, examples or pull requests. Follow existing
TypeScript conventions and update API docs/changelog when behavior changes.

Open pull requests against main. Contributions use the repository's MIT license.
