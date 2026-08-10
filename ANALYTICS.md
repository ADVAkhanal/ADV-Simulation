# Analytics

The director-demo build implements a device-local anonymous event buffer. It sends no network requests and stores no account, name, email, IP address, device fingerprint, free text, real inventory, or customer data. The buffer is capped at the latest 100 events under `toolpath-anonymous-events-v1`.

Implemented events: landing view, flagship start, cycle start, first cut, inspection complete, retry start, retry ready, result share, 3D asset ready, and 3D fallback. Payloads contain only contract IDs and coarse numeric game measurements.

Benchmark questions, measured first through observed playtests rather than production telemetry:

- Comprehension: time from contract screen to first intentional cut; target ≤10 seconds.
- Feedback: time to first visible progress or understood warning; target ≤60 seconds.
- Completion: time to first inspection result; target ≤3 minutes.
- Replay intent: percentage of players who press retry or advance without prompting.
- Mastery: grade improvement between first and second attempts.
- Strategy: whether players can explain why they changed tool, feed, or route.

No commercial-viability claim should be made until these measures come from real players in a representative sample.
