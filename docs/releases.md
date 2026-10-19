# Releases

The repository's Test workflow runs on every push and pull request, with no path
or branch filters. It has read-only repository permission and no deployment
credentials. Package jobs cover Node 22/24 and React 18/19; browser jobs cover
Chromium/Firefox/WebKit at desktop/mobile widths. Public tests use mock services.

For the first npm release, an owner must control the `@weavour` npm scope and
bootstrap both public packages using npm's interactive authentication. Configure
trusted publishers for `weavour/editor-sdk`, workflow `release.yml`, on both npm
package settings. Scope ownership cannot be inferred from package-name availability.
Subsequent tag releases use OIDC, not a stored npm token.

1. Run `npm ci`, `npm run verify`, and `npm run test:browser`.
2. Update both package versions and React's exact core dependency together, update
   the changelog and lockfile, and verify compatibility with the hosted iframe.
3. Commit and tag `v<version>`; push the commit and tag. The release workflow runs
   the Test workflow before publishing both packages with provenance. Versions
   must match the tag. Already-published bootstrap packages are skipped only when
   their registry integrity matches the current build. Tags are immutable and
   never reused to fix a release. The trusted tag workflow also creates the GitHub
   release with public package archives; reruns preserve existing release assets.
4. In the private repository, pin the published version and run private integration
   checks for drafts, templates, uploads, AI, timers, demo and dashboard previews.
5. Deploy additive iframe support before enabling a new SDK. Promote `/editor.js`
   deliberately and retain previous immutable version files and integrity hashes.

Public CI cannot deploy the hosted editor. Rollback changes the private package
pin/compatibility alias; do not overwrite npm versions or immutable script files.
No staging environment is introduced. Private code and Cloudflare credentials
must never be copied to this repository or public package tarballs.
