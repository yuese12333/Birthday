require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3001);
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_SECURE = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_ADDRESS = process.env.FROM_ADDRESS || SMTP_USER || 'yuese12333@qq.com';

// Fixed recipients as requested
const RECIPIENTS = {
  'to-him': '2352455@tongji.edu.cn',
  'to-me': '2352456@tongji.edu.cn',
};

const app = express();
app.use(cors());
app.use(express.json({ limit: '200kb' }));

let transporter = null;
let usingEthereal = false;

async function initTransporter() {
  try {
    if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
      const transportOpts = {
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      };
      transporter = nodemailer.createTransport(transportOpts);
      await transporter.verify();
      console.log('[emailServer] SMTP transporter verified');
    } else {
      console.warn(
        '[emailServer] SMTP not fully configured - falling back to Nodemailer test account (ethereal)'
      );
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      usingEthereal = true;
      console.log(
        '[emailServer] Using ethereal test account. Preview URL will be returned in responses.'
      );
    }
  } catch (err) {
    console.warn(
      '[emailServer] transporter init/verify failed (server will still run):',
      err && err.message ? err.message : err
    );
    try {
      transporter =
        transporter ||
        nodemailer.createTransport({
          host: SMTP_HOST || '127.0.0.1',
          port: SMTP_PORT || 587,
          secure: SMTP_SECURE,
          auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
        });
    } catch (e) {
      console.warn(
        '[emailServer] fallback transport creation failed:',
        e && e.message ? e.message : e
      );
    }
  }
}

initTransporter().catch((e) =>
  console.warn('[emailServer] initTransporter error:', e && e.message ? e.message : e)
);

app.get('/health', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// POST /send-egg
// body: { type: 'to-him'|'to-me', subject?: string, message: string }
app.post('/send-egg', async (req, res) => {
  try {
    // ensure transporter ready (init on-demand if previous async init hasn't completed)
    if (!transporter) {
      await initTransporter();
    }
    if (!transporter) {
      return res.status(500).json({
        ok: false,
        error: 'Mail transporter not available. Check SMTP settings or server logs.',
      });
    }
    const { type, subject, message } = req.body || {};
    if (!type || !RECIPIENTS[type]) {
      return res.status(400).json({ ok: false, error: 'Invalid type. Allowed: to-him, to-me' });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'message is required' });
    }

    const to = RECIPIENTS[type];
    const mailOptions = {
      from: FROM_ADDRESS,
      to,
      subject:
        subject && typeof subject === 'string' && subject.trim().length
          ? subject.trim()
          : type === 'to-him'
          ? '一句话给他'
          : '写给自己的话',
      text: message,
      html: `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(message)}</div>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[emailServer] Sent mail', {
      to,
      subject: mailOptions.subject,
      message: String(message).slice(0, 120),
      messageId: info && info.messageId,
    });

    const response = {
      ok: true,
      info: { messageId: info && info.messageId, accepted: info && info.accepted },
    };
    if (usingEthereal && info) {
      // generate preview URL for ethereal
      const preview = nodemailer.getTestMessageUrl(info);
      if (preview) response.info.preview = preview;
    }
    res.json(response);
  } catch (err) {
    console.error('[emailServer] send failed', err);
    res.status(500).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.listen(PORT, HOST, () => {
  console.log(`[emailServer] Listening on http://${HOST}:${PORT} (FROM=${FROM_ADDRESS})`);
});
