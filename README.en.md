# eqm — Japan Earthquake & EEW Monitor

[한국어](README.md)

Polls JMA strong-motion monitor (kmoni) frames at 1 Hz for server-side shake detection, and relays P2PQuake / Wolfx EEW feeds.
The server does all detection, logging and push; the renderer just draws a single SSE stream.

## How it works

- **Detection** — the server receives one kmoni frame per second (frame-buffer cache), converts pixel colors to instrumented intensity, and judges per-station rise rates. The detection logic is shared client/server code bundled with esbuild.
- **Display** — forecast-area coloring, station points, P/S wave rings and EEW estimated-intensity masks on a MapLibre map.
- **Alerts** — detection beep + graded intensity-rise samples (from real kmoni measurements), EEW voice, Discord detection reports (2-stage: POST on start → PATCH on end), browser notifications.
- **Catch-up** — after sleep/tab-away, buffered frames are replayed as a 25 fps time-lapse.
- **Also** — i18n (ko/en/ja), dark mode, Electron desktop (tray-resident) support.

## Layout

```
src/      Svelte 5 renderer — subscribes to SSE (/api/events), draws map/sound/alerts (no detection logic)
server/   Node + express — kmoni poller, detection, webhooks, feed relays, API
```

## Running

[pnpm](https://pnpm.io) only (do not use npm — the lockfile is `pnpm-lock.yaml`).

```bash
pnpm install
pnpm dev                  # dev server — http://localhost:3000
pnpm build && pnpm start  # production (node server/index.mjs)
```

| Command | Description |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build (incl. detection bundle) |
| `pnpm start` | Start server (`PORT` defaults to 3000) |
| `pnpm check` | svelte-check |
| `pnpm test` | vitest |

## Environment

See `.env.example` — just `WEBHOOK_URL` (Discord detection reports). Without it, only reports are disabled.
