// server.js — backend for Vaneet's portfolio
// Serves the static frontend and exposes a small REST API:
//   POST /api/contact        -> save a message from the contact form (+ optional email notification)
//   GET  /api/messages?key=  -> list saved messages (protected by ADMIN_KEY)
//   GET  /api/health         -> simple health check

require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // required behind Render/any reverse proxy so express-rate-limit reads the real client IP correctly
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me';
const DATA_FILE = path.join(__dirname, 'data', 'messages.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------- helpers --------
async function readMessages() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeMessages(messages) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(messages, null, 2), 'utf-8');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Optional email notification via nodemailer — only runs if SMTP env vars are set.
async function sendEmailNotification(entry) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.NOTIFY_TO) {
    return { sent: false, reason: 'SMTP not configured' };
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: `"Portfolio Contact Form" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_TO,
      replyTo: entry.email,
      subject: `New portfolio message from ${entry.name}`,
      text: entry.message,
      html: `<p><strong>From:</strong> ${entry.name} (${entry.email})</p><p>${entry.message.replace(/\n/g, '<br>')}</p>`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Email notification failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

// -------- rate limiting for the public contact endpoint --------
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many messages sent. Please try again later.' },
});

// -------- routes --------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, message, company } = req.body || {};

    // honeypot field — real users never fill this in, bots often do
    if (company) {
      return res.status(200).json({ success: true });
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are all required.' });
    }
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Please enter a valid name.' });
    }
    if (!isValidEmail(email) || email.length > 200) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (typeof message !== 'string' || message.trim().length < 10 || message.length > 3000) {
      return res.status(400).json({ error: 'Message should be at least 10 characters.' });
    }

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    const messages = await readMessages();
    messages.push(entry);
    await writeMessages(messages);

    const emailResult = await sendEmailNotification(entry);

    res.status(201).json({ success: true, emailSent: emailResult.sent });
  } catch (err) {
    console.error('POST /api/contact failed:', err);
    res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
  }
});

app.get('/api/messages', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const messages = await readMessages();
  res.json({ count: messages.length, messages: messages.slice().reverse() });
});

app.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
  console.log(`Admin view:  http://localhost:${PORT}/admin.html?key=${ADMIN_KEY}`);
});
