# 🏋️ FitLog — Gym Tracker

A full-stack workout tracker with a **Next.js web app** and a **React Native (Expo) mobile app**, sharing one **Supabase** backend. Clean, athletic, light theme — responsive across phones, tablets and desktop.

Track each workout session: exercises, sets, reps, weights, cardio distance/time, calories, rest, personal records, difficulty, energy, mood, notes, location, body weight and progress photos — and search/filter your whole history.

```
gym-tracker/
├── web/         → Next.js 14 web app (App Router, Tailwind, Supabase Auth)
├── mobile/      → Expo / React Native app (expo-router)
├── database/    → schema.sql (reference copy of the DB, already applied)
└── README.md
```

---

## What's already done

- ✅ **Supabase database** — all tables, indexes, Row-Level Security, and a private storage bucket for progress photos are **already created** in your project (`vssmililwzwmtnlkszix`). Every user only ever sees their own data.
- ✅ **Web + mobile source** — complete and pre-wired to your Supabase project (URL + publishable key are already filled in).

You just need to install dependencies and run. (I couldn't run `npm install` in the cloud sandbox — its network policy blocks the npm registry — so the two `npm install` steps below are the only setup left.)

---

## 1) Web app (Next.js)

```bash
cd web
cp .env.local.example .env.local   # already contains your Supabase keys
npm install
npm run dev
```

Open http://localhost:3000 → create an account → start logging.

**Features:** dashboard with stats + training-volume chart, log/edit workouts with dynamic exercises & sets, full history with filters (date range, type, exercise name, muscle group, name, completed status, location, PR, difficulty), workout detail, and progress-photo upload.

Deploy anytime to **Vercel**: push this folder and set the two `NEXT_PUBLIC_SUPABASE_*` env vars.

---

## 2) Mobile app (Expo / React Native)

```bash
cd mobile
npm install
npx expo start
```

Then scan the QR code with the **Expo Go** app on your phone (you already have Expo installed 👍).

> **SDK note:** the project targets **Expo SDK 51**. If your Expo Go app is on a newer SDK and refuses to open it, run `npx expo install expo@latest` followed by `npx expo install --fix`, then `npx expo start -c`.

**Features:** email auth, workout list with search + type/status filters, log workout (exercises & sets), workout detail, and a profile tab with lifetime stats.

Your Supabase URL + key are stored in `mobile/app.json` under `expo.extra`.

---

## 3) Database

Everything is already applied to your live project. `database/schema.sql` is a reference copy kept in version control so you can recreate the schema on a fresh Supabase project if you ever need to (paste it into the Supabase SQL editor).

### Email confirmation
By default Supabase asks new users to confirm their email. For fast local testing you can turn that off in **Supabase → Authentication → Providers → Email → “Confirm email” (off)**, or just confirm via the link sent to your inbox.

---

## Data model (one row per workout session)

- **workouts** — name, date, start/end time, duration, type, muscle groups, calories, difficulty, energy-before, mood-after, notes, location, completed, body weight
- **exercises** — belongs to a workout; name, order, PR flag, cardio distance/time, notes
- **exercise_sets** — belongs to an exercise; set number, reps, weight, distance, time, rest, PR flag, completed
- **progress_photos** — belongs to a workout; file kept in the private `progress-photos` storage bucket

---

## Tech

Next.js 14 · React 18 · Tailwind CSS · Expo SDK 51 · expo-router · Supabase (Postgres + Auth + Storage) · TypeScript throughout.
