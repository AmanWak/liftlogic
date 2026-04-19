# LiftLogic — Squat Coach

Mobile-first PWA that reads a 4-IMU garment over WebSocket, detects squat reps, flags form errors, and pipes each rep to Gemini for concise coaching. Built for StarkHacks.

## Setup

```bash
npm install
cp .env.example .env.local   # then paste your key
```

Get a Gemini API key at https://aistudio.google.com/apikey and put it in `.env.local` as:

```
GEMINI_API_KEY=...
```

Without a key the `/api/coach` route falls back to canned demo coaching in development — the UI still works end-to-end.

## Run (two terminals)

```bash
npm run mock    # WebSocket mock at ws://localhost:8181 (scripted good + bad reps)
npm run dev     # Next.js on http://localhost:3000
```

Visit `http://localhost:3000` on the laptop, or `http://<laptop-lan-ip>:3000` on the phone (same WiFi).

## Point at the real ESP32

The ESP32 prints its DHCP IP to Serial on boot. Paste it into the settings sheet (gear icon, top-right), or deep-link:

```
http://<laptop-ip>:3000?esp=ws://<esp32-ip>:81
```

The chosen URL persists in `localStorage`.

## Install as a PWA on iPhone

1. Open the URL in Safari.
2. Share → Add to Home Screen.
3. Launches fullscreen with black status bar and the LiftLogic icon.

## Layout

- `app/page.tsx` — main dashboard (status band, live silhouette, coaching feed).
- `app/api/coach/route.ts` — POST endpoint that validates the analysis with zod and calls Gemini server-side.
- `lib/useSensorStream.ts` — WebSocket hook with auto-reconnect; drives rep detection + coaching fetch.
- `lib/repDetector.ts` — descent → bottom → ascent state machine on thigh pitch.
- `lib/formAnalyzer.ts` — rule-based biomechanics (lean, lumbar flexion, knee valgus, hip shift, depth, bar path).
- `lib/gemini.ts` — server-only Gemini client (`gemini-2.5-flash`, 5s timeout, thinking disabled for latency).
- `scripts/mock-esp32.mjs` — scripted reps: clean, shallow, valgus, lean, butt-wink, hip-shift.

## Commands

```bash
npm run dev         # dev server (turbopack)
npm run mock        # mock ESP32 WebSocket
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # production build
```

## Demo runbook (90s)

1. **Pre-flight** (before judges arrive): laptop + phone on venue WiFi, phone charged ≥70%, mock running, both browsers open, ESP32 powered and IP copied into settings sheet. Verify one real rep appears before stepping away.
2. **Open** (15s): "LiftLogic — squat-form coaching through 4 IMUs on the body. Real-time silhouette on the phone, AI coaching per rep."
3. **Show the garment** (15s): point out `s1`/`s2`/`s3`/`s4` placements (upper back, sacrum, two thighs).
4. **Live reps** (45s): do 3 squats — clean, knee valgus, shallow. Judges watch silhouette bend, then coaching cards drop in.
5. **Close** (15s): "Gemini 2.5 Flash turns the rules-based analysis into a coach. Next up: bar path via s5 and rep-history trend tracking."

### Contingencies

- **ESP32 drops mid-demo**: tap the connection pill → paste `ws://localhost:8181` → mock takes over. Cards keep appearing.
- **Laptop dies**: phone stays live off last WebSocket snapshot briefly; restart `npm run dev` on spare laptop.
- **Gemini rate-limited / key issue**: demo-mode fallback still prints per-rep messages in dev. Don't ship `NODE_ENV=production` without a working key.

## Troubleshooting

- **Connection pill red**: ESP32 URL is wrong or the device is off the WiFi. Open settings → re-enter URL.
- **No reps appearing**: the mock alternates good/bad reps every few seconds; wait ~5s. For real hardware, verify `s3`/`s4` (thigh IMUs) are seated — rep detection watches their pitch.
- **`GEMINI_API_KEY` error in logs**: expected without a key; dev falls back to canned coaching. Add the key to `.env.local` and restart `npm run dev`.
