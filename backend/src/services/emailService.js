import sgMail from '@sendgrid/mail';

/**
 * Email service.
 *
 * Fixes from the original:
 *   1. User-controlled values (username, etc.) are now HTML-escaped
 *      before being interpolated into email templates. The original
 *      did raw string interpolation — a username like
 *      `<script>alert(1)</script>` would embed the script into the
 *      verification email. Email clients block JavaScript in most
 *      cases, but it's still HTML injection.
 *   2. Plain-text fallback (`text` field) now uses a proper
 *      strip-tags + decode pass instead of a single regex that
 *      misses entities, nested tags, and script/style content.
 *   3. Recipient email is validated. The original passed whatever
 *      it received straight to SendGrid; a malformed address would
 *      surface as an opaque SendGrid 400 only after the API call.
 *   4. URL-base + token are encoded; safer than raw interpolation.
 */

// Same escapeHtml used in commentController. Keeping it here avoids
// importing a separate util in a Node service that may run before app
// startup completes.
function safe(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function isLikelyEmail(addr) {
  return typeof addr === 'string' && /^\S+@\S+\.\S+$/.test(addr) && addr.length <= 254;
}

function htmlToPlainText(html) {
  return String(html || '')
    // Drop <script> and <style> blocks entirely.
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    // Replace block-level tags with newlines.
    .replace(/<\/?(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
    // Strip remaining tags.
    .replace(/<[^>]*>/g, '')
    // Decode the handful of entities we actually emit above.
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    // Collapse whitespace.
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .substring(0, 5000);
}

class EmailService {
  constructor() {
    const key = process.env.SENDGRID_API_KEY;
    if (key && key !== 'your_sendgrid_api_key_here') {
      sgMail.setApiKey(key);
      this.isConfigured = true;
      this.fromEmail = process.env.EMAIL_FROM || 'noreply@bravomusics.com';
      console.log('SendGrid configured');
    } else {
      this.isConfigured = false;
      this.fromEmail = process.env.EMAIL_FROM || 'noreply@bravomusics.com';
      console.log('SendGrid not configured — emails will be logged in mock mode');
    }
    this.frontendUrl = process.env.FRONTEND_URL || 'https://bravomusics.com';
  }

  async sendEmail(to, subject, html, text = null) {
    if (!isLikelyEmail(to)) {
      console.error('Refused to send email to invalid address:', to);
      return { success: false, error: 'Invalid recipient address' };
    }

    if (!this.isConfigured) {
      console.log(`[MOCK] would send "${subject}" to ${to}`);
      return { success: true, mock: true };
    }

    const msg = {
      to,
      from: { email: this.fromEmail, name: 'Bravo Music' },
      subject,
      html,
      text: text || htmlToPlainText(html),
    };

    try {
      const response = await sgMail.send(msg);
      return { success: true, response };
    } catch (error) {
      console.error('SendGrid error:', error.response?.body || error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================
  // Verification email
  // ============================================================
  async sendVerificationEmail(email, token, username) {
    // Token is 32 random hex bytes from authController — already URL-safe.
    // But encodeURIComponent is defensive in case the policy ever changes.
    const verificationUrl = `${this.frontendUrl}/#verify-email/${encodeURIComponent(token)}`;
    const safeUsername = safe(username);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4}
  .container{max-width:600px;margin:0 auto;padding:20px;background:#fff}
  .header{background:linear-gradient(135deg,#6c63ff,#8b44c8);color:#fff;padding:40px 30px;text-align:center;border-radius:12px 12px 0 0}
  .content{padding:30px;background:#f9f9f9;border-radius:0 0 12px 12px}
  .button{display:inline-block;padding:14px 35px;background:linear-gradient(135deg,#6c63ff,#8b44c8);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;margin:20px 0}
  .footer{text-align:center;padding:20px;font-size:12px;color:#888}
</style></head>
<body><div class="container">
  <div class="header"><h1>Verify Your Email Address</h1></div>
  <div class="content">
    <h2>Welcome, ${safeUsername}!</h2>
    <p>Thanks for joining Bravo Music. Click the button below to verify your email and unlock your account.</p>
    <p style="text-align:center"><a href="${verificationUrl}" class="button">Verify Email Address</a></p>
    <p>Or copy this link into your browser:</p>
    <p style="word-break:break-all;background:#eee;padding:10px;border-radius:5px">${safe(verificationUrl)}</p>
    <p>This link expires in 24 hours.</p>
  </div>
  <div class="footer">Bravo Music — Zambia's Premier Music Platform</div>
</div></body></html>`;

    return this.sendEmail(email, 'Verify Your Email - Bravo Music', html);
  }

  // ============================================================
  // Welcome (post-verification)
  // ============================================================
  async sendWelcomeEmail(email, username) {
    const safeUsername = safe(username);
    const dashboardUrl = `${this.frontendUrl}/#dashboard`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4}
  .container{max-width:600px;margin:0 auto;padding:20px;background:#fff}
  .header{background:linear-gradient(135deg,#6c63ff,#8b44c8);color:#fff;padding:40px 30px;text-align:center;border-radius:12px 12px 0 0}
  .content{padding:30px;background:#f9f9f9;border-radius:0 0 12px 12px}
  .button{display:inline-block;padding:14px 35px;background:linear-gradient(135deg,#6c63ff,#8b44c8);color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;margin:20px 0}
</style></head>
<body><div class="container">
  <div class="header"><h1>Welcome to Bravo Music!</h1></div>
  <div class="content">
    <h2>Hi ${safeUsername},</h2>
    <p>Your email is verified. You can now upload music, build your following, and start earning royalties.</p>
    <p style="text-align:center"><a href="${dashboardUrl}" class="button">Go to Your Dashboard</a></p>
  </div>
</div></body></html>`;

    return this.sendEmail(email, 'Welcome to Bravo Music!', html);
  }

  // ============================================================
  // Password reset request
  // ============================================================
  async sendPasswordResetEmail(email, token, username) {
    const resetUrl = `${this.frontendUrl}/#reset-password/${encodeURIComponent(token)}`;
    const safeUsername = safe(username);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4}
  .container{max-width:600px;margin:0 auto;padding:20px;background:#fff}
  .header{background:linear-gradient(135deg,#ff6584,#ff9580);color:#fff;padding:40px 30px;text-align:center;border-radius:12px 12px 0 0}
  .content{padding:30px;background:#f9f9f9;border-radius:0 0 12px 12px}
  .button{display:inline-block;padding:14px 35px;background:#ff6584;color:#fff;text-decoration:none;border-radius:50px;font-weight:bold;margin:20px 0}
</style></head>
<body><div class="container">
  <div class="header"><h1>Reset Your Password</h1></div>
  <div class="content">
    <h2>Hi ${safeUsername},</h2>
    <p>We received a request to reset your password. If that was you, click below to set a new one.</p>
    <p style="text-align:center"><a href="${resetUrl}" class="button">Reset Password</a></p>
    <p>Or copy this link: <span style="word-break:break-all">${safe(resetUrl)}</span></p>
    <p>This link expires in 1 hour. If you didn't request this, you can ignore the email.</p>
  </div>
</div></body></html>`;

    return this.sendEmail(email, 'Reset Your Password - Bravo Music', html);
  }

  // ============================================================
  // Password change confirmation
  // ============================================================
  async sendPasswordChangeConfirmation(email, username) {
    const safeUsername = safe(username);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4}
  .container{max-width:600px;margin:0 auto;padding:20px;background:#fff}
  .header{background:linear-gradient(135deg,#4caf50,#45a049);color:#fff;padding:40px 30px;text-align:center;border-radius:12px 12px 0 0}
  .content{padding:30px;background:#f9f9f9;border-radius:0 0 12px 12px}
  .check{font-size:60px;text-align:center;margin:20px 0}
</style></head>
<body><div class="container">
  <div class="header"><h1>Password Changed</h1></div>
  <div class="content">
    <div class="check">✓</div>
    <h2>Hi ${safeUsername || 'there'},</h2>
    <p>Your Bravo Music account password has been changed.</p>
    <p>If you didn't make this change, contact support immediately at support@bravomusics.com.</p>
  </div>
</div></body></html>`;

    return this.sendEmail(email, 'Your Password Has Been Changed - Bravo Music', html);
  }

  // ============================================================
  // Withdrawal status notification
  // ============================================================
  async sendWithdrawalNotification(email, amount, status, reference) {
    const safeAmount = safe(amount);
    const safeStatus = safe(status);
    const safeReference = safe(reference);
    const statusColor = status === 'approved' ? '#4caf50' : '#ff6584';

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  .container{max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif}
  .status{color:${statusColor};font-weight:bold}
</style></head>
<body><div class="container">
  <h2>Withdrawal ${safeStatus.toUpperCase()}</h2>
  <p>Amount: <strong>K${safeAmount}</strong></p>
  <p>Status: <span class="status">${safeStatus}</span></p>
  <p>Reference: ${safeReference}</p>
  ${status === 'approved'
    ? '<p>Funds have been sent to your mobile money account.</p>'
    : '<p>Contact support for more information.</p>'}
</div></body></html>`;

    return this.sendEmail(email, `Withdrawal ${safeStatus} - Bravo Music`, html);
  }

  // ============================================================
  // Weekly digest (called from a cron — not user-triggered)
  // ============================================================
  async sendWeeklyDigest(email, username, stats = {}) {
    const safeUsername = safe(username);
    const safeMinutes = safe(stats.minutesListened || 0);
    const safeNewSongs = safe(stats.newSongs || 0);
    const safeTopGenre = safe(stats.topGenre || 'Various');
    const dashboardUrl = `${this.frontendUrl}/#dashboard`;

    const html = `<!DOCTYPE html>
<html><head><style>
  body{font-family:Arial,sans-serif;margin:0;padding:0;background:#f4f4f4}
  .container{max-width:600px;margin:0 auto;padding:20px;background:#fff}
  .stats{display:flex;justify-content:space-around;margin:20px 0}
  .stat-box{text-align:center;padding:15px;background:#f0f0f0;border-radius:10px;flex:1;margin:0 5px}
  .stat-number{font-size:24px;font-weight:bold;color:#6c63ff}
</style></head>
<body><div class="container">
  <h2>Your Weekly Music Digest, ${safeUsername}!</h2>
  <div class="stats">
    <div class="stat-box"><div class="stat-number">${safeMinutes}</div><div>Minutes Listened</div></div>
    <div class="stat-box"><div class="stat-number">${safeNewSongs}</div><div>New Songs</div></div>
    <div class="stat-box"><div class="stat-number">${safeTopGenre}</div><div>Top Genre</div></div>
  </div>
  <a href="${dashboardUrl}" style="display:inline-block;background:#6c63ff;color:#fff;padding:12px 30px;text-decoration:none;border-radius:5px">View Full Report</a>
</div></body></html>`;

    return this.sendEmail(email, 'Your Weekly Bravo Music Digest', html);
  }
}

export default new EmailService();
