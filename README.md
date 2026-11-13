# Roo HQ — web app 🐾

**▶ Live: https://alexwilco2012-cyber.github.io/roo-hq/** (hosted free on GitHub Pages)

A mobile-first web app for **Me** and **Anna** to run a weekly household chore plan and **swap
chores week to week with one tap**. Roo is the dog (she/her). It works offline, installs to your
home screen like a real app, and **syncs one shared plan live between both your phones**.

No build step, no app store, no Xcode. Just static files + a free Firebase project for sync.

> This is the web version of the native iOS app (kept in `../RooHQ/`). Same plan, same rules,
> far easier to get onto both your phones.

---

## What it does

- **This week's plan**, grouped by day (Mon–Sun), opening on **today**.
- **One-tap swapping** — tap **Me / Anna / Both** on any chore to reassign it for that week.
- **Mowing is locked to Anna** (Me's grass allergy) — shown with a 🔒 and can't be swapped.
- **Tick to complete**, with per-day and per-week progress that **resets each week**.
- **Office-day flag** (💼) — mark a day Anna is at the office (08:00 to 18:00). Monday to Thursday it
  reminds you Roo is with Anna's mum (or she comes over); on Friday Alex is home, so Roo is covered.
  Any of Anna's Roo-care before 18:00 that day moves to Alex at 17:30, unless one of you swapped it by hand.
- **Seasonal mow toggle** — hide the mow out of season; it stops counting toward progress.
- **Filter** — All / Me / Anna chips to see just your chores (Both counts for each of you).
- **Live sync** between two phones via a shared **household code** (Firebase), with a little
  "what just changed" toast when the other phone makes a move.
- **Works offline**, installable to the home screen, light/dark mode, the spec's warm palette.
- **Backup** — export/import the whole plan as a JSON file.

Everything is local-first: it works fully on one phone straight away. Sync is layered on top.

## The game

- **Core and bonus.** Each day shows a short **core** list first (Roo's walks and meals, the kitchen
  reset, laundry, cooking and the food shop, the bin, the Sunday check-in), at most 6 each a day.
  A walk and meal done back to back by the same person is one card; the kitchen reset and the laundry
  are one card each. Everything else sits in a collapsed **Bonus jobs** section with the points on
  offer. Mark any chore as core in its edit form.
- **Points.** Every chore has a time estimate. Points = minutes ÷ 5, rounded, at least 1 (shown as
  "+6" on the card). Points go to whoever ticks it; a "Both" chore pays both of you. The points are
  saved with the tick, so later edits don't change history. Unticking takes them back.
- **This phone belongs to.** On first open the app asks whose phone it is (Settings to change). That
  person gets the credit for ticks from this phone. Only stored on the phone, never synced.
- **Scoreboard** (top of the screen): this week's points, streak and level for each of you, plus a
  team bar. **Streak** = days in a row with every one of your core jobs done (today counts once it's
  complete and never breaks the run while it's in progress). **Level** = one level per 250 lifetime
  points. The **team bar** fills with both your points against the total points of the week's core jobs;
  when it's full the week's team reward is unlocked.
- **Rewards** (tap the scoreboard): pick the team reward you're playing for this week, spend your own
  points on personal rewards (with a confirm step), see what's been redeemed and mark rewards as given.
  The other phone gets a note, e.g. "Alex redeemed: Pick the film". Rewards can be renamed, re-priced,
  removed or added, and all of it syncs.
- **Roo's day**: a line at the top showing how many of today's walks and meals are done.

## The routine

- **Roo**: two 30-minute walks and two meals a day. Monday to Thursday Alex walks her at 06:00 and gives
  breakfast. Evenings: Alex walks her at 17:30 then gives dinner on Monday and Wednesday; Anna does the
  same at 17:00 on Tuesday and Thursday. Friday: Alex walks her at 06:45 and gives breakfast and dinner
  (17:30); Anna walks her at 18:15. Weekends: a morning out together at 08:30 (an hour or more), an
  evening walk together (17:30 Saturday, 17:45 Sunday), Anna does breakfast at 08:00 and Alex dinner at 17:00.
- **Kitchen reset** (Alex, daily) and **laundry** (one card a day: Monday to Thursday alternates, Alex
  has two of those days each week; Friday to Sunday is Anna's).
- **Bonus chores** rotate week to week where that keeps the weekly time within about 5% on average while grass jobs are in season (about 7% when they are switched off).
- **Bins**: collected every Monday, one colour a week: black (general waste), blue (cardboard and paper),
  orange (plastic and cans), starting with black on 16 November 2026. The Sunday 19:00 chore names the
  right bin.
- **Sunday 17:30 week check-in** (both): Anna's office days, tell Anna's mum, meals.
- **Alex's gym**: home gym Monday, Wednesday and Friday at 05:30 from 16 November 2026.
- Chores can have a clock time (shown on the card and used for order) and a set of weekdays, so one
  chore can run Monday to Thursday only.

---

## Quick start (try it now)

**Option A — host it (recommended, takes 2 minutes):**
- Drag this whole folder onto **[netlify.com/drop](https://app.netlify.com/drop)** → you get a URL
  like `https://roo-hq.netlify.app`. Open it on both phones. Done (works without sync yet).

**Option B — preview locally on this PC:**
- Double-click `index.html` (it runs straight from the file), **or** run the included tiny server:
  ```powershell
  powershell -ExecutionPolicy Bypass -File serve.ps1 -Port 8123
  ```
  then open `http://localhost:8123/`.

Add it to your iPhone home screen for the full-screen app feel: open the site in **Safari** →
**Share** → **Add to Home Screen**.

---

## Set up live sync (≈ 10 minutes, one time)

> ✅ **Already done for this project.** `js/firebase-config.js` is filled in with the Roo HQ
> Firebase project and verified working (a real write/read round-trip against the database passed).
> You can skip straight to **Pair your two phones** below. The steps here are kept for reference /
> if you ever want to move it to a different Firebase project.

This is what lets a swap on your phone appear on Anna's. It uses **Firebase Realtime Database** —
free, Google-hosted, nothing for you to run.

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** → **Add project**
   (any name, e.g. `roo-hq`). You can skip Google Analytics.
2. In the project, open **Build → Realtime Database → Create Database**. Pick a location
   (e.g. *europe-west1*) and start in **locked mode** (we'll paste rules next).
3. Open the **Rules** tab, replace the contents with the rules from
   [`firebase.rules.json`](firebase.rules.json) (the part inside `"rules": { … }`), and **Publish**.
4. Back on the **Project Overview** (⚙️ → *Project settings*), scroll to **Your apps** → click the
   **web** icon `</>` → register an app (nickname `roo-hq`, no hosting needed). Firebase shows a
   `const firebaseConfig = { … }` block.
5. Copy those values into **[`js/firebase-config.js`](js/firebase-config.js)** — especially
   `databaseURL` (it looks like `https://roo-hq-xxxx-default-rtdb.europe-west1.firebasedatabase.app`).
6. Re-host (drag the folder to Netlify again, or refresh your hosting). The header chip will now be
   able to show **Synced** instead of **Local**.

> The config is safe to ship publicly — that's how Firebase web apps work. Access is controlled by
> the database **rules** (step 3), which only allow a household whose code is 8+ characters.

---

## Pair your two phones

1. Open the app on your phone → **⚙️ Settings → Sync with Anna**.
2. Tap **Make a code** (or type your own, **at least 8 characters**) → **Connect**. Status goes green.
3. On Anna's phone, open the same site → Settings → type **the same code** → **Connect**.

That's it — you're both on one live plan. Swap a chore on one phone and it appears on the other in
a second or two. Offline edits on either phone reconcile automatically when you're back online
(each change is timestamped, so the most recent edit to a given chore wins).

---

## How it's built

Plain HTML/CSS/JavaScript — no framework, no build. Open it from a file or any static host.

```
roo-hq-web/
├─ index.html              app shell
├─ styles.css              warm palette, light/dark, mobile-first
├─ manifest.webmanifest    installable PWA
├─ service-worker.js       offline cache (stale-while-revalidate)
├─ firebase.rules.json     database security rules to paste into Firebase
├─ serve.ps1               optional local static server (no Node/Python needed)
├─ icons/                  paw app icons
└─ js/
   ├─ seed.js              the plan: chore templates with minutes/core/time/days, rewards, bins, rules
   ├─ logic.js             week maths, generation, days/times, bin colours, swap rules
   ├─ game.js              points, credit, streaks, team target, levels, rewards (pure functions)
   ├─ merge.js             the sync merge engine (pure, newest-wins per field)
   ├─ store.js             local-first state — per-chore overrides + settings, timestamped
   ├─ sync.js              Firebase Realtime Database sync (household code, merge-by-timestamp)
   ├─ firebase-config.js   ← paste your Firebase config here
   └─ app.js               rendering + all interactions
```

**The clever bit:** both phones generate the same base plan from the seed, so we only ever sync the
*differences* — who a chore is assigned to, whether it's done, names, season, office days, rewards,
the week's team reward and redemptions — each keyed by a stable id and timestamped. Tiny payloads,
clean merges, no accounts needed. Older copies of the app simply ignore the game sections.

## Tests

Open **`tests.html`** in any browser. It runs the logic tests (week generation, owners, the locked
mow, "alternate", seasonal hide, days and times, bin colours, points, credit, streaks, team target,
rewards and balances) **and a two-device sync simulation** — two phones plus a shared
"cloud" exchanging diffs — covering propagation, concurrent edits, same-field conflicts, offline
edits, no-clobber, and the reward/team-goal/redemption sections with deletes and conflicts. All green means the sync engine is correct before you even wire up Firebase.

---

## Backup

**Settings → Backup → Export** saves a JSON snapshot (owners + done state included). **Import**
merges one back in by id, so it round-trips safely. Handy before changing anything, or to move the
plan without sync.

---

## Notes & limits

- **Security:** the database rules keep the plan to anyone who knows your (private) household code
  and your Firebase URL — fine for a two-person chore list. Want it locked down further? Turn on
  **Anonymous Auth** in Firebase and tighten the rules (a one-line change noted in
  `firebase.rules.json`).
- **iOS web notifications** are limited, so reminders aren't built in here (the native app has them).
  Adding the app to your home screen gives you the full-screen, offline experience.
- **Updating a hosted version:** the service worker serves the cached app first and refreshes in the
  background, so changes appear on the next open. To force an immediate update, bump `CACHE` in
  `service-worker.js`.

🐾 *Roo HQ — a calm weekly plan for two, and one very good dog.*
