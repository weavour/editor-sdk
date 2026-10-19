# Releases

The repository's Test workflow runs on every push and pull request, with no path
or branch filters. It has read-only repository permission and no deployment
credentials. Package jobs cover Node 22/24 and React 18/19; browser jobs cover
Chromium/Firefox/WebKit at desktop/mobile widths. Public tests use mock services.

For the first npm release, an owner must control the `@weavour` npm scope and
bootstrap both public packages using npm's interactive authentication. Configure
trusted publishers for `weavour/editor-sdk`, workflow `release.yml`, on both npm
package settings. Scope ownership cannot be inferred from package-name availability.
Subsequent tag releases use OIDC, not a stored npm token. With npm 11.15+, configure
each package using `npm trust github <package> --file release.yml
--repo weavour/editor-sdk --allow-publish --yes` (the command can require a browser
2FA check). Then run Release manually with the existing version tag to verify
OIDC exchange even when both packages were already bootstrapped. This validates
the trust relationship without publishing another package version. The workflow
never persists or prints the exchanged credentials.

1. Run `npm ci`, `npm run verify`, and `npm run test:browser`.
2. Run `npm run version:sdk -- 0.1.1` (substitute the next version, without `v`).
   This updates both package versions, React's exact core dependency and all
   lockfiles; it does not create a commit or tag. Update the changelog and verify
   compatibility with the hosted iframe. A Git tag alone never bumps npm versions.
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
