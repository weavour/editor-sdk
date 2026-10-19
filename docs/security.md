# Origins, CSP and scope

Allow the actual embedding application origin in the editor settings. Browser
API requests run in the host page, preserving that Origin, and embedded requests
omit dashboard cookies. The SDK never sends identity in iframe URLs; only
`parentOrigin` is present. Messages require the exact iframe origin/window and
new SDKs additionally validate the negotiated session identifier.

Configure host CSP `frame-src` for `https://weavour.com` and `connect-src` for
`https://api.weavour.com`. Script-tag integrations also need the chosen SDK
origin in `script-src`. Your own host delivery integration may need additional
connect destinations. The iframe's own CSP controls its images and direct uploads;
R2 upload CORS must allow its actual uploader origin. Local development must
explicitly allow its loopback frame/API origins. The SDK cannot relax host CSP.

Public editor keys and supplied namespaces are not secrets. Same IDs within one
customer workspace share access. Origin restrictions do not verify the claimed
end user. Different customer workspaces remain server-scoped, including when IDs
and domains match. Never embed administrative sessions or provider keys in
configuration. API/iframe overrides must use HTTPS except explicit loopback.

Only use integrity hashes with immutable script URLs; a changing compatibility
alias cannot retain one fixed hash. Hosted image URLs are independent of SDK
versions and remain stable through library/pool changes.
