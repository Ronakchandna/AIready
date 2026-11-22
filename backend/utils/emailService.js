const nodemailer = require('nodemailer');

// Two ways to send email:
//   1. BREVO_API_KEY  - Brevo's HTTPS API (works on hosts that block SMTP ports, e.g. Render free tier)
//   2. EMAIL_HOST/EMAIL_USER/EMAIL_PASS - plain SMTP (e.g. Gmail app password), fine for local dev
const isProd = process.env.NODE_ENV === 'production';

const emailConfigured = () =>
    !!(process.env.BREVO_API_KEY || (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS));

const sendViaBrevo = async ({ from, to, subject, html }) => {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { name: 'AIReady', email: from }, to: [{ email: to }], subject, htmlContent: html }),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Brevo API ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

const createTransporter = () => {
    const host = process.env.EMAIL_HOST;
    const port = parseInt(process.env.EMAIL_PORT, 10);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
        console.warn('[EmailService] EMAIL_HOST, EMAIL_USER, or EMAIL_PASS not set. Emails will be logged to console instead.');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: { user, pass },
        // fail fast instead of hanging for minutes when the SMTP port is blocked
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
    });
};

/**
 * Sends a password reset OTP email.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 */
const sendOtpEmail = async (toEmail, otp) => {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@aiready.app';

    const htmlBody = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8fafc; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">
                <span style="color: #7c3aed;">AI</span><span style="color: #0f172a;">Ready</span>
            </h1>
        </div>
        <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <h2 style="margin: 0 0 8px; font-size: 20px; color: #1e293b;">Password Reset</h2>
            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                You requested a password reset. Use the code below to set a new password. This code expires in <strong>10 minutes</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6366f1 100%); color: #ffffff; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px;">
                    ${otp}
                </div>
            </div>
            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 24px 0 0;">
                If you didn't request this, please ignore this email. Your password will remain unchanged.
            </p>
        </div>
        <p style="color: #cbd5e1; font-size: 11px; text-align: center; margin-top: 16px;">
            &copy; ${new Date().getFullYear()} AIReady. All rights reserved.
        </p>
    </div>`;

    const mailOptions = {
        from,
        to: toEmail,
        subject: 'AIReady — Your Password Reset Code',
        html: htmlBody,
    };

    try {
        if (process.env.BREVO_API_KEY) {
            await sendViaBrevo({ from, to: toEmail, subject: mailOptions.subject, html: htmlBody });
        } else {
            const transporter = createTransporter();
            if (!transporter) throw new Error('email is not configured');
            await transporter.sendMail(mailOptions);
        }
        console.log('[EmailService] OTP email sent');
        return true;
    } catch (error) {
        console.error('[EmailService] Failed to send OTP email:', error.message);
        // Local development only: print the code so the reset flow can still be tested
        if (!isProd) console.log(`[EmailService] DEV FALLBACK - OTP for ${toEmail}: ${otp}`);
        return false;
    }
};

module.exports = { sendOtpEmail, emailConfigured };
