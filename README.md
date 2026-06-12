# IronLog 🏋️

**A local-first workout tracker for serious lifters.**

IronLog stores everything on your device — no account, no cloud, no subscriptions. Just fast, focused workout logging.

---

## Features

- **Fast set logging** — log a set in under two seconds
- **Smart rest timer** — auto-starts after every completed set
- **Multiple set types** — Working, Warm-up, AMRAP, Drop Set, Failure, Tempo, Assisted, Partial
- **34 built-in exercises** + unlimited custom exercises
- **Auto PR detection** — weight and estimated 1RM records tracked automatically
- **Analytics** — weekly volume charts, muscle group breakdown, PR leaderboard
- **Full history** — every workout saved with all sets, volume, and duration
- **Data export** — JSON backup and CSV export
- **PWA** — install on your phone's home screen and use offline

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Styling | Tailwind CSS v3 |
| State | Zustand (with localStorage persistence) |
| Database | IndexedDB via Dexie.js |
| Charts | Recharts |
| Build | Vite + vite-plugin-pwa |
| PWA | Workbox (auto service worker) |

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+

### Install & Run

```bash
# Clone or download the project
cd ironlog

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

The production build is output to `dist/`. It's a fully static site — deploy it anywhere.

---

## Deployment

### Option 1: Netlify (easiest)

1. Run `npm run build`
2. Drag the `dist/` folder to [netlify.com/drop](https://netlify.com/drop)
3. Done — your app is live

Or connect your GitHub repo and set:
- **Build command:** `npm run build`
- **Publish directory:** `dist`

### Option 2: Vercel

```bash
npm i -g vercel
vercel --prod
```

### Option 3: GitHub Pages

```bash
# Install gh-pages
npm install -D gh-pages

# Add to package.json scripts:
# "deploy": "gh-pages -d dist"

npm run build && npm run deploy
```

### Option 4: Self-host (nginx)

```bash
npm run build

# Copy dist/ to your web server
rsync -av dist/ user@yourserver:/var/www/ironlog/
```

nginx config:
```nginx
server {
    listen 80;
    root /var/www/ironlog;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option 5: Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Installing as a PWA (Mobile)

IronLog is a Progressive Web App — install it on your phone for a native app experience:

**iOS (Safari):**
1. Open the app URL in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"

**Android (Chrome):**
1. Open the app URL in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home Screen" or "Install App"
4. Tap "Install"

Once installed, IronLog works fully offline.

---

## Project Structure

```
ironlog/
├── src/
│   ├── db/            # Dexie.js database + seeding
│   ├── store/         # Zustand state (active workout, navigation)
│   ├── types/         # TypeScript types
│   ├── utils/         # Helpers (1RM, formatting, IDs)
│   ├── pages/
│   │   ├── Dashboard.tsx       # Home screen with stats
│   │   ├── WorkoutPage.tsx     # Active workout logger
│   │   ├── HistoryPage.tsx     # Past workouts
│   │   ├── ExercisesPage.tsx   # Exercise library
│   │   ├── AnalyticsPage.tsx   # Charts and PRs
│   │   └── SettingsPage.tsx    # Export, import, clear data
│   └── components/
│       └── common/
│           ├── BottomNav.tsx   # Navigation bar
│           ├── RestTimer.tsx   # Floating rest countdown
│           └── ExercisePicker.tsx
├── public/            # Icons and static assets
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## Data & Privacy

All data is stored in your browser's **IndexedDB**. Nothing is sent to any server.

- **Backup:** Settings → Export Backup (JSON) — save this file somewhere safe
- **Restore:** Settings → Import Backup — select your JSON file
- **CSV Export:** Settings → Export as CSV — open in Excel/Sheets
- **Clear data:** Settings → Danger Zone

> ⚠️ Clearing browser data or uninstalling the PWA will delete your workout history. **Export a backup regularly.**

---

## Customization

### Add exercises
Go to the Exercises tab → tap "+ New" to create custom exercises with your own categories and equipment tags.

### Change units
Currently kg only. To switch to lbs: in `src/utils/index.ts`, multiply `weight` by `2.20462` in `formatWeight()` and update display labels.

### Default rest times
In `src/pages/WorkoutPage.tsx`, edit the `DEFAULT_REST` object:
```ts
const DEFAULT_REST: Record<string, number> = {
  warmup: 60,    // seconds
  working: 120,
  failure: 180,
  // ...
};
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at localhost:5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

---

## License

MIT — use it however you like.
