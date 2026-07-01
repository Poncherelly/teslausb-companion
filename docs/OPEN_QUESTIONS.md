# Open questions

Things flagged during design that need verifying against current
reality rather than being treated as settled. Check these before or
while implementing the relevant feature — don't assume the answer
below is still accurate by the time this gets built, especially the
Tesla-related ones, since that API has changed more than once in the
period this project was being designed.

1. **Can an individual complete Tesla's Fleet API app registration
   without a registered business entity?** Circumstantial evidence says
   yes (see ARCHIVE_AND_TESLA.md), not directly confirmed. Do a real
   test registration first.

2. **Exact mechanics of sharing one `.well-known` public-key-hosting
   domain across many individually-registered Tesla apps** — confirm
   Tesla's domain-verification/vehicle-pairing flow actually permits
   this (as MyTeslamate's product implies) before designing the Tier 2
   flow around it.

3. **BLE MTU negotiation** — confirm actual negotiated MTU on target
   hardware/OS combinations (Android BLE stack, iOS Core Bluetooth)
   rather than assuming; affects whether WiFi password writes need
   chunking after all.

4. **Encryption performance on lowest-supported Pi hardware** (Pi Zero /
   Zero 2 W) — benchmark before defaulting on-Pi encryption to "on" by
   default; may need a lower-power default on weaker hardware.

5. **Tesla Fleet API pricing and discount amounts are not stable** —
   the discount has already changed once (from $10 to $14/month) during
   this project's design period. Don't hardcode assumptions about exact
   dollar amounts into user-facing copy; reference Tesla's own current
   documentation instead of a fixed number where possible.

6. **Push notification relay was deliberately deferred to webhook/email
   only for v1** (no managed push infrastructure) — revisit only if
   there's a clear zero/near-zero-cost path to real push later, and keep
   it opt-in and disclosed if it ever appears, matching the existing
   Private/Convenient disclosure pattern.

7. **RAUC (or equivalent A/B update framework) compatibility with the
   specific Pi models/OS images this project targets** — confirm it
   works cleanly alongside the USB gadget configuration (configfs) setup
   before committing to it as the OTA mechanism. See RELIABILITY.md.

8. **Whether the "never enumerates at all" USB gadget failure pattern
   (as opposed to the "drops mid-session" pattern) has any software
   mitigation at all**, or is purely a hardware/host-controller
   limitation on certain car/port combinations — see RELIABILITY.md.
   Worth tracking community reports as this project gets built, since
   the answer may differ across Tesla models/years/firmware.
