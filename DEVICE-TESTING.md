# Testing on a physical Android device

Everything below is already configured except **step 1**, which needs administrator rights.

- **Your machine's Wi-Fi address:** `10.145.76.198`
- **Backend:** port `5000`
- **App API URL:** `http://10.145.76.198:5000/api` (written to `PCOS-Screening-App/.env`)

Your phone and this computer **must be on the same Wi-Fi network**.

---

## 1. Allow the backend through Windows Firewall — *you must do this*

This is the single most common reason a phone can't reach a dev server. Windows blocks
inbound connections to `node.exe` by default, so the request never arrives and the app
just shows "Network Error".

Open **PowerShell as Administrator** (right-click → Run as administrator) and run:

```powershell
New-NetFirewallRule -DisplayName "PCOS Dev Backend (5000)" `
  -Direction Inbound -Protocol TCP -LocalPort 5000 `
  -Action Allow -Profile Private
```

`-Profile Private` limits it to networks marked Private. Your Wi-Fi is already Private,
so this is the right scope — it does not open the port on public networks.

To remove it later:

```powershell
Remove-NetFirewallRule -DisplayName "PCOS Dev Backend (5000)"
```

**Metro (port 8081) is usually allowed automatically** the first time you run it — Windows
shows a prompt. If you dismissed that prompt, add the same rule for `8081`.

---

## 2. Start the backend

```bash
cd PCOS-Screening-Backend
npm run dev          # nodemon, restarts on change
```

Confirm it is reachable **from the phone's point of view** by opening this in the
phone's browser:

```
http://10.145.76.198:5000/health
```

You should see JSON starting `{"status":"Backend is running"...}`.

**If that page does not load, stop here** — nothing else will work until it does.
Go back to step 1, then see Troubleshooting below.

---

## 3. Start the app

```bash
cd PCOS-Screening-App
npm run dev:device
```

That runs `set-dev-ip` (rewrites `.env` with your current IP) then `expo start --clear`.

Scan the QR code with **Expo Go** on the phone.

> **Use Expo Go, not the old dev build.** `expo-secure-store` was added when token
> persistence was implemented. Expo Go includes it, but any development build you
> installed before today does not, and it will crash on launch. If you want a dev
> build, rebuild it — see step 4.

---

## 4. Optional: a real development build

Needed only for **remote push notifications**, which Expo Go dropped on Android in
SDK 53. Everything else in the app works in Expo Go, including local notifications.

```bash
cd PCOS-Screening-App
npx expo run:android      # phone connected via USB, USB debugging on
```

This compiles the native project in `android/` and installs it. First run takes a while.
Re-run it any time you add a package with native code.

---

## What to check once it launches

The recent work is easiest to verify in this order:

1. **Sign up**, then **force-close the app and reopen it.** You should still be signed
   in. Before this week, every cold start returned you to the login screen.
2. **Log a symptom**, then **turn off Wi-Fi on the phone and log another.** Both appear
   in the list. Turn Wi-Fi back on and reopen the app — the queued one syncs.
3. **Sign out and back in.** Your entries come back from the server.
4. **Switch the phone to dark mode.** Every screen should follow; none should stay white.
5. **Start the assessment, get to step 3, force-close, reopen.** It offers to resume.

---

## Troubleshooting

**"Network Error" everywhere in the app**

Work through it in this order:

1. Can the phone load `http://10.145.76.198:5000/health` in its browser?
   - **No** → firewall (step 1), or the phone is on a different network. Phones often
     silently prefer mobile data; turn mobile data off to force Wi-Fi.
   - **Yes** → the backend is fine; it's the app's config. Continue.
2. Did your IP change? Run `npm run dev:ip` — it prints the address it detected and
   rewrites `.env`. Then restart Metro with `--clear`.
3. Restart Metro **with `--clear`**. `EXPO_PUBLIC_*` values are compiled into the JS
   bundle, so a cached bundle still holds the old address.

**Guest / university / corporate Wi-Fi**

Many such networks enable *client isolation*, which blocks devices from talking to each
other regardless of firewall settings. There is no fix from this side. Use a phone
hotspot instead: connect the computer to the phone's hotspot, then run `npm run dev:ip`
to pick up the new address.

**Windows Mobile Hotspot**

If you share the computer's connection to the phone, the address becomes `192.168.137.1`.
`npm run dev:ip` ranks Wi-Fi first, so set it manually in that case:

```
EXPO_PUBLIC_API_URL=http://192.168.137.1:5000/api
```

**App crashes immediately on launch**

Almost certainly an old development build missing `expo-secure-store`. Use Expo Go, or
rebuild with `npx expo run:android`.

**Backend says "Port 5000 is already in use"**

It falls through to 5001, 5002… and the app will still be pointed at 5000. Find the
stale process:

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Select-Object ProcessId, CommandLine
Stop-Process -Id <pid> -Force
```

---

## Notes

- **HTTP, not HTTPS.** Fine for development. Android blocks cleartext traffic in release
  builds, so the backend needs TLS before any real distribution (G-03 / G-02 in `PLAN.md`).
- **`.env` files are gitignored** in both projects. `.env.example` in each is the template
  to copy. The backend `.env` now holds `FIELD_ENCRYPTION_KEY` — if you lose it, existing
  encrypted symptom notes become unreadable. Back it up somewhere safe.
- **The database is SQLite** at `PCOS-Screening-Backend/data/pcos.sqlite` unless
  `DATABASE_URL` is set. Delete the file to start clean.
- **The ML service** is pointed at a remote Render URL in the backend `.env`. If it is
  asleep or unreachable, the assessment falls back to a local estimate and *says so* on
  screen — that is intended behaviour, not a bug.
