# Customer network collector client (Wave 30)

Implements the browser-side half of fraud-platform-api's customer network collector, strictly against
`fraud-platform-api/docs/collector_client_contract.md` (the authoritative, frozen contract) and the
server's own current implementation (`app/collector_app.py`, `app/schemas/collector.py`) -- both of
which agree with each other and with this module.

## Scope mismatch found during Wave 30 Phase 2 (documented, not silently resolved)

Wave 30's own instructions describe a "telemetry collection" capability: mandatory/optional events,
typing telemetry, bot signal, navigation, form, mouse/touch tracking, an event lifecycle with batching,
and payload validation for individual telemetry events.

**No such capability exists anywhere in the frozen collector architecture (Waves 27-29), and none was
built here.** The collector's entire request body is `{"token": "<token>"}`
(`app/collector_app.py::_CollectRequest`, `model_config = ConfigDict(extra="forbid")` -- a second field
of ANY kind is rejected by the server with a 422). The collector observes exactly one fact: the Tor
classification of the IP that connected to it, via the EXISTING, unmodified Tor lookup (Wave 22) -- it
has never been a behavioral-telemetry pipeline, and extending it into one would be a scoring/evidence
architecture change far outside a browser-client wave's scope (and explicitly outside this wave's own
"do not invent additional telemetry" instruction).

Per Wave 30 Phase 2's own instruction -- "If the current backend implementation and documented contract
disagree: STOP and document the exact mismatch before changing either side" -- this module:

- implements token handling, submission, Retry-After handling, and safe-failure semantics in full;
- implements NO telemetry collection, NO event batching, and NO telemetry payload validation, because
  none of that has any corresponding server capability to call;
- did NOT modify the backend to accept a payload it was never designed to carry.

If a future wave wants real behavioral telemetry (mouse/touch/typing/bot-signal), that is a NEW backend
capability requiring its own contract-freeze wave (mirroring Wave 28A-C's own process for the network
observation acquisition boundary) -- not something this client can safely assume into existence.

## What this module does implement

- `CollectorClient` (`collectorClient.ts`) -- accepts an already-issued token (`setToken`), tracks its
  local expiry, and submits it to `/collector/v1/collect`, handling every outcome in the server's closed
  `CollectorOutcome` vocabulary plus four client-only conditions (`types.ts`) uniformly and safely.
- Token ISSUANCE is deliberately NOT implemented here (contract point 2: `X-Api-Key`-authenticated,
  server-to-server only) -- a host page must obtain a token from its own backend.
- `flow_id` is never read, stored, or sent by this module -- correlation is carried entirely inside the
  opaque token the host page supplies (contract point 4).
