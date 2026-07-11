import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';
import pool, { initDb } from './db.js';
import { scrapeWhois } from './scraper.js';
import { startNotificationScheduler, checkExpirationsAndNotify } from './notifier.js';

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_DAYS = 30;
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES || '10');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ─── Password Encryption / Decryption Helpers ─────────────────────────────────
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const SECRET_KEY_RAW = process.env.SERVER_ENCRYPTION_SECRET || 'whois_tracker_default_secret_32_bytes_key_!@#';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(SECRET_KEY_RAW).digest();
const IV_LENGTH = 16;

function encryptPassword(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptPassword(encryptedText) {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt password:', err.message);
    return encryptedText;
  }
}

// ─── Email / OTP Helpers ───────────────────────────────────────────────────────
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000
});

const EMAIL_FROM = process.env.EMAIL_FROM || '"DomainWhois" <noreply@example.com>';
const EMAIL_CONFIGURED = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS &&
  process.env.EMAIL_HOST !== 'smtp.example.com');

function generateOTP() {
  return String(crypto.randomInt(100000, 999999));
}

async function sendOTPEmail(toEmail, otp, purpose) {
  // Try sending via Kirisan API first if configured
  let kirisanToken = '';
  let kirisanChannelKey = '';
  let kirisanLoginOtpTemplateId = '';
  let kirisanRegisterOtpTemplateId = '';
  let kirisanResetPasswordTemplateId = '';

  try {
    const settingsRes = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('kirisan_token', 'kirisan_channel_key', 'kirisan_login_otp_template_id', 'kirisan_register_otp_template_id', 'kirisan_reset_password_template_id')"
    );
    const dbSettings = {};
    settingsRes.rows.forEach(r => {
      dbSettings[r.setting_key] = r.setting_value;
    });
    kirisanToken = dbSettings['kirisan_token'] || '';
    kirisanChannelKey = dbSettings['kirisan_channel_key'] || '';
    kirisanLoginOtpTemplateId = dbSettings['kirisan_login_otp_template_id'] || '';
    kirisanRegisterOtpTemplateId = dbSettings['kirisan_register_otp_template_id'] || '';
    kirisanResetPasswordTemplateId = dbSettings['kirisan_reset_password_template_id'] || '';
  } catch (dbErr) {
    console.error('Error fetching Kirisan settings for OTP:', dbErr.message);
  }

  // Choose appropriate template ID based on purpose (login, register, or reset-password)
  const isLogin = purpose === 'login';
  const isReset = purpose === 'reset-password';
  let selectedTemplateId = isLogin 
    ? kirisanLoginOtpTemplateId 
    : isReset 
      ? kirisanResetPasswordTemplateId 
      : kirisanRegisterOtpTemplateId;

  // Fallback to login template if register/verify template is not configured
  if (!selectedTemplateId && !isReset) {
    selectedTemplateId = kirisanLoginOtpTemplateId;
  }

  if (kirisanToken && kirisanChannelKey && selectedTemplateId) {
    console.log(`[Notifier] Sending OTP email via Kirisan API (purpose: ${purpose})...`);
    try {
      const kirisanRes = await fetch('https://api.kirisan.com/v1/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${kirisanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keys: {
            email: {
              token: kirisanChannelKey
            }
          },
          target: {
            email: toEmail,
            variables: {
              otp: otp,
              code: otp,
              purpose: purpose,
              expiry_minutes: OTP_EXPIRES_MINUTES
            }
          },
          content: {
            email: {
              template: parseInt(selectedTemplateId, 10)
            }
          }
        })
      });

      if (kirisanRes.ok) {
        const resData = await kirisanRes.json();
        if (resData.status) {
          console.log('[Notifier] OTP Email successfully sent via Kirisan!');
          return { ok: true };
        } else {
          console.error('[Notifier] Failed to send OTP via Kirisan:', resData.reason);
        }
      } else {
        const errBody = await kirisanRes.text();
        console.error('[Notifier] Kirisan API error sending OTP. Status:', kirisanRes.status, errBody);
      }
    } catch (err) {
      console.error('[Notifier] Kirisan API Error sending OTP:', err.message);
    }
    console.log('[Notifier] Kirisan OTP delivery failed or skipped, falling back to SMTP.');
  }

  if (!EMAIL_CONFIGURED) {
    return { ok: true, fallback: true };
  }

  const subject = isLogin 
    ? 'Kode OTP Login — DomainWhois' 
    : isReset 
      ? 'Reset Password — DomainWhois'
      : 'Verifikasi Email — DomainWhois';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="margin:0 0 8px;font-size:18px;color:#111">
        ${isLogin ? '🔐 Kode Login Anda' : isReset ? '🔑 Reset Password Anda' : '✉️ Verifikasi Email Anda'}
      </h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
        ${isLogin ? 'Masukkan kode berikut untuk menyelesaikan proses login.' : isReset ? 'Masukkan kode berikut untuk mereset kata sandi akun Anda.' : 'Masukkan kode berikut untuk memverifikasi alamat email Anda.'}
      </p>
      <div style="background:#f9fafb;border:2px dashed #e5e7eb;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#111;font-family:monospace">${otp}</span>
      </div>
      <p style="margin:0;color:#9ca3af;font-size:12px">Kode berlaku selama <strong>${OTP_EXPIRES_MINUTES} menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
    </div>`;

  try {
    await emailTransporter.sendMail({ from: EMAIL_FROM, to: toEmail, subject, html });
    return { ok: true };
  } catch (err) {
    console.error(`Failed to send OTP email (${purpose}):`, err.message);
    return { ok: false, error: err.message };
  }
}

async function setUserOTP(userId, purpose) {
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
  await pool.query(
    `UPDATE app_users SET otp_code=$1, otp_expires_at=$2, otp_purpose=$3, otp_last_sent_at=NOW() WHERE id=$4`,
    [otp, expiresAt, purpose, userId]
  );
  return otp;
}

async function verifyUserOTP(userId, inputOtp, expectedPurpose) {
  const res = await pool.query(
    `SELECT otp_code, otp_expires_at, otp_purpose FROM app_users WHERE id=$1`,
    [userId]
  );
  if (res.rows.length === 0) return { ok: false, reason: 'User tidak ditemukan' };
  const { otp_code, otp_expires_at, otp_purpose } = res.rows[0];
  if (otp_purpose !== expectedPurpose) return { ok: false, reason: 'Tipe OTP tidak cocok' };
  if (!otp_code || new Date() > new Date(otp_expires_at)) return { ok: false, reason: 'OTP sudah kedaluwarsa' };
  if (otp_code !== String(inputOtp).trim()) return { ok: false, reason: 'Kode OTP salah' };
  // Invalidate after use
  await pool.query(`UPDATE app_users SET otp_code=NULL, otp_expires_at=NULL WHERE id=$1`, [userId]);
  return { ok: true };
}


async function logActivity(userId, action, details) {
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO activity_logs (id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [id, userId, action, details || null]
    );
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}

initDb()
  .then(() => {
    console.log('Database initialization check complete.');
    startNotificationScheduler();
  })
  .catch((err) => console.error('Failed to initialize database tables:', err));

// ─── Database-backed Session Verification (Local Auth) ────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const result = await pool.query(
      `SELECT s.user_id, u.email, COALESCE(u.role, 'user') as role
       FROM app_sessions s
       JOIN app_users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.user = { 
      id: result.rows[0].user_id, 
      email: result.rows[0].email, 
      role: result.rows[0].role 
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ─── Local Auth Endpoints (OTP-based & Turnstile-ready) ─────────────────────

// Helper: Verify Cloudflare Turnstile token
async function verifyTurnstile(token, ip) {
  try {
    const settingsRes = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('turnstile_enabled', 'turnstile_secret_key')"
    );
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });

    if (settings['turnstile_enabled'] !== 'true') return { ok: true };
    if (!token) return { ok: false, error: 'Validasi CAPTCHA (Turnstile) wajib diisi.' };

    const secret = settings['turnstile_secret_key'];
    if (!secret) {
      console.warn('[Turnstile] Enabled but turnstile_secret_key is empty!');
      return { ok: true };
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secret,
        response: token,
        remoteip: ip || ''
      })
    });
    const data = await res.json();
    return { ok: !!data.success, error: data.success ? null : 'Validasi CAPTCHA gagal. Silakan coba lagi.' };
  } catch (err) {
    console.error('[Turnstile] Verification error:', err.message);
    return { ok: true }; // Fail-safe: allow if Cloudflare is down
  }
}

// GET /api/auth/config — Public config for registration, Turnstile, and Brand settings
app.get('/api/auth/config', async (req, res) => {
  try {
    const settingsRes = await pool.query(
      "SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('registration_enabled', 'turnstile_enabled', 'turnstile_site_key', 'brand_name', 'brand_logo')"
    );
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });

    res.json({
      registrationEnabled: settings['registration_enabled'] !== 'false',
      turnstileEnabled: settings['turnstile_enabled'] === 'true',
      turnstileSiteKey: settings['turnstile_site_key'] || '',
      brandName: settings['brand_name'] || 'DomainWhois',
      brandLogo: settings['brand_logo'] || ''
    });
  } catch (err) {
    console.error('Error fetching public config:', err.message);
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

// Helper: create session and return token
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO app_sessions (id, user_id, token, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionId, userId, token, expiresAt]
  );
  return { token, expiresAt };
}

// POST /api/auth/sign-up — Step 1: create pending account, send OTP
app.post('/api/auth/sign-up', async (req, res) => {
  const { email, password, name, turnstileToken } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });
  if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter' });

  try {
    // 1. Check registration enabled setting
    const regEnabledRes = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'registration_enabled'");
    const regEnabled = regEnabledRes.rows[0]?.setting_value !== 'false';
    const countRes = await pool.query("SELECT COUNT(*) FROM app_users WHERE is_verified = TRUE");
    const isFirstUser = parseInt(countRes.rows[0].count) === 0;

    if (!isFirstUser && !regEnabled) {
      return res.status(403).json({ error: 'Pendaftaran akun baru telah dinonaktifkan oleh administrator.' });
    }

    // 2. Verify Turnstile token
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const turnstileCheck = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileCheck.ok) {
      return res.status(400).json({ error: turnstileCheck.error });
    }

    const existing = await pool.query(
      'SELECT id, is_verified FROM app_users WHERE email = $1',
      [email.toLowerCase()]
    );

    let userId;
    let role;

    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.is_verified) {
        return res.status(409).json({ error: 'Akun dengan email ini sudah terdaftar' });
      }
      // Unverified → allow re-registration (update password and resend OTP)
      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query(
        'UPDATE app_users SET password_hash=$1, name=$2 WHERE id=$3',
        [passwordHash, name || email.split('@')[0], existingUser.id]
      );
      userId = existingUser.id;
      const countRes2 = await pool.query("SELECT COUNT(*) FROM app_users WHERE is_verified = TRUE");
      role = parseInt(countRes2.rows[0].count) === 0 ? 'admin' : 'user';
    } else {
      const countRes2 = await pool.query("SELECT COUNT(*) FROM app_users WHERE is_verified = TRUE");
      role = parseInt(countRes2.rows[0].count) === 0 ? 'admin' : 'user';
      const passwordHash = await bcrypt.hash(password, 10);
      userId = crypto.randomUUID();
      await pool.query(
        'INSERT INTO app_users (id, email, password_hash, name, role, is_verified) VALUES ($1, $2, $3, $4, $5, FALSE)',
        [userId, email.toLowerCase(), passwordHash, name || email.split('@')[0], role]
      );
    }

    const otp = await setUserOTP(userId, 'verify');
    const emailResult = await sendOTPEmail(email.toLowerCase(), otp, 'verify');

    res.status(200).json({
      step: 'otp-verify',
      userId,
      message: emailResult.ok
        ? `Kode OTP telah dikirim ke ${email}. Berlaku ${OTP_EXPIRES_MINUTES} menit.`
        : `Kode OTP telah dibuat untuk ${email}. Email gagal dikirim, tetapi Anda dapat menggunakan kode berikut: ${otp}`,
      debugOtp: emailResult.ok ? null : otp
    });
  } catch (err) {
    console.error('Sign-up error:', err.message);
    res.status(500).json({ error: 'Gagal membuat akun' });
  }
});

// POST /api/auth/verify-email — Step 2: verify OTP after registration
app.post('/api/auth/verify-email', async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) return res.status(400).json({ error: 'userId dan otp wajib diisi' });

  try {
    const result = await verifyUserOTP(userId, otp, 'verify');
    if (!result.ok) return res.status(400).json({ error: result.reason });

    // Mark as verified locally
    await pool.query('UPDATE app_users SET is_verified=TRUE WHERE id=$1', [userId]);

    // Sync to Neon Auth if it exists and id is a valid UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_REGEX.test(userId)) {
      try {
        const schemaCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.schemata WHERE schema_name = 'neon_auth'
          )
        `);
        if (schemaCheck.rows[0].exists) {
          await pool.query('UPDATE neon_auth.user SET "emailVerified"=TRUE, "updatedAt"=NOW() WHERE id=$1', [userId]);
        }
      } catch (neonErr) {
        console.warn('Neon Auth verify email sync warning (non-fatal):', neonErr.message);
      }
    }

    const userRes = await pool.query('SELECT id, email, name, role FROM app_users WHERE id=$1', [userId]);
    const user = userRes.rows[0];
    const session = await createSession(userId);
    await logActivity(userId, 'Sign Up', `Akun berhasil dibuat dan diverifikasi sebagai ${user.role}`);

    res.status(201).json({ session, user });
  } catch (err) {
    console.error('Verify-email error:', err.message);
    res.status(500).json({ error: 'Gagal verifikasi email' });
  }
});

// GET /api/auth/invitation-info - Get info about an invitation token
app.get('/api/auth/invitation-info', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  try {
    const result = await pool.query(
      'SELECT email, name, role, expires_at FROM app_invitations WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Undangan tidak ditemukan atau tidak valid' });
    }

    const invite = result.rows[0];
    if (new Date() > new Date(invite.expires_at)) {
      return res.status(410).json({ error: 'Undangan telah kedaluwarsa' });
    }

    res.json({
      email: invite.email,
      name: invite.name,
      role: invite.role
    });
  } catch (err) {
    console.error('Error fetching invitation info:', err.message);
    res.status(500).json({ error: 'Failed to fetch invitation info' });
  }
});

// POST /api/auth/accept-invitation - Accept invitation and register user
app.post('/api/auth/accept-invitation', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validate invitation token
    const inviteRes = await client.query(
      'SELECT id, email, name, role, expires_at FROM app_invitations WHERE token = $1',
      [token]
    );
    if (inviteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Undangan tidak ditemukan atau tidak valid' });
    }

    const invite = inviteRes.rows[0];
    if (new Date() > new Date(invite.expires_at)) {
      await client.query('ROLLBACK');
      return res.status(410).json({ error: 'Undangan telah kedaluwarsa' });
    }

    // Double check if user already exists
    const existing = await client.query('SELECT id FROM app_users WHERE email = $1', [invite.email]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email sudah terdaftar sebagai pengguna' });
    }

    // 2. Register in Neon Auth (Better Auth) if enabled
    let userId = null;
    const neonAuthRealUrl = process.env.NEON_AUTH_REAL_URL;
    if (neonAuthRealUrl) {
      let originUrl = '';
      try {
        originUrl = new URL(neonAuthRealUrl).origin;
      } catch (e) {
        originUrl = neonAuthRealUrl;
      }

      try {
        const neonSignUpRes = await fetch(`${neonAuthRealUrl}/sign-up/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Origin': originUrl
          },
          body: JSON.stringify({
            email: invite.email,
            password: password,
            name: invite.name
          })
        });

        const neonData = await neonSignUpRes.json();
        if (!neonSignUpRes.ok) {
          await client.query('ROLLBACK');
          const errMsg = neonData.error?.message || neonData.message || 'Gagal mendaftar ke Neon Auth';
          return res.status(neonSignUpRes.status || 400).json({ error: errMsg });
        }
        
        if (neonData?.user?.id) {
          userId = neonData.user.id;
        } else {
          throw new Error('Respon Neon Auth tidak menyertakan user ID');
        }
      } catch (neonErr) {
        await client.query('ROLLBACK');
        console.error('Neon Auth invitation signup error:', neonErr.message);
        return res.status(500).json({ error: `Gagal sinkronisasi dengan Neon Auth: ${neonErr.message}` });
      }
    } else {
      userId = crypto.randomUUID();
    }

    // Hash password locally
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Insert into app_users (marked as verified = TRUE)
    await client.query(
      'INSERT INTO app_users (id, email, password_hash, name, role, is_verified) VALUES ($1, $2, $3, $4, $5, TRUE)',
      [userId, invite.email, passwordHash, invite.name, invite.role]
    );

    // Sync is_verified status back to neon_auth if needed
    if (neonAuthRealUrl) {
      try {
        await client.query('UPDATE neon_auth.user SET "emailVerified"=TRUE, "updatedAt"=NOW() WHERE id=$1', [userId]);
      } catch (neonUpdateErr) {
        console.warn('Neon Auth verify email sync warning (non-fatal):', neonUpdateErr.message);
      }
    }

    // 4. Delete the invitation
    await client.query('DELETE FROM app_invitations WHERE id = $1', [invite.id]);

    // 5. Create active session for automatic login
    const session = await createSession(userId);

    await client.query('COMMIT');
    await logActivity(userId, 'Accept Invitation', `Pengguna menerima undangan dan mengaktifkan akun: ${invite.email}`);

    const userRes = await pool.query('SELECT id, email, name, role FROM app_users WHERE id=$1', [userId]);
    res.status(201).json({ session, user: userRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error accepting invitation:', err.message);
    res.status(500).json({ error: 'Gagal menerima undangan' });
  } finally {
    client.release();
  }
});

// POST /api/auth/forgot-password — Request reset password OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email, turnstileToken } = req.body;
  if (!email) return res.status(400).json({ error: 'Email wajib diisi' });

  try {
    // Verify Turnstile
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const turnstileCheck = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileCheck.ok) {
      return res.status(400).json({ error: turnstileCheck.error });
    }

    // Check if user exists and is verified
    const userRes = await pool.query(
      'SELECT id, email, is_verified FROM app_users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (userRes.rows.length === 0) {
      return res.status(200).json({ message: 'Jika email terdaftar, kode OTP reset password telah dikirim.' });
    }

    const user = userRes.rows[0];
    if (!user.is_verified) {
      return res.status(400).json({ error: 'Akun belum diverifikasi. Silakan login terlebih dahulu untuk verifikasi email.' });
    }

    const otp = await setUserOTP(user.id, 'reset-password');
    const emailResult = await sendOTPEmail(user.email, otp, 'reset-password');

    res.status(200).json({
      userId: user.id,
      message: emailResult.ok
        ? 'Kode OTP reset password telah dikirim ke email Anda.'
        : `Kode OTP reset password dibuat: ${otp}`,
      debugOtp: emailResult.ok ? null : otp
    });
  } catch (err) {
    console.error('Forgot-password error:', err.message);
    res.status(500).json({ error: 'Gagal memproses permintaan reset password' });
  }
});

// POST /api/auth/reset-password — Confirm OTP and reset password
app.post('/api/auth/reset-password', async (req, res) => {
  const { userId, otp, newPassword } = req.body;
  if (!userId || !otp || !newPassword) {
    return res.status(400).json({ error: 'userId, otp, dan newPassword wajib diisi' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password baru minimal 6 karakter' });
  }

  try {
    // Verify OTP
    const result = await verifyUserOTP(userId, otp, 'reset-password');
    if (!result.ok) return res.status(400).json({ error: result.reason });

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE app_users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await logActivity(userId, 'Reset Password', 'Kata sandi berhasil direset menggunakan verifikasi OTP.');

    res.status(200).json({ message: 'Kata sandi Anda berhasil diperbarui. Silakan login kembali.' });
  } catch (err) {
    console.error('Reset-password error:', err.message);
    res.status(500).json({ error: 'Gagal memperbarui kata sandi' });
  }
});

// POST /api/auth/sign-in — Step 1: check password, send OTP
app.post('/api/auth/sign-in', async (req, res) => {
  const { email, password, turnstileToken } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

  try {
    // 1. Verify Turnstile token
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const turnstileCheck = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileCheck.ok) {
      return res.status(400).json({ error: turnstileCheck.error });
    }

    const result = await pool.query(
      'SELECT id, email, password_hash, name, role, is_verified FROM app_users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Email atau password salah' });

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Email atau password salah' });

    if (!user.is_verified) {
      // Account not verified — resend verification OTP
      const otp = await setUserOTP(user.id, 'verify');
      const emailResult = await sendOTPEmail(user.email, otp, 'verify');
      return res.status(403).json({
        step: 'otp-verify',
        userId: user.id,
        error: emailResult.ok
          ? 'Akun belum diverifikasi. Kode OTP verifikasi baru telah dikirim ke email Anda.'
          : 'Akun belum diverifikasi. Email gagal dikirim, silakan hubungi administrator.',
        message: emailResult.ok
          ? 'Akun belum diverifikasi. Kode OTP verifikasi baru telah dikirim ke email Anda.'
          : 'Akun belum diverifikasi. Email gagal dikirim, silakan hubungi administrator.',
        debugOtp: (emailResult.fallback || !emailResult.ok) ? otp : null
      });
    }

    // Check rate-limit (1 minute between OTP sends)
    const lastSentRes = await pool.query('SELECT otp_last_sent_at FROM app_users WHERE id=$1', [user.id]);
    const lastSent = lastSentRes.rows[0]?.otp_last_sent_at;
    if (lastSent && (Date.now() - new Date(lastSent).getTime()) < 60 * 1000) {
      return res.status(429).json({ error: 'Tunggu 1 menit sebelum meminta kode OTP baru' });
    }

    const otp = await setUserOTP(user.id, 'login');
    const emailResult = await sendOTPEmail(user.email, otp, 'login');

    res.json({
      step: 'otp-login',
      userId: user.id,
      message: emailResult.ok
        ? `Kode OTP telah dikirim ke ${user.email}. Berlaku ${OTP_EXPIRES_MINUTES} menit.`
        : 'Kode OTP telah dibuat. Email gagal dikirim, silakan hubungi administrator.',
      debugOtp: (emailResult.fallback || !emailResult.ok) ? otp : null
    });
  } catch (err) {
    console.error('Sign-in error:', err.message);
    res.status(500).json({ error: 'Login gagal' });
  }
});

// POST /api/auth/verify-login — Step 2: verify OTP after sign-in
app.post('/api/auth/verify-login', async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) return res.status(400).json({ error: 'userId dan otp wajib diisi' });

  try {
    const result = await verifyUserOTP(userId, otp, 'login');
    if (!result.ok) return res.status(400).json({ error: result.reason });

    const userRes = await pool.query('SELECT id, email, name, role FROM app_users WHERE id=$1', [userId]);
    const user = userRes.rows[0];
    const session = await createSession(userId);
    await logActivity(userId, 'Sign In', 'Login berhasil dengan OTP');

    res.json({ session, user });
  } catch (err) {
    console.error('Verify-login error:', err.message);
    res.status(500).json({ error: 'Gagal verifikasi OTP login' });
  }
});

// POST /api/auth/resend-otp
app.post('/api/auth/resend-otp', async (req, res) => {
  const { userId, purpose } = req.body;
  if (!userId || !purpose) return res.status(400).json({ error: 'userId dan purpose wajib diisi' });
  if (!['verify', 'login', 'reset-password'].includes(purpose)) return res.status(400).json({ error: 'Purpose tidak valid' });

  try {
    const userRes = await pool.query(
      'SELECT email, is_verified, otp_last_sent_at FROM app_users WHERE id=$1',
      [userId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User tidak ditemukan' });
    const { email, otp_last_sent_at } = userRes.rows[0];

    // Rate-limit: 1 minute
    if (otp_last_sent_at && (Date.now() - new Date(otp_last_sent_at).getTime()) < 60 * 1000) {
      const secondsLeft = Math.ceil(60 - (Date.now() - new Date(otp_last_sent_at).getTime()) / 1000);
      return res.status(429).json({ error: `Tunggu ${secondsLeft} detik sebelum kirim ulang` });
    }

    const otp = await setUserOTP(userId, purpose);
    const emailResult = await sendOTPEmail(email, otp, purpose);

    res.json({
      message: emailResult.ok
        ? `Kode OTP baru telah dikirim ke ${email}`
        : 'Kode OTP baru telah dibuat. Email gagal dikirim, silakan hubungi administrator.'
    });
  } catch (err) {
    console.error('Resend OTP error:', err.message);
    res.status(500).json({ error: 'Gagal mengirim ulang OTP' });
  }
});

// POST /api/auth/sign-out
app.post('/api/auth/sign-out', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try { await pool.query('DELETE FROM app_sessions WHERE token = $1', [token]); } catch { /* ignore */ }
  }
  res.json({ success: true });
});

// GET /api/auth/me — restore session on page reload
app.get('/api/auth/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, s.token, s.expires_at
       FROM app_sessions s
       JOIN app_users u ON s.user_id = u.id
       WHERE s.token = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [token]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: 'Sesi tidak valid atau sudah berakhir' });
    const row = result.rows[0];
    res.json({
      session: { token: row.token, expiresAt: row.expires_at },
      user: { id: row.id, email: row.email, name: row.name, role: row.role }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify session' });
  }
});


// ─── WHOIS Endpoints ────────────────────────────────────────────────────────

app.get('/api/whois-lookup', requireAuth, async (req, res) => {
  const { domain } = req.query;
  if (!domain || typeof domain !== 'string' || !domain.trim())
    return res.status(400).json({ error: 'Domain parameter is required' });
  try {
    const data = await scrapeWhois(domain.trim().toLowerCase());
    await logActivity(req.user.id, 'WHOIS Lookup', `Searched WHOIS for domain: ${domain.trim().toLowerCase()}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch WHOIS data' });
  }
});

app.get('/api/saved-domains', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM saved_domains ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching saved domains:', err.message);
    res.status(500).json({ error: 'Failed to fetch saved domains' });
  }
});

app.post('/api/saved-domains', requireAuth, async (req, res) => {
  const { domain, whois_data, registrar, expiry_date } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  try {
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO saved_domains (id, user_id, domain, whois_data, registrar, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (domain) DO UPDATE SET
         whois_data = EXCLUDED.whois_data,
         registrar = EXCLUDED.registrar,
         expiry_date = EXCLUDED.expiry_date
       RETURNING *`,
      [id, req.user.id, domain.trim().toLowerCase(), JSON.stringify(whois_data), registrar || null, expiry_date || null]
    );
    await logActivity(req.user.id, 'Save Domain', `Saved domain to tracker: ${domain.trim().toLowerCase()}`);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving domain:', err.message);
    res.status(500).json({ error: 'Failed to save domain' });
  }
});

app.delete('/api/saved-domains/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM saved_domains WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or unauthorized' });
    const domainName = result.rows[0].domain;
    await logActivity(req.user.id, 'Delete Domain', `Removed domain from tracker: ${domainName}`);
    res.json({ message: 'Removed', id: result.rows[0].id });
  } catch (err) {
    console.error('Error deleting domain:', err.message);
    res.status(500).json({ error: 'Failed to delete domain' });
  }
});

app.get('/api/saved-servers', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM saved_servers ORDER BY created_at DESC'
    );
    const decrypted = result.rows.map(row => ({
      ...row,
      password: decryptPassword(row.password)
    }));
    res.json(decrypted);
  } catch (err) {
    console.error('Error fetching saved servers:', err.message);
    res.status(500).json({ error: 'Failed to fetch saved servers' });
  }
});

app.post('/api/saved-servers', requireAuth, async (req, res) => {
  const { ip_address, provider, username, password, register_date, expired_date, hostname } = req.body;
  if (!ip_address || !provider || !username || !password) {
    return res.status(400).json({ error: 'IP Address, Provider, Username, and Password are required' });
  }
  try {
    const id = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO saved_servers (id, user_id, ip_address, provider, username, password, register_date, expired_date, hostname)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, req.user.id, ip_address.trim(), provider.trim(), username.trim(), encryptPassword(password.trim()), register_date || null, expired_date || null, hostname ? hostname.trim() : null]
    );
    await logActivity(req.user.id, 'Add Server', `Added server: ${ip_address.trim()} (${provider.trim()})`);
    // Return row with decrypted password so client has it immediately
    const row = result.rows[0];
    row.password = decryptPassword(row.password);
    res.status(201).json(row);
  } catch (err) {
    console.error('Error saving server:', err.message);
    res.status(500).json({ error: 'Failed to save server' });
  }
});

app.put('/api/saved-servers/:id', requireAuth, async (req, res) => {
  const { ip_address, provider, username, password, register_date, expired_date, hostname } = req.body;
  if (!ip_address || !provider || !username || !password) {
    return res.status(400).json({ error: 'IP Address, Provider, Username, and Password are required' });
  }
  try {
    const result = await pool.query(
      `UPDATE saved_servers 
       SET ip_address = $1, provider = $2, username = $3, password = $4, register_date = $5, expired_date = $6, hostname = $7
       WHERE id = $8
       RETURNING *`,
      [ip_address.trim(), provider.trim(), username.trim(), encryptPassword(password.trim()), register_date || null, expired_date || null, hostname ? hostname.trim() : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or unauthorized' });
    await logActivity(req.user.id, 'Edit Server', `Updated server: ${ip_address.trim()} (${provider.trim()})`);
    const row = result.rows[0];
    row.password = decryptPassword(row.password);
    res.json(row);
  } catch (err) {
    console.error('Error updating server:', err.message);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

app.delete('/api/saved-servers/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM saved_servers WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found or unauthorized' });
    await logActivity(req.user.id, 'Delete Server', `Removed server from list: ${result.rows[0].ip_address}`);
    res.json({ message: 'Removed', id: result.rows[0].id });
  } catch (err) {
    console.error('Error deleting server:', err.message);
    res.status(500).json({ error: 'Failed to delete server' });
  }
});

app.post('/api/bulk-whois-lookup', requireAuth, async (req, res) => {
  const { domains } = req.body;
  if (!Array.isArray(domains) || domains.length === 0)
    return res.status(400).json({ error: 'domains array is required' });
  if (domains.length > 100)
    return res.status(400).json({ error: 'Maximum 100 domains per request' });

  const cleanDomains = [...new Set(
    domains.map(d => (typeof d === 'string' ? d.trim().toLowerCase() : '')).filter(Boolean)
  )];

  const CONCURRENCY = 3;
  const results = [];
  for (let i = 0; i < cleanDomains.length; i += CONCURRENCY) {
    const batch = cleanDomains.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (domain) => {
        try {
          const data = await scrapeWhois(domain);
          return { domain, status: 'success', data };
        } catch (err) {
          return { domain, status: 'error', error: err.message || 'Failed' };
        }
      })
    );
    results.push(...batchResults);
    if (i + CONCURRENCY < cleanDomains.length) await new Promise(r => setTimeout(r, 500));
  }
  await logActivity(req.user.id, 'Bulk WHOIS Lookup', `Checked ${cleanDomains.length} domains in bulk`);
  res.json({ results });
});

// ─── User Profile & Management Endpoints ─────────────────────────────────────

// Admin verification middleware
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden: Admins only' });
  }
  next();
}

// GET /api/activity-logs - Get activity logs
app.get('/api/activity-logs', requireAuth, async (req, res) => {
  try {
    let query;
    let params = [];
    if (req.user.role === 'admin') {
      query = `
        SELECT al.id, al.user_id, al.action, al.details, al.created_at, u.email, u.name
        FROM activity_logs al
        JOIN app_users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 500
      `;
    } else {
      query = `
        SELECT al.id, al.user_id, al.action, al.details, al.created_at, u.email, u.name
        FROM activity_logs al
        JOIN app_users u ON al.user_id = u.id
        WHERE al.user_id = $1
        ORDER BY al.created_at DESC
        LIMIT 500
      `;
      params = [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching activity logs:', err.message);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// PUT /api/users/profile - Edit own profile
app.put('/api/users/profile', requireAuth, async (req, res) => {
  const { name, email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  try {
    // Check if email already taken by someone else
    const checkEmail = await pool.query('SELECT id FROM app_users WHERE email = $1 AND id != $2', [email.toLowerCase(), req.user.id]);
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email already in use by another user' });
    }

    let result;
    if (password && password.trim().length >= 6) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      result = await pool.query(
        `UPDATE app_users 
         SET name = $1, email = $2, password_hash = $3
         WHERE id = $4
         RETURNING id, email, name, role`,
        [name || email.split('@')[0], email.toLowerCase(), passwordHash, req.user.id]
      );
    } else {
      result = await pool.query(
        `UPDATE app_users 
         SET name = $1, email = $2
         WHERE id = $3
         RETURNING id, email, name, role`,
        [name || email.split('@')[0], email.toLowerCase(), req.user.id]
      );
    }

    await logActivity(req.user.id, 'Update Profile', `Updated personal profile details: ${email.toLowerCase()}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating profile:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/users - Admin: List all users
app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, created_at, is_verified FROM app_users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users - Admin: Invite new user
app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, name, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user already exists in users database
    const existing = await client.query('SELECT id FROM app_users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already exists in users database' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const inviteId = crypto.randomUUID();
    const finalName = name || email.split('@')[0];
    const finalRole = role || 'user';

    await client.query(
      `INSERT INTO app_invitations (id, email, name, role, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE 
       SET name = EXCLUDED.name, role = EXCLUDED.role, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, created_at = NOW()`,
      [inviteId, email.toLowerCase(), finalName, finalRole, token, expiresAt]
    );

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const acceptLink = `${origin}/accept-invitation?token=${token}`;

    let emailSent = false;
    let emailError = null;

    if (EMAIL_CONFIGURED) {
      const subject = 'Undangan Bergabung ke DomainWhois';
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
          <h2 style="margin:0 0 8px;font-size:18px;color:#111">✉️ Undangan Bergabung</h2>
          <p style="margin:0 0 16px;color:#374151;font-size:14px">
            Halo <strong>${finalName}</strong>, Anda telah diundang oleh administrator untuk bergabung ke <strong>DomainWhois</strong> dengan role <strong>${finalRole}</strong>.
          </p>
          <p style="margin:0 0 24px;color:#6b7280;font-size:14px">
            Klik tombol di bawah ini untuk membuat password akun Anda dan menyelesaikan pendaftaran:
          </p>
          <div style="text-align:center;margin-bottom:24px">
            <a href="${acceptLink}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:14px;font-weight:bold;border-radius:8px">Terima Undangan</a>
          </div>
          <p style="margin:0 0 16px;color:#9ca3af;font-size:12px;text-align:center">
            Link ini berlaku selama 48 jam. Jika tombol di atas tidak berfungsi, salin dan tempel link berikut ke browser Anda:
          </p>
          <p style="margin:0;color:#3b82f6;font-size:12px;word-break:break-all;text-align:center">${acceptLink}</p>
        </div>`;
      try {
        await emailTransporter.sendMail({ from: EMAIL_FROM, to: email.toLowerCase(), subject, html });
        emailSent = true;
      } catch (err) {
        console.error('Failed to send invite email:', err.message);
        emailError = err.message;
      }
    }

    await client.query('COMMIT');
    await logActivity(req.user.id, 'Invite User', `Admin invited user: ${email.toLowerCase()} with role ${finalRole}`);
    
    res.status(201).json({ 
      email: email.toLowerCase(),
      name: finalName,
      role: finalRole,
      created_at: new Date().toISOString(),
      is_verified: false,
      message: emailSent 
        ? 'Undangan berhasil dikirim ke email.' 
        : `Undangan berhasil dibuat. Email gagal dikirim: ${emailError || 'SMTP tidak terkonfigurasi'}.`,
      debugInvite: acceptLink
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error inviting user by admin:', err.message);
    res.status(500).json({ error: 'Failed to invite user' });
  } finally {
    client.release();
  }
});

// PUT /api/users/:id - Admin: Edit user roles, passwords, etc.
app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const checkEmail = await client.query('SELECT id FROM app_users WHERE email = $1 AND id != $2', [email.toLowerCase(), req.params.id]);
    if (checkEmail.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already in use' });
    }

    let updatedUser;
    let result;
    if (password && password.trim().length >= 6) {
      const passwordHash = await bcrypt.hash(password.trim(), 10);
      result = await client.query(
        `UPDATE app_users 
         SET name = $1, email = $2, password_hash = $3, role = $4
         WHERE id = $5
         RETURNING id, email, name, role, created_at, is_verified`,
        [name || email.split('@')[0], email.toLowerCase(), passwordHash, role || 'user', req.params.id]
      );
    } else {
      result = await client.query(
        `UPDATE app_users 
         SET name = $1, email = $2, role = $3
         WHERE id = $4
         RETURNING id, email, name, role, created_at, is_verified`,
        [name || email.split('@')[0], email.toLowerCase(), role || 'user', req.params.id]
      );
    }
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    updatedUser = result.rows[0];

    // Sync to Neon Auth if it exists and id is a valid UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_REGEX.test(req.params.id)) {
      try {
        const schemaCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.schemata WHERE schema_name = 'neon_auth'
          )
        `);
        if (schemaCheck.rows[0].exists) {
          await client.query(
            `UPDATE neon_auth.user 
             SET email = $1, name = $2, role = $3, "updatedAt" = NOW() 
             WHERE id = $4`,
            [email.toLowerCase(), name || email.split('@')[0], role || 'user', req.params.id]
          );
        }
      } catch (neonUpdateErr) {
        console.warn('Neon Auth update warning (non-fatal):', neonUpdateErr.message);
      }
    }

    await client.query('COMMIT');
    await logActivity(req.user.id, 'Edit User', `Admin updated user details for: ${email.toLowerCase()}`);
    res.json(updatedUser);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating user:', err.message);
    res.status(500).json({ error: 'Failed to update user' });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:id - Admin: Delete user
app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query('DELETE FROM app_users WHERE id = $1 RETURNING email', [req.params.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const deletedEmail = result.rows[0].email;
    await client.query('DELETE FROM app_sessions WHERE user_id = $1', [req.params.id]);

    // Delete from Neon Auth if it exists and id is a valid UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_REGEX.test(req.params.id)) {
      try {
        const schemaCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.schemata WHERE schema_name = 'neon_auth'
          )
        `);
        if (schemaCheck.rows[0].exists) {
          // Delete from all linked better-auth tables to clean up cleanly
          await client.query('DELETE FROM neon_auth.account WHERE "userId" = $1', [req.params.id]);
          await client.query('DELETE FROM neon_auth.session WHERE "userId" = $1', [req.params.id]);
          await client.query('DELETE FROM neon_auth.user WHERE id = $1', [req.params.id]);
        }
      } catch (neonDeleteErr) {
        console.warn('Neon Auth delete warning (non-fatal):', neonDeleteErr.message);
      }
    }

    await client.query('COMMIT');
    await logActivity(req.user.id, 'Delete User', `Admin deleted user account: ${deletedEmail}`);
    res.json({ message: 'User deleted successfully', id: req.params.id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  } finally {
    client.release();
  }
});

// ─── Settings Endpoints ──────────────────────────────────────────────────────

// GET /api/settings - Admin: Retrieve settings
app.get('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT setting_key, setting_value FROM app_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// POST /api/settings - Admin: Save settings
app.post('/api/settings', requireAuth, requireAdmin, async (req, res) => {
  const settings = req.body;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO app_settings (setting_key, setting_value, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (setting_key)
           DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()`,
          [key, String(value ?? '').trim()]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    await logActivity(req.user.id, 'Update Settings', 'Updated notification and alert settings');
    res.json({ message: 'Pengaturan berhasil disimpan' });
  } catch (err) {
    console.error('Error updating settings:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/test-alerts - Admin: Trigger manual test alert
app.post('/api/settings/test-alerts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await checkExpirationsAndNotify(true);
    await logActivity(req.user.id, 'Test Alerts', `Manually triggered notification test alerts: ${result.alertsCount} alerts processed`);
    res.json({ message: 'Uji coba notifikasi telah dikirim!', alertsCount: result.alertsCount });
  } catch (err) {
    console.error('Error testing notifications:', err.message);
    res.status(500).json({ error: 'Gagal mengirim uji coba notifikasi' });
  }
});

// POST /api/settings/test-kirisan - Admin: Test Kirisan connection
app.post('/api/settings/test-kirisan', requireAuth, requireAdmin, async (req, res) => {
  let { kirisan_token, kirisan_channel_key, kirisan_template_id, recipient_email } = req.body;

  // Fallback to database settings if not supplied in request body
  if (!kirisan_token || !kirisan_channel_key || !recipient_email) {
    try {
      const settingsRes = await pool.query('SELECT setting_key, setting_value FROM app_settings');
      const settings = {};
      settingsRes.rows.forEach(r => {
        settings[r.setting_key] = r.setting_value;
      });
      if (!kirisan_token) kirisan_token = settings['kirisan_token'];
      if (!kirisan_channel_key) kirisan_channel_key = settings['kirisan_channel_key'];
      if (!kirisan_template_id) kirisan_template_id = settings['kirisan_template_id'];
      if (!recipient_email) recipient_email = settings['recipient_email'];
    } catch (err) {
      return res.status(500).json({ error: 'Gagal memuat pengaturan dari database: ' + err.message });
    }
  }

  if (!kirisan_token) {
    return res.status(400).json({ error: 'Kirisan Account Token tidak boleh kosong.' });
  }
  if (!kirisan_channel_key) {
    return res.status(400).json({ error: 'Kirisan Channel Key tidak boleh kosong.' });
  }
  if (!kirisan_template_id) {
    return res.status(400).json({ error: 'Kirisan Template ID wajib diisi. Buat template di dashboard Kirisan lalu masukkan ID-nya.' });
  }
  if (!recipient_email) {
    return res.status(400).json({ error: 'Email Penerima tidak boleh kosong. Harap isi Email Penerima terlebih dahulu.' });
  }

  console.log('[Notifier] Testing Kirisan connection...');
  try {
    // Per Kirisan API docs:
    // - keys must be an object: { "email": { "token": "..." } } (NOT an array)
    // - Email channel only supports content.email.template (not inline content)
    // - Field for recipient is "to", not "target"
    const kirisanRes = await fetch('https://api.kirisan.com/v1/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kirisan_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        keys: {
          email: {
            token: kirisan_channel_key
          }
        },
        target: {
          email: recipient_email,
          variables: {
            alerts_text: 'Ini adalah tes notifikasi dari sistem pemantau DomainWhois.',
            alerts_html: '<p>Ini adalah tes notifikasi dari sistem pemantau DomainWhois.</p>',
            alerts_count: 1,
            first_alert_name: 'test-domain.com',
            first_alert_days: 30,
            first_alert_expiry: '2026-08-10'
          }
        },
        content: {
          email: {
            template: parseInt(kirisan_template_id, 10)
          }
        }
      })
    });

    if (kirisanRes.ok) {
      const resData = await kirisanRes.json();
      if (resData.status) {
        await logActivity(req.user.id, 'Test Alerts', `Successfully tested Kirisan connection to ${recipient_email}`);
        return res.json({ success: true, message: 'Koneksi berhasil! Email uji coba telah dikirim ke ' + recipient_email });
      } else {
        await logActivity(req.user.id, 'Test Alerts', `Failed testing Kirisan connection: ${resData.reason}`);
        return res.status(400).json({ error: `Gagal mengirim email: ${resData.reason || 'Alasan tidak diketahui'}` });
      }
    } else {
      const errBody = await kirisanRes.text();
      await logActivity(req.user.id, 'Test Alerts', `Failed testing Kirisan connection (HTTP ${kirisanRes.status})`);
      return res.status(kirisanRes.status).json({ 
        error: `API Kirisan mengembalikan error (Status ${kirisanRes.status}): ${errBody}` 
      });
    }
  } catch (err) {
    console.error('[Notifier] Test Kirisan Error:', err.message);
    return res.status(500).json({ error: `Koneksi API Kirisan gagal: ${err.message}` });
  }
});

// GET /api/cron-check - Public/External trigger (secured with token)
app.get('/api/cron-check', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const token = req.headers.authorization?.split(' ')[1] || req.query.secret;

  if (cronSecret && token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }

  try {
    const result = await checkExpirationsAndNotify(false);
    res.json({ success: true, message: 'Cron check completed successfully', alertsCount: result.alertsCount });
  } catch (err) {
    console.error('Cron check error:', err.message);
    res.status(500).json({ error: 'Failed to run expiration check' });
  }
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Express server running on port ${PORT}`);
  });
}

export default app;
