# Singing Trainer

A web app that helps complete beginners learn to sing in tune. You hear a note, sing it back, and see your pitch live on a graph. The app scores how closely you matched it and tells you whether to aim higher or lower. Log in to save your scores and track your progress over time.

Live at [singing-app-zeta.vercel.app](https://singing-app-zeta.vercel.app).

## Features

- **Match the note.** Hear a reference note, sing it for 5 seconds, and get a score with plain-language feedback ("you were a bit too high, so aim lower").
- **Live pitch graph.** Your voice is drawn against a green target band as you sing. It turns green when you're in tune and amber when you're not, and freezes on your result.
- **Difficulty levels.** Beginner, intermediate and advanced set how close counts as in tune (±20, ±15 or ±10 cents).
- **Voice range.** Pick a lower voice (A2–A3) or a higher voice (A3–A4) so the notes suit you. Singing in a different octave still counts.
- **Optional accounts.** Anyone can practise without signing up. Log in with email and password to save every scored try.
- **Progress page.** Your day streak, average and best scores, accuracy over the last 30 days, whether you tend to sing too high or too low, how you do on the low, middle and high notes of your range, and your latest tries.
- **Private by design.** Pitch detection runs entirely in your browser, so your audio never leaves your device. Only scores are saved.
- **Works on phones,** including iPhone Safari.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4
- Web Audio API with [pitchy](https://github.com/ianprime0509/pitchy) for pitch detection
- [smplr](https://github.com/danigb/smplr) for the sung reference notes
- [Supabase](https://supabase.com) for accounts and the database (Postgres with Row Level Security)
- [Vercel](https://vercel.com) for hosting

## Running it locally

You need Node.js 20 or later and a free Supabase project.

1. **Install the dependencies.**

   ```bash
   npm install
   ```

2. **Add your Supabase keys.** Copy `.env.example` to `.env.local` and fill in both values from your Supabase project's **Project Settings → API Keys**:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   `.env.local` is ignored by git, so your keys stay on your machine.

3. **Create the database table.** In Supabase, open the **SQL Editor**, paste in the contents of `supabase/migrations/20261021120000_create_attempts.sql` and run it. This creates the `attempts` table and the security rules that keep each user's data private.

4. **Set up sign-in.** Under **Authentication** in Supabase:
   - **URL Configuration:** add `http://localhost:3000/auth/confirm` to **Redirect URLs**.
   - **Sign In / Providers → Email:** turn off **Confirm email** while developing. Supabase's built-in email only delivers to your own project team. For real users, set up your own email service under **Emails → SMTP Settings** and turn confirmation back on.

5. **Start the app.**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) and allow microphone access when asked.

### Commands

```bash
npm run dev     # development server at http://localhost:3000
npm run build   # production build
npm run lint    # check the code with ESLint
```

## Deploying

The app is deployed on Vercel, which builds and deploys automatically whenever `main` changes. Pull requests get their own preview links.

To deploy your own copy:

1. Import the GitHub repository into Vercel. It detects Next.js automatically.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under **Settings → Environment Variables**.
3. In Supabase, set the **Site URL** to your Vercel address and add `https://<your-address>/auth/confirm` to **Redirect URLs**.

To use a custom domain such as `sing.example.com`, add it in Vercel under **Settings → Domains**, then create the CNAME record Vercel shows you with your DNS provider. On Cloudflare, set the record to **DNS only** (grey cloud).

## Project structure

```
app/
  page.tsx              Match-the-note exercise (home page)
  progress/             Progress page (logged-in users only)
  login/, signup/       Log-in and sign-up pages
  auth/                 Sign-in Server Actions and the email confirmation route
  actions.ts            Saves a scored try for the logged-in user
components/             Pitch graph, accuracy chart, switches, log-in form
lib/
  audio/                Pitch detection, reference notes, difficulty levels, note maths
  exercises/            Scoring, voice ranges and progress statistics (plain TypeScript)
  supabase/             Supabase clients for the browser, server and proxy
proxy.ts                Refreshes the login session and protects /progress
supabase/migrations/    Database schema
```

## Good to know

- **Headphones help.** The mic is closed while the reference note plays, but headphones still give the cleanest readings.
- **The first note can take a moment.** The voice samples download the first time you use the app.
- **Free Supabase projects pause** after about a week without activity. Un-pause yours from the Supabase dashboard if the app stops saving.
