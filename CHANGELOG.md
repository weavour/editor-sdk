# Changelog

## 0.1.11 (2026-10-31)

- Add optional `iconSvg` custom block metadata with bounded static SVG validation and theme-aware paints.
- Document automatic hosted palette outlines, default-prop renderer calls, caching and fallback behavior.
- Add framework-independent custom block definitions, typed controls and `defineCustomBlock()` inference.
- Keep renderer callbacks in instance-local registries; negotiate custom-block support before sending definitions or schema-3 content.
- Fence asynchronous render replies by session, node, registry and props generation; bound concurrency, queues and timeouts and clean up on destroy.
- Preserve schema-3 JSON props and validated snapshots; export a shared strict fragment policy and typed HTML transformation helpers.
- Support live registrations in JavaScript and React without remounting; advertise schema-3 support for hosted document transport guards.

## 0.1.9 (2026-10-26)

- Retry the 0.1.8 npm release with bounded browser dependency downloads and a replacement Ubuntu package mirror. SDK behavior is unchanged from 0.1.8.

## 0.1.8 (2026-10-26)

- Remove the AI billing-origin setting. Embedded requests use the host origin automatically; local AI coverage is resolved by the service from the editor configuration.

- Add live `mode` configuration for read-only editing and desktop/mobile preview surfaces across JavaScript and React integrations.


## 0.1.6 (unreleased)

- Add named display-condition configuration, validation and live React props.
- Preserve schema-version-2 conditional documents and negotiate iframe support.
- Extend export/test-email result types with condition manifests and evaluation signals.
- Validate live configuration patches before mutating retained options.

## 0.1.5

- Add `enableTestEmail` to mount options, editor defaults and live configuration to hide the hosted toolbar test button.
- Forward the React prop without remounting; keep host-owned export and delivery flows available.

## 0.1.4

- Add `enableOrganizationBlocks` to mount options, editor defaults and live configuration, including React prop updates without remounting.
- Reject organization-block transport when locally disabled; the hosted service remains authoritative for saved restrictions.

## 0.1.3

- Forward scoped organization-block operations through the hosted library transport, independently of template availability. Advertise support to the hosted editor; retain origin/session checks and mount-owned organization/user namespaces.

## 0.1.2

- Add `enableEmailAudit` to mount options, editor defaults and live configuration.
- Forward React email-audit prop changes without remounting the editor.
- Preserve audit preference updates made while the iframe is initializing.

## 0.1.1

- Update package documentation.
- Add coordinated version preparation and actionable release-tag validation.

## 0.1.0

- Extract the framework-neutral Weavour embedding core into an MIT-licensed package.
- Generate ESM, declarations and classic bundles from one TypeScript implementation.
- Add a React wrapper with live configuration, SSR-safe imports and Strict Mode cleanup.
- Add full email-envelope input, application readiness, typed errors and session fencing.
- Preserve export, template preview, draft flush/status and hosted-feature bridges.
- Add push/PR CI for Node 22/24, React 18/19 and three browser engines.
