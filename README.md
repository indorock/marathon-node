# Marathon Countdown — Node/Express

Node.js/Express port of the PHP marathon training countdown app. Uses SQLite (via the built-in `node:sqlite` module) instead of XML files.

## Requirements

- Node.js 22.5+ (uses built-in `node:sqlite`)
- The original `marathon/` sibling directory must exist (for seeding)

## Setup

```bash
npm install
npm run seed    # imports XML data into SQLite
npm start       # http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

## URL parameters

| Param | Example | Description |
|-------|---------|-------------|
| `trainingplan` | `?trainingplan=pfitz-70-18` | Select training program |
| `raceday` | `?raceday=1-3-2026` | Override race date (d-m-Y) |

## Structure

```
marathon-node/
├── app.js              # Express entry point
├── db/
│   ├── database.js     # SQLite connection & schema
│   └── seed.js         # Imports XML → SQLite
├── lib/
│   └── countdown.js    # Core countdown logic
├── routes/
│   ├── index.js        # GET /
│   └── calendar.js     # GET /calendar
├── views/
│   ├── index.ejs       # Main countdown view
│   └── calendar.ejs    # Full calendar view
└── public/             # CSS, JS, images
```
