import pool from './db.js';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import crypto from 'crypto';

async function logNotificationActivity(action, details) {
  try {
    const userRes = await pool.query("SELECT id FROM app_users ORDER BY role = 'admin' DESC, created_at ASC LIMIT 1");
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      console.warn('[Notifier] No user found in database to log notification activity.');
      return;
    }
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO activity_logs (id, user_id, action, details) VALUES ($1, $2, $3, $4)',
      [id, userId, action, details || null]
    );
  } catch (err) {
    console.error('[Notifier] Failed to log notification activity:', err.message);
  }
}

// Helper to format date cleanly
function formatDateString(dateVal) {
  if (!dateVal) return '—';
  try {
    return new Date(dateVal).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateVal;
  }
}

// Main expiry checking and notification dispatcher
export async function checkExpirationsAndNotify(force = false) {
  console.log(`[Notifier] Starting expiration check (force=${force})...`);
  
  try {
    // 1. Fetch settings
    const settingsRes = await pool.query('SELECT setting_key, setting_value FROM app_settings');
    const settings = {};
    settingsRes.rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });

    const fonnteToken = settings['fonnte_token'] || '';
    const brevoApiKey = settings['brevo_api_key'] || '';
    const brevoSenderEmail = settings['brevo_sender_email'] || '';
    const brevoSenderName = settings['brevo_sender_name'] || 'DomainWhois Alerts';
    const recipientEmail = settings['recipient_email'] || '';
    const recipientWhatsapp = settings['recipient_whatsapp'] || '';
    const alertDaysStr = settings['alert_days_before'] || '30,7,3,1';
    
    const alertDays = alertDaysStr.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));

    // 2. Fetch saved domains and servers
    const domainsRes = await pool.query('SELECT id, domain, expiry_date FROM saved_domains');
    const serversRes = await pool.query('SELECT id, ip_address, provider, hostname, expired_date FROM saved_servers');

    const alerts = [];

    // Process domains
    for (const dom of domainsRes.rows) {
      if (!dom.expiry_date) continue;
      const expDate = new Date(dom.expiry_date);
      if (isNaN(expDate.getTime())) continue;

      // Calculate calendar diff in days (normalize to local midnight)
      const expMidnight = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const nowToday = new Date();
      const nowMidnight = new Date(nowToday.getFullYear(), nowToday.getMonth(), nowToday.getDate());
      const diffTime = expMidnight.getTime() - nowMidnight.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (force) {
        // If testing/force, include anything expiring within 30 days
        if (diffDays <= 30) {
          alerts.push({ type: 'domain', name: dom.domain, expiryDate: dom.expiry_date, daysLeft: diffDays });
        }
      } else {
        if (alertDays.includes(diffDays)) {
          alerts.push({ type: 'domain', name: dom.domain, expiryDate: dom.expiry_date, daysLeft: diffDays });
        }
      }
    }

    // Process servers
    for (const srv of serversRes.rows) {
      if (!srv.expired_date) continue;
      const expDate = new Date(srv.expired_date);
      if (isNaN(expDate.getTime())) continue;

      // Calculate calendar diff in days (normalize to local midnight)
      const expMidnight = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      const nowToday = new Date();
      const nowMidnight = new Date(nowToday.getFullYear(), nowToday.getMonth(), nowToday.getDate());
      const diffTime = expMidnight.getTime() - nowMidnight.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const serverLabel = srv.hostname ? `${srv.hostname} (${srv.ip_address})` : srv.ip_address;

      if (force) {
        if (diffDays <= 30) {
          alerts.push({ type: 'server', name: serverLabel, provider: srv.provider, expiryDate: srv.expired_date, daysLeft: diffDays });
        }
      } else {
        if (alertDays.includes(diffDays)) {
          alerts.push({ type: 'server', name: serverLabel, provider: srv.provider, expiryDate: srv.expired_date, daysLeft: diffDays });
        }
      }
    }

    if (alerts.length === 0 && !force) {
      console.log('[Notifier] No expiring services found for today.');
      return { success: true, alertsCount: 0 };
    }

    // 3. Construct messages
    let waMessage = `⚠️ *INFO EXPIRED LAYANAN (DOMAINWHOIS)* ⚠️\n\n`;
    let emailHtml = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background-color:#f9fafb">
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;font-weight:800;letter-spacing:-0.025em">⚠️ Peringatan Kedaluwarsa Layanan</h2>
        <p style="color:#4b5563;font-size:14px;margin:0 0 24px 0;line-height:1.5">Berikut adalah daftar layanan domain dan server yang membutuhkan perhatian Anda karena akan segera habis masa aktifnya:</p>
        <div style="margin-bottom:24px">
    `;

    if (alerts.length === 0 && force) {
      waMessage += `Uji coba notifikasi WhatsApp DomainWhois berhasil! Tidak ada layanan yang terdeteksi kedaluwarsa dalam 30 hari ke depan.`;
      emailHtml += `
        <div style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;text-align:center;color:#6b7280;font-size:14px">
          Uji coba notifikasi email berhasil! Tidak ada layanan yang akan kedaluwarsa dalam 30 hari ke depan.
        </div>
      `;
    } else {
      alerts.forEach(item => {
        const isDomain = item.type === 'domain';
        const providerName = isDomain ? 'Registrar WHOIS' : (item.provider || '—');
        
        waMessage += `*${isDomain ? '🌐 Domain' : '🖥️ Server'}*:\n`;
        waMessage += `Detail: ${item.name}\n`;
        waMessage += `Provider: ${providerName}\n`;
        waMessage += `Expired: ${formatDateString(item.expiryDate)}\n`;
        waMessage += `Sisa Waktu: *${item.daysLeft} hari*\n\n`;

        // Card styling variables
        const typeLabel = isDomain ? 'Domain' : 'Server';
        const typeIcon = isDomain ? '🌐' : '🖥️';
        const typeBg = isDomain ? '#eff6ff' : '#f8fafc';
        const typeColor = isDomain ? '#1d4ed8' : '#475569';
        const typeBorder = isDomain ? '#bfdbfe' : '#e2e8f0';

        let daysText = '';
        let daysBg = '';
        let daysColor = '';

        if (item.daysLeft <= 0) {
          daysText = 'Sudah Expired';
          daysBg = '#fef2f2';
          daysColor = '#b91c1c';
        } else {
          daysText = `${item.daysLeft} Hari Lagi`;
          if (item.daysLeft <= 3) {
            daysBg = '#fef2f2';
            daysColor = '#b91c1c';
          } else {
            daysBg = '#fffbeb';
            daysColor = '#d97706';
          }
        }

        emailHtml += `
          <div style="background-color:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px; box-shadow:0 1px 2px 0 rgba(0,0,0,0.02)">
            <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
              <tr>
                <td style="text-align:left; vertical-align:middle;">
                  <span style="font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; padding:3px 8px; border-radius:6px; background-color:${typeBg}; color:${typeColor}; border:1px solid ${typeBorder}; font-family:system-ui, -apple-system, sans-serif;">
                    ${typeIcon} ${typeLabel}
                  </span>
                </td>
                <td style="text-align:right; vertical-align:middle;">
                  <span style="font-size:11px; font-weight:bold; padding:4px 8px; border-radius:6px; background-color:${daysBg}; color:${daysColor}; font-family:system-ui, -apple-system, sans-serif;">
                    ${daysText}
                  </span>
                </td>
              </tr>
            </table>
            <div style="font-size:15px; font-weight:700; color:#111827; font-family:monospace; margin-bottom:12px; word-break:break-all;">
              ${item.name}
            </div>
            <table style="width:100%; border-collapse:collapse; border-top:1px solid #f3f4f6; margin-top:8px;">
              <tr>
                <td style="padding:8px 0 2px 0; font-size:11px; color:#9ca3af; text-transform:uppercase; font-weight:bold; width:50%;">Provider</td>
                <td style="padding:8px 0 2px 0; font-size:11px; color:#9ca3af; text-transform:uppercase; font-weight:bold; text-align:right; width:50%;">Tanggal Expired</td>
              </tr>
              <tr>
                <td style="padding:2px 0 0 0; font-size:13px; font-weight:bold; color:#4b5563; font-family:system-ui, -apple-system, sans-serif;">${providerName}</td>
                <td style="padding:2px 0 0 0; font-size:13px; font-weight:bold; color:#4b5563; font-family:system-ui, -apple-system, sans-serif; text-align:right;">${formatDateString(item.expiryDate)}</td>
              </tr>
            </table>
          </div>
        `;
      });
    }

    waMessage += `Silakan lakukan perpanjangan layanan sesegera mungkin.\n\n_Pesan otomatis dikirim oleh DomainWhois_`;
    emailHtml += `
        </div>
        <div style="font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:20px;text-align:center;line-height:1.5">
          Pesan ini dikirimkan secara otomatis oleh sistem pemantau DomainWhois.<br>Mohon jangan membalas email ini secara langsung.
        </div>
      </div>
    `;

    // 4. Dispatch Email
    let emailSent = false;
    if (recipientEmail) {
      if (brevoApiKey) {
        console.log(`[Notifier] Sending email via Brevo API to ${recipientEmail}...`);
        try {
          const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'api-key': brevoApiKey,
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              sender: { 
                name: brevoSenderName, 
                email: brevoSenderEmail || 'noreply@domainwhois.com' 
              },
              to: [{ email: recipientEmail }],
              subject: `⚠️ Alert Layanan Expiring — DomainWhois`,
              htmlContent: emailHtml
            })
          });
          if (brevoRes.ok) {
            console.log('[Notifier] Email successfully sent via Brevo!');
            emailSent = true;
            await logNotificationActivity(
              'Email Alert (Brevo)',
              `Email alert successfully sent to ${recipientEmail} via Brevo API.\n\nDomains checked: ${alerts.map(a => `${a.domain} (${a.diffDays} days left)`).join(', ')}`
            );
          } else {
            const errBody = await brevoRes.text();
            console.error('[Notifier] Failed to send via Brevo:', errBody);
            await logNotificationActivity(
              'Email Alert Failed (Brevo)',
              `Failed to send Email alert to ${recipientEmail} via Brevo. Error: ${errBody}\n\nDomains checked: ${alerts.map(a => `${a.domain} (${a.diffDays} days left)`).join(', ')}`
            );
          }
        } catch (err) {
          console.error('[Notifier] Brevo API Error:', err.message);
          await logNotificationActivity(
            'Email Alert Failed (Brevo)',
            `Brevo API call error: ${err.message}\n\nDomains checked: ${alerts.map(a => `${a.domain} (${a.diffDays} days left)`).join(', ')}`
          );
        }
      }

      // Fallback to default Nodemailer if Brevo wasn't successful or configured
      if (!emailSent) {
        const EMAIL_CONFIGURED = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS &&
          process.env.EMAIL_HOST !== 'smtp.example.com');
        if (EMAIL_CONFIGURED) {
          console.log(`[Notifier] Sending email via local SMTP to ${recipientEmail}...`);
          try {
            const emailTransporter = nodemailer.createTransport({
              host: process.env.EMAIL_HOST,
              port: parseInt(process.env.EMAIL_PORT || '587'),
              secure: process.env.EMAIL_SECURE === 'true',
              auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
              }
            });
            await emailTransporter.sendMail({
              from: process.env.EMAIL_FROM || '"DomainWhois" <noreply@domainwhois.com>',
              to: recipientEmail,
              subject: `⚠️ Alert Layanan Expiring — DomainWhois`,
              html: emailHtml
            });
            console.log('[Notifier] Email successfully sent via local SMTP!');
            emailSent = true;
            await logNotificationActivity(
              'Email Alert (SMTP)',
              `Email alert successfully sent to ${recipientEmail} via local SMTP.\n\nDomains checked: ${alerts.map(a => `${a.domain} (${a.diffDays} days left)`).join(', ')}`
            );
          } catch (err) {
            console.error('[Notifier] Local SMTP Error:', err.message);
            await logNotificationActivity(
              'Email Alert Failed (SMTP)',
              `Failed to send Email alert to ${recipientEmail} via local SMTP. Error: ${err.message}\n\nDomains checked: ${alerts.map(a => `${a.domain} (${a.diffDays} days left)`).join(', ')}`
            );
          }
        } else {
          console.log(`\n📧 [DEV MODE - EMAIL NOT SENT]\nTo: ${recipientEmail}\nContent:\n${emailHtml}\n`);
          await logNotificationActivity(
            'Email Alert (Dev Mode)',
            `Email alert would be sent to ${recipientEmail} (SMTP/Brevo not configured).\n\nDomains checked: ${alerts.map(a => `${a.domain} (${a.diffDays} days left)`).join(', ')}`
          );
        }
      }
    }

    // 5. Dispatch WhatsApp via Fonnte
    if (recipientWhatsapp && fonnteToken) {
      console.log(`[Notifier] Sending WhatsApp via Fonnte to ${recipientWhatsapp}...`);
      try {
        const data = new FormData();
        data.append("target", recipientWhatsapp);
        data.append("message", waMessage);
        data.append("countryCode", "62");

        const fonnteRes = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: {
            'Authorization': fonnteToken
          },
          body: data
        });
        if (fonnteRes.ok) {
          const resJson = await fonnteRes.json();
          console.log('[Notifier] WhatsApp alert successfully sent via Fonnte! Response:', resJson);
          await logNotificationActivity(
            'WhatsApp Alert (Fonnte)',
            `WhatsApp alert successfully sent to ${recipientWhatsapp} via Fonnte API.\n\nMessage:\n${waMessage}\n\nFonnte Response: ${JSON.stringify(resJson)}`
          );
        } else {
          const errBody = await fonnteRes.text();
          console.error('[Notifier] Fonnte API Error response:', errBody);
          await logNotificationActivity(
            'WhatsApp Alert Failed (Fonnte)',
            `Failed to send WhatsApp alert to ${recipientWhatsapp} via Fonnte. Error: ${errBody}\n\nMessage:\n${waMessage}`
          );
        }
      } catch (err) {
        console.error('[Notifier] Fonnte fetch error:', err.message);
        await logNotificationActivity(
          'WhatsApp Alert Failed (Fonnte)',
          `Fonnte API call error: ${err.message}\n\nMessage:\n${waMessage}`
        );
      }
    } else {
      console.log(`\n💬 [DEV MODE - WHATSAPP NOT SENT]\nTo: ${recipientWhatsapp}\nMessage:\n${waMessage}\n`);
      await logNotificationActivity(
        'WhatsApp Alert (Dev Mode)',
        `WhatsApp alert would be sent to ${recipientWhatsapp} (Fonnte not configured).\n\nMessage:\n${waMessage}`
      );
    }

    return { success: true, alertsCount: alerts.length };
  } catch (err) {
    console.error('[Notifier] Error in checkExpirationsAndNotify:', err);
    return { success: false, error: err.message };
  }
}

// Schedule daily check at 08:00 AM local time
export function startNotificationScheduler() {
  console.log('[Notifier] Starting daily scheduler at 08:00 AM...');
  // Cron: 0 8 * * * -> daily at 08:00
  cron.schedule('0 8 * * *', async () => {
    console.log('[Notifier] Triggering scheduled daily check...');
    await checkExpirationsAndNotify(false);
  });
}
