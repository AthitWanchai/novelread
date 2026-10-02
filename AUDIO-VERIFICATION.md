# NR-06: Audio recovery verification

2 October 2026. No dependency installation and no secrets printed.

## Confirmed local causes
- Rejected `/api/tts` promises stayed in `pending`, so manual retry returned the same rejection without a fresh network request. `node test_audio_client.cjs` was red (1 request instead of 2) before the fix and passes now.
- Voice/chapter resets could accept a late old response into the new audio cache. Generation checks and request aborts now discard stale blobs. Pause while loading cannot restart playback.
- Reader speech lacked a guard while fetching and could start concurrent loops. The button now cancels in-flight generation, with request timeout and object-URL cleanup even on playback errors.

## Upstream investigation
The original 73-character Thai text from test_pipeline.py is valid with both available Thai voices. Network-enabled server 8758 before adapter change produced fresh cache misses: Premwadee +0% 34,560 bytes (5.55 s), Niwat +0% 33,408 bytes (1.19 s), Premwadee -8% 37,584 bytes (5.05 s), all HTTP 200 and MP3 frame header fff364c4. Thus the earlier NoAudioReceived failure is not currently deterministic and the text/voice-invalid hypothesis is not supported.

Upstream issue https://github.com/rany2/edge-tts/issues/473 reports intermittent NoAudioReceived even with valid requests and concurrency 1. This supports a transient upstream failure hypothesis but does not prove the cause of this installation's previous failure. No silent voice, engine or credential fallback is used.

Edge retries only transient no-audio/WebSocket/connection/timeout errors, with a new communicator per attempt, at most 2 attempts of 12 seconds and 0.3-second backoff. Invalid parameter errors do not retry. API deadline is 28 seconds; failures and empty audio return Thai 502 and are never cached. The UI times out at 35 seconds and lets users cancel or retry/select another voice. Users can continue reading if the service remains unavailable.

## Tests: distinct evidence
- `python test_tts_recovery.py`: 4 deterministic tests pass. Mocked upstream transient failure, persistent failure, invalid input, and API empty/failure cache prevention. These verify recovery mechanics, not external-service availability.
- `node test_audio_client.cjs`: passes manual fresh retry, stale voice response/cache cleanup, pause while loading.
- `NOVELREAD_TEST_URL=http://127.0.0.1:8756 python test_tts_live.py`: network-enabled patched server fresh Thai samples with unique suffix: Premwadee 67,824 bytes and Niwat 78,480 bytes, both HTTP 200 X-Cache miss; each repeat was X-Cache hit with identical audio bytes.
- Real Chromium UI on listen.html loaded Project Gutenberg through real extraction. First Premwadee chunk did not play; UI displayed Thai failure/retry instructions, stopped playing and cleared loading. Switching to Niwat cleared cached/pending audio and a subsequent real request decoded and advanced audio currentTime to 0.015947 seconds. Returning via the Novelread link navigated to `/`.

## Limits
Do not report that every voice/text always succeeds. The initial mixed English/Thai Gutenberg chunk failed within bounded attempts while another voice succeeded. The exact transient upstream cause is still unproven; no protocol/dependency change is claimed as a cure. Browser audio advancement proves playback/decode, not human-perceived sound quality. Browser speaker hardware and Safari/mobile hardware were not verified. The 12-second per-attempt ceiling may reject slower upstream responses; it prioritizes bounded recovery over indefinite loading and may need tuning from production latency measurements.
