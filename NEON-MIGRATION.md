# Moving the database to Neon PostgreSQL

The backend already spoke both SQLite and Postgres — `DATABASE_URL` chose between
them. What it did *not* do is survive the switch, for two reasons that are now fixed.

---

## What was actually broken

### 1. TLS was off outside production

```js
ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
```

Neon requires TLS on **every** connection. Running locally against Neon would have
failed with *"The server does not support SSL connections"* — a misleading error for
what is really a config mismatch. TLS is now decided by the connection string: on for
any remote host, off only for `localhost` or an explicit `sslmode=disable`.

### 2. Column casing — the one that would have hurt

Postgres folds unquoted identifiers to lower case. A column declared `fullName` is
stored as `fullname`, so `SELECT *` returns `row.fullname` and **`row.fullName` is
`undefined`**. SQLite preserves the declared case, which is exactly why this never
surfaced.

There are ~30 camelCase identifiers in the schema, read directly by six controllers.
The switch would have broken them **quietly** — blank names, missing timestamps,
notification toggles all reading false — rather than throwing anything you could
trace.

Every Postgres row is now mapped back to the declared casing in `config/database.js`
(`restoreCase`). Controllers stay engine-agnostic. Adding a column means adding one
entry to `SCHEMA_COLUMNS`.

### Also changed

- **Pool tuned for Neon** — smaller pool, shorter idle timeout, and a 15s connect
  timeout so the first query after a scale-to-zero has time to wake the compute.
- **`pool.on("error")` handler** — a pool error with no listener is an uncaught
  exception that kills the process. That is how a routine idle-connection reset
  becomes an outage.

---

## Steps

### 1. Create the database

In the [Neon console](https://console.neon.tech), create a project and copy the
**pooled** connection string — the host ends in `-pooler`. It survives the compute
scaling to zero; the direct endpoint handles that far less gracefully.

```
postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

### 2. Point the backend at it

In `PCOS-Screening-Backend/.env`:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
```

Leave `FIELD_ENCRYPTION_KEY` **exactly as it is**. It is unrelated to the database,
and changing it makes existing encrypted notes unreadable.

### 3. Verify before trusting it

```bash
cd PCOS-Screening-Backend
node scripts/verify-db.js
```

This creates a throwaway user, exercises all ten tables, checks twelve columns for
casing, tests the idempotent upsert the sync queue depends on, then deletes
everything. Safe to run against a database with real data.

Expect `33 passed, 0 failed`. **Any casing failure means a column is missing from
`SCHEMA_COLUMNS`** — add it and re-run.

### 4. Start the server

```bash
npm run dev
```

It should log:

```
[DB] PostgreSQL (Neon), TLS on
✅ PostgreSQL tables initialized
```

Tables are created on boot. There is nothing to run by hand.

---

## Moving existing data

Only if you have data in `data/pcos.sqlite` worth keeping — for a fresh project,
skip this and let people sign up again.

There is no migration script, deliberately: writing one that silently mangles
health data is worse than not having one. If you do need it, the shape is small
enough to do by hand — export each table to CSV from
[DB Browser for SQLite](https://sqlitebrowser.org/) and import via the Neon console.
Order matters because of the foreign keys:

```
users → symptoms → predictions → posts → comments
      → reports → refresh_tokens
      → symptom_logs → cycle_entries → mood_entries
```

`refresh_tokens` can be skipped — everyone just signs in again.

---

## Rolling back

Comment out `DATABASE_URL` and restart. The SQLite file is untouched by any of this.

---

## Notes

- **Free tier scales to zero.** The first request after idling can take several
  seconds. That is the compute waking, not a bug — the 15s connect timeout exists
  for it.
- **Keep `sslmode=require`** in the string. The code would enable TLS for a Neon
  host anyway, but being explicit means the URL is correct wherever it is pasted.
- **Never commit `.env`.** It is gitignored in both projects, and now holds both a
  database credential and the field-encryption key.
- **The app needs no changes.** It talks to the API, not the database.
