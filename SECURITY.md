# Security reports

Report vulnerabilities privately to hello@weavour.com with reproduction steps and
the affected SDK version. Do not post credentials or customer documents in issues.

The SDK checks iframe origins/windows, validates bounded wire messages and pins
hosted requests to the mounted scope. Declarative user/organization IDs are not
an authentication boundary. See docs/security.md for integration requirements.
