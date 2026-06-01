# Owner's Manual — plain-English guide to this project

You don't need to be a coder to follow this. This explains **what you're building, how the
pieces fit, what's done, how to click around, and what every scary word means.** Read top to
bottom once; after that, use it as a reference.

---

## 1. What you're building (in one breath)

A tool for small local service businesses (your first target: **mobile detailers**) that makes
sure they **never lose a customer to a missed call.** When someone calls and the owner can't
pick up, the system automatically texts the caller back, saves a voicemail + a written version
of it, and shows the owner a tidy "call this person back" list on their phone.

**The promise:** every missed call becomes a saved lead the owner can act on — instead of a lost job.

---

## 2. The 30-second story of how it works

1. A customer calls the detailer's business number.
2. The detailer is under a truck and doesn't answer.
3. The system **auto-texts** the caller: "Sorry we missed you — reply here and we'll get right back to you."
4. If the caller leaves a voicemail, the system **records it and writes it down** (a transcript).
5. The owner gets a **lead** in the app: who called, what they want, and whether they've texted back.
6. The owner taps **Call** or **Text** and wins the job.

That whole loop is "the pipeline." Everything we're building serves that loop.

---

## 3. The pieces, explained like a house

Think of the product as a house being built:

- **The phone line (Twilio)** = the front door and doorbell. Twilio is the company that gives you
  a real phone number and tells our app "a call just came in / a text just arrived."
- **The backend (the `web/` folder)** = the wiring and plumbing inside the walls. It receives the
  calls/texts, decides what to do, and stores the info. You don't see it; it makes things work.
- **The database (Supabase)** = the filing cabinet. Where leads/calls/texts are **saved
  permanently.** (Not hooked up yet — see §4.)
- **The owner app (the future web screens)** = the rooms you actually live in. The phone screens
  the detailer taps every day.
- **The Windows dashboard (`archive/dashboard-winforms/` folder)** = a **show home / model unit.** It looks great
  and proved what the rooms should feel like, but it's a demo — it isn't wired to the plumbing.
  It's "frozen" (we're not changing it anymore).

---

## 4. What's done vs. not (honest version)

**Done and working (in test mode):**
- ✅ The phone-call logic: detect a missed call, auto-text the caller, take a voicemail, write it down.
- ✅ Texts from customers get attached to the right person.
- ✅ A "callback" task is created for each missed call.
- ✅ A **clickable demo page** so you can try all of the above in your browser (see §5).

**Not done yet:**
- ⛔ **Saving data permanently** (Supabase not connected) — so test leads vanish when you restart.
- ⛔ **The real owner phone screens** (a polished list + lead detail).
- ⛔ **Real texting/calling turned on** — everything is in safe "sandbox" mode right now.
- ⛔ **AI summaries** of voicemails (a later upgrade).
- ⛔ **Hooking up a real phone number** for a real detailer.

**Translation:** the hard engine works in a test harness. Next we make it *visible and permanent*,
then point a real phone number at it for one detailer.

---

## 5. How to open the clickable demo

You already did this once — here's the repeatable version.

**One-time fix (if PowerShell blocks it):** if you see a red `npm.ps1 cannot be loaded` error, run
this once:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```
(Press `Y`. This is safe — it just lets your own tools run.)

**Start it:**
```powershell
cd "B:\BAckend Prjct\files\web"
npm install      # only needed the first time
npm run dev
```
Then open your browser to **http://localhost:3000**.

**Use it:** click **📞 Missed call + voicemail** and watch a lead appear on the left. Click the
lead to see the call, the voicemail transcript, and any texts. Try **💬 Customer texts back**.

**Stop it:** click the terminal window and press **Ctrl + C** (twice if it doesn't stop the first time).

> Note: auto-texts will say **"not sent (sandbox)"**. That's correct and on purpose — we have real
> texting switched OFF so nothing goes to real people during testing.

---

## 6. Who does what (your team)

- **You** = the founder. You decide what to build, test the clicky parts, and talk to customers.
  You don't need to write code.
- **Claude (me)** = the designer + planner + the person who builds the screens and writes the
  plans/specs. I own how it looks and the product direction.
- **Codex** = the engineer. It writes the backend code (the plumbing) from the task lists I prepare.
- **ChatGPT** = your outside strategy advisor (no access to the code).

When I say "give Codex this prompt," you're handing the engineer its next work order.

---

## 7. Glossary (every scary word, plain)

- **Frontend** — the part you see and click (screens). **Backend** — the hidden part that does the work.
- **Supabase** — the online **database** (filing cabinet) where data is saved permanently. Not connected yet.
- **Twilio** — the company that provides the **phone number** and tells our app about calls/texts.
- **Webhook** — an automatic "ping" Twilio sends our backend the instant a call/text happens.
  (Like a doorbell wire.)
- **API** — a set of doorways our app uses to ask for or send data. A **read API** = the doorways
  that *fetch* info (e.g., "give me the list of leads").
- **Sandbox / sandbox mode** — safe practice mode. Nothing real is sent; nothing can reach a real
  customer. We build everything here first.
- **Next.js** — the toolkit the `web/` app is built with (runs both the screens and the backend).
- **Repo (repository)** — the project's folder of all code + history, stored on GitHub.
- **Commit / push** — *commit* = save a labeled snapshot of changes; *push* = upload it to GitHub.
  (I do these for you.)
- **Migration** — an instruction that sets up/updates the database's structure (the filing cabinet's drawers).
- **Lead / profile** — a customer record. Same thing here; one per phone number.
- **Transcript** — the written-out text of a voicemail.
- **Callback task** — a to-do the system creates: "call this person back."
- **A2P 10DLC** — the (annoying but required) US registration that lets a business legally text
  customers. Without it, texts get blocked. We'll register it before going live for real.
- **E.164** — the "+15551234567" standard format for phone numbers.

---

## 8. What's in your repo (the folders)

- `web/` — **the real product backend** (and the clickable demo). This is where active work happens.
- `archive/` — **old versions, tucked away** (see `archive/README.md`). The frozen Windows demo (`archive/dashboard-winforms/`) and the retired Python backend (`archive/legacy/backend-python/`). Not part of the live product.
- `AI_RULES.md` — the rules the AI helpers must follow.
- `SPEC.md` — the detailed product specification.
- `TASKS.md` — the master to-do list (the `BACKEND-xx` tasks Codex works through).
- `CHANGELOG_AI.md` — a running log of every change made. Newest at the top. Read this to see
  "what happened recently."
- `web/OWNER_UX.md` — the spec for the future owner phone screens.
- `USER_MANUAL.md` — this file. 🙂

---

## 9. What to do next (cheat sheet)

1. **Now:** hand Codex the **BACKEND‑13 → 15** prompt (from the chat). That builds the part that
   lists leads properly.
2. **Then (me):** I connect the clickable demo to that, and build the two real owner screens.
3. **Then (Codex):** connect **Supabase** so data is saved permanently.
4. **Then:** register a real phone number + **A2P 10DLC**, point it at the app, and pilot with one
   real detailer for free for ~2 weeks.
5. **Then:** show them "here are the leads you would've lost" → ask for the money.

---

## 10. When you feel stuck

- You never have to read code. Ask me "what does this mean / what's next / is this normal?"
- To see what changed recently: open `CHANGELOG_AI.md` (top = newest).
- If a command errors, paste the red text to me — I'll translate and fix it.
- "Sandbox" everywhere means **you can't break anything real.** Click freely.
