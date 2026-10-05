#!/usr/bin/env node
/**
 * Points .env at this machine's current LAN address.
 *
 * `EXPO_PUBLIC_API_URL` has to be a concrete IP for a physical device to reach
 * the backend — `localhost` resolves to the phone itself, and `10.0.2.2` is an
 * Android *emulator* alias. That IP comes from DHCP, so it changes when you
 * switch networks or the lease renews, and the app then fails with "Network
 * Error" for no visible reason.
 *
 * Run this instead of editing the file by hand:
 *
 *     npm run dev:ip
 *
 * Then restart Metro with `--clear`. EXPO_PUBLIC_ values are inlined into the
 * bundle at build time, so a cached bundle keeps the old address.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const ENV_PATH = path.resolve(__dirname, "..", ".env");
const KEY = "EXPO_PUBLIC_API_URL";
const PORT = process.env.PORT || "5000";

/** Private-range interfaces, best candidate first. */
function findCandidates() {
  const found = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const addr of addresses ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;

      // Rank by how likely this is the interface the phone shares.
      let rank = 3;
      if (/wi-?fi|wlan|wireless/i.test(name)) rank = 0;
      else if (/ethernet|eth/i.test(name)) rank = 1;
      // Windows' Mobile Hotspot sits on 192.168.137.x and is only right when
      // the phone is actually tethered to this machine.
      if (addr.address.startsWith("192.168.137.")) rank = 2;
      // Virtual adapters (VirtualBox, WSL, Docker, VMware) are never it.
      if (/virtual|vbox|vmware|wsl|docker|loopback|hyper-v/i.test(name)) rank = 9;

      found.push({ name, address: addr.address, rank });
    }
  }

  return found.sort((a, b) => a.rank - b.rank);
}

const candidates = findCandidates();

if (candidates.length === 0) {
  console.error("No external IPv4 interface found. Are you connected to a network?");
  process.exit(1);
}

const chosen = candidates[0];
const url = `http://${chosen.address}:${PORT}/api`;

let contents = "";
if (fs.existsSync(ENV_PATH)) contents = fs.readFileSync(ENV_PATH, "utf8");

const line = `${KEY}=${url}`;
const pattern = new RegExp(`^${KEY}=.*$`, "m");

let previous = null;
if (pattern.test(contents)) {
  previous = contents.match(pattern)[0].split("=").slice(1).join("=");
  contents = contents.replace(pattern, line);
} else {
  contents = contents.trimEnd() + (contents.trim() ? "\n" : "") + line + "\n";
}

fs.writeFileSync(ENV_PATH, contents, "utf8");

console.log(`\n  Interface : ${chosen.name}`);
console.log(`  API URL   : ${url}`);
if (previous && previous !== url) console.log(`  (was      : ${previous})`);

if (candidates.length > 1) {
  console.log("\n  Other interfaces seen:");
  for (const c of candidates.slice(1)) {
    console.log(`    ${c.address.padEnd(16)} ${c.name}`);
  }
  console.log("  If the phone can't connect, one of these may be the right one.");
}

console.log("\n  Next: restart Metro with  npx expo start --clear\n");
