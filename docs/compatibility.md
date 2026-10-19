# Compatibility and migration

SDK package version, iframe protocol and email document schema are independent.
SDK 0.1 uses wire version 1 and email envelope schema 1. Both npm packages use
coordinated versions initially. Version 0.x is the integration preview; GA follows
private hosted-editor regression checks and rollout.

New SDKs require application-ready/session support in the hosted iframe. They
fail with `incompatible_editor` against an older iframe. Deploy additive iframe
support first. The private host can continue serving the generated `legacy.js`
compatibility entry at `/editor.js` during migration: its `onReady` retains the
configuration-handshake timing. New `editor.js` and npm clients use the same
application-ready core. Do not point a production alias at the new entry before
its iframe is deployed and tested.

Existing `Weavour.mount`, callbacks, export, template preview and flush remain.
Prefer full-envelope persistence via `emailDocument` and `onDocumentChange`;
raw content/subject/preheader options and `onChange` remain available. Reject
ambiguous full-envelope/raw input and draft/initial-content combinations in the new API. The legacy bundle ignores fallback initial content when a draft ID is supplied, preserving saved-draft precedence.

React identity and initial-content props are mount-only. Preserve work, then use
a new React key to replace an editor. Themes and locales update live. Removing a
test-email callback while mounted rejects subsequent delivery requests; adding
one after an unavailable initial mount requires remounting to enable the action.

Support policy: throughout 0.x, retain wire-v1 legacy compatibility and publish
migration notes for breaking SDK updates. From 1.0, support the current SDK major
and the prior major for at least 12 months after its successor's release. The
hosted iframe must test against retained SDK fixtures; announce removals in
release notes. A pinned script fixes SDK bytes, not the hosted service version.

The proposed hosted versioned path is `/editor/sdk/<version>/editor.js`. It is
available only after the private distribution release. Do not promise the path
exists merely because the npm package or GitHub repository was published.
