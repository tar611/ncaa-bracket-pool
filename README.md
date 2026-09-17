# NCAA Bracket Pool

A private March Madness bracket pool for a small group (family/friends):
create an account, fill out your bracket before the tournament starts, and
watch it score itself automatically as real games finish — no one has to
manually update anything once the tournament tips off.

**Status:** backend complete and verified end-to-end against the real,
completed 2026 tournament's historical data. Frontend (the actual pages
people click through) is next.

## How the live scoring works

There's no manual score entry. A scheduled job (see
`.github/workflows/sync-scores.yml`) hits ESPN's public scoreboard feed
every 20 minutes during March/April, and:

1. Pulls the day's college basketball games and picks out the NCAA
   tournament ones (identified by ESPN's own game notes, not by date
   guessing).
2. Figures out which of the tournament's 63 fixed "slots" (Round of 64 game
   1, Round of 64 game 2, ... all the way to the Championship) each event
   belongs to, using the two teams' seeds — not their names, since ESPN's
   name formatting can vary.
3. Updates that slot's score/status/winner in the database.
4. Recomputes every user's bracket score, since a real result changing can
   affect any bracket that predicted it.

This was tested against the actual 2026 tournament's real ESPN data (every
one of the 63 real games, replayed through the sync logic) before being
reset back to a clean, empty database — see the `server/src/lib/espnSync.ts`
and `server/src/lib/espnParsing.ts` comments for the specific real-world
edge case that testing caught (two different regions' #1 seeds meeting in
the Final Four, which broke a naive seed-based team lookup).

## Project structure

```
server/
  prisma/schema.prisma        # Database schema (see below)
  prisma/seed.ts               # Loads data/<year>-field.json into the database
  data/2027-field.json         # This year's 64 teams — fill in after Selection Sunday
  data/tournament-config.json  # Lock time + Final Four region pairing for this year
  src/lib/bracketStructure.ts  # Pure logic: how the 63 bracket slots connect (unit tested)
  src/lib/scoring.ts           # Pure logic: picks + results -> a score (unit tested)
  src/lib/espnParsing.ts       # Pure logic: parsing ESPN's data shape (unit tested)
  src/lib/espnSync.ts          # Orchestration: fetch ESPN, update the DB, rescore brackets
  src/routes/                  # Express routes: auth, brackets, tournament, leaderboard, admin

client/                        # React frontend (not built yet)
```

## The yearly admin runbook

This app is reusable every year — only two files need updating, once, after
the field is announced:

1. **After Selection Sunday**, edit `server/data/2027-field.json` — replace
   every `"name": "TBD"` with the real team name **exactly as it appears on
   ESPN's site** (this matters: the score-sync job matches on exact team
   name). Run `npm run db:seed` from `server/` to load it in.
2. Edit `server/data/tournament-config.json`:
   - `lockAt` — set to the exact tip-off time of the very first Round of 64
     game (ISO 8601, e.g. `"2027-03-19T17:00:00Z"`). The whole bracket locks
     at once, not game-by-game — standard pool rule.
   - `finalFourPairing` — which two regions play in each national semifinal.
     This is announced alongside the bracket itself; it isn't always the
     same pairing every year, so don't assume the placeholder is correct.
3. Rename the field file itself (`2027-field.json` → `2028-field.json`,
   etc.) and update the path in `server/prisma/seed.ts` accordingly, next
   year.

The seed script refuses to run if any team is still `"TBD"` or if there
aren't exactly 64 teams — it's meant to fail loudly rather than silently
seed a broken bracket.

## Data model

- **Team** — one row per tournament team (name, seed, region).
- **BracketSlot** — the 63 real games, in a fixed structure (which slots
  feed into which later slots is defined in `bracketStructure.ts`, not
  hardcoded per year). Starts with Round of 64 slots filled in from the
  seed script; every later round starts empty and gets filled in by the
  score-sync job as earlier rounds are actually decided.
- **User** / **Bracket** / **Pick** — one bracket per user, one pick per
  slot. A pick's two "options" are computed dynamically from that user's
  own earlier picks (Round of 64 excepted, where they're just the real
  seeding) — see `resolvePredictedTeamsForSlot`.

## Scoring

Standard doubling scoring: 1 point for a correct Round of 64 pick, 2 for
Round of 32, 4 for Sweet 16, 8 for Elite 8, 16 for Final Four, 32 for the
Championship. A perfect bracket scores 192 points (verified in testing).

## Setup

**Requirements:** Node.js 18+, a Postgres database (this project uses
[Neon](https://neon.tech)).

```bash
cd server
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, SYNC_SECRET
npx prisma generate
npm run db:push         # create the tables
npm run db:seed         # after filling in data/2027-field.json for real
npm run dev              # starts the API on :4000
```

Generate real secrets (don't reuse the `.env.example` placeholders) with:

```bash
openssl rand -hex 32
```

## Testing

```bash
cd server && npm test
```

29 tests covering the bracket structure math, the scoring engine, and the
ESPN response parsing — all pure functions, no database or network needed
to run them.

## Deployment

- **Backend — Render**, same as this portfolio's job-tracker app: a Web
  Service with root directory `server`, build command
  `npm install && npx prisma generate && npm run build`, start command
  `npm start`. Environment variables: `DATABASE_URL`, `JWT_SECRET`,
  `SYNC_SECRET`.
- **Frontend — Vercel**, deployed as `tarbracket`.
- **Score sync — GitHub Actions**, `.github/workflows/sync-scores.yml`,
  scheduled every 20 minutes in March/April. Needs two repo secrets:
  `API_URL` (the deployed backend's base URL) and `SYNC_SECRET` (must match
  the backend's environment variable).

## What's next

- The actual frontend: signup/login, bracket-filling UI, the leaderboard.
- A known limitation to fix eventually: changing an earlier-round pick
  doesn't cascade-clear later-round picks that depended on it (see the
  comment in `server/src/routes/brackets.ts`). Not a scoring risk — the
  whole bracket locks before any real games start either way — but worth
  cleaning up.
