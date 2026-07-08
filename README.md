# Vaneet — Full-Stack Portfolio

A full-stack version of the portfolio: a static glass-UI frontend served by a small
Express backend, with a **real working contact form** backed by a REST API.

```
portfolio-fullstack/
├── server.js          # Express app: static hosting + API routes
├── package.json
├── .env.example       # copy to .env and fill in your own values
├── data/
│   └── messages.json  # contact-form submissions get stored here
└── public/
    ├── index.html      # the portfolio site
    ├── admin.html       # simple inbox to view submissions
    └── assets/
        └── vaneet.jpg
```

## What's "full stack" about it

- **Frontend**: the portfolio site (`public/index.html`) — same glassy design, but the
  contact form now really submits.
- **Backend**: `server.js`, an Express server exposing:
  - `POST /api/contact` — validates and saves a message (name, email, message), with a
    honeypot field and rate limiting against spam, and can optionally email you a
    notification.
  - `GET /api/messages?key=YOUR_ADMIN_KEY` — lists saved messages, protected by a secret
    key so randoms can't read your inbox.
  - `GET /api/health` — basic health check.
- **Storage**: submissions are saved to `data/messages.json`. That's enough for a personal
  site; swap it for a real database (Postgres, MongoDB, etc.) later if you outgrow it —
  the API surface stays the same.

## Run it locally

You'll need [Node.js](https://nodejs.org) 18 or later.

```bash
cd portfolio-fullstack
npm install
cp .env.example .env      # then edit .env — at minimum, set your own ADMIN_KEY
npm start
```

Open **https://portfolio-2-fca1.onrender.com** — that's your portfolio.
Open **http://localhost:3000/admin.html?key=YOUR_ADMIN_KEY** to see submitted messages.

## Getting an email whenever someone messages you (optional)

By default, messages are just saved to `data/messages.json` — nothing else is required.
If you also want an email notification, fill in the SMTP section of `.env`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password     # Gmail: create an "App Password", not your real password
NOTIFY_TO=vaneetpathania01@gmail.com
```

If these are left blank, the server just skips sending email — the form still works and
still saves the message.

## Deploying it

This is a plain Node/Express app, so it runs on any of these with almost no changes:

- **Render** — "New Web Service" → connect your repo → build command `npm install`,
  start command `npm start`. Add your `.env` values under Environment.
- **Railway** — similar: connect repo, it detects Node automatically, add env vars.
- **Fly.io / a VPS** — `npm install && npm start` behind a process manager like `pm2`.

One thing to know: on most free hosting tiers the filesystem is *not* persistent between
deploys/restarts, so `data/messages.json` can get wiped. For a production deployment,
point the storage at a real database instead — the two functions to change are
`readMessages()` and `writeMessages()` in `server.js`; everything else stays the same.

## Security notes

- Change `ADMIN_KEY` in `.env` before deploying — the default is not a secret.
- The contact endpoint is rate-limited (10 requests / 15 minutes per IP) and has a
  honeypot field to cut down on spam and abuse.
- Never commit your real `.env` file — it's already in `.gitignore`.
