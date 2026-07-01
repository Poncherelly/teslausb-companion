# Archive destinations and Tesla integration

## Archive destinations

- Local: CIFS/SMB, rsync, NFS — already supported by upstream teslausb.
- Cloud (Convenient mode only): via rclone remotes — Google Drive,
  OneDrive, and in principle anything rclone supports (S3, Backblaze
  B2, etc.). Don't build cloud storage integration from scratch; wrap
  rclone's existing remotes with a proper OAuth-webview wizard step
  instead of rclone's normal interactive CLI config flow.
- Volume caution: Tesla's rolling dashcam buffer (up to 24h on larger
  drives) is a lot of continuous data. Default cloud-archive users
  toward Sentry + Saved only, not the full RecentClips buffer, and
  surface expected storage consumption before they commit to a cloud
  tier that won't hold it.

## Tesla Fleet API — cost model (read this before building Tier 2)

**Tesla's Fleet API is pay-per-use, billed to whoever registered the
developer application — not per end user of that application.** Each
*developer account* gets a fixed ~$10–14/month discount, covering
roughly two wake-ups/day for a couple of vehicles. That discount does
not scale with number of users under a shared app registration.

**Conclusion: a single shared teslausb-companion Tesla app registration
is not viable under the zero-cost constraint at any real scale.** This
is exactly the trap that forced existing third-party Tesla services
(Teslemetry, Teslascope) into paid subscriptions after Tesla introduced
this pricing model.

**Decision: per-user registration.** Each user registers their own free
Tesla developer application, under their own Tesla account, and enters
their own `client_id`/`client_secret` into the app (Tier 2 setup flow,
not the base wizard). Their own usage bills against their own discount.
This app's usage pattern (wake + hold awake during an archive run, no
continuous polling) should sit comfortably inside a single user's
monthly discount.

### Known friction point: public key hosting

Tesla requires the app's public key hosted at
`https://<domain>/.well-known/appspecific/com.tesla.3p.public-key.pem`
on a domain tied to the app registration. Requiring every individual
user to own and host a domain is unrealistic.

**Mitigation, with precedent**: MyTeslamate (a companion tool in the
Teslamate ecosystem) solves this exact problem — users still register
their own individual Tesla developer app and get their own billing
discount, but MyTeslamate hosts the shared public-key infrastructure
and provides a script/flow that automates the tedious registration
steps. Model the Tier 2 sign-up flow on this pattern: host the
`.well-known` file on a domain this project controls (free via GitHub
Pages — no paid domain required), and walk the user through registering
their own app pointed at it.

### Open question, worth confirming before building the Tier 2 flow

Tesla's app-request form asks for "legal business details" even for
what appear to be individual hobbyist registrations. Circumstantial
evidence (MyTeslamate/Teslamate's hobbyist user base going through this
exact flow at scale) strongly suggests individuals can complete it
without an actual registered business entity, but this hasn't been
directly confirmed. **Do a real test registration before building the
guided in-app flow around it.** See `OPEN_QUESTIONS.md`.

## Two-tier product structure

- **Tier 1 (free, no sign-up)**: everything except keep-awake. Note the
  core archive function has never depended on the Tesla API at all —
  original teslausb works by detecting file writes and relies on the
  car being naturally awake after parking or during Sentry events.
  Keep-awake is a reliability improvement, not a dependency.
- **Tier 2 (free, requires Tesla's own sign-up)**: keep-awake during
  archive, via the per-user registration flow above.

## Donation button

Positioned as funding genuinely optional costs (a nicer domain than the
free GitHub Pages one, general project sustainability) — explicitly
**not** a financial backstop against a metered, usage-scaling API bill.
The per-user registration decision above is what actually keeps costs
at zero regardless of adoption; donations are a bonus on top, not the
safety mechanism.
