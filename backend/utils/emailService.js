const nodemailer = require('nodemailer');

/**
 * Creates a Nodemailer transporter using environment variables.
 * Falls back to console logging if email config is missing.
 */
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
    });
};

/**
 * Sends a password reset OTP email.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - The 6-digit OTP code
 */
const sendOtpEmail = async (toEmail, otp) => {
    const transporter = createTransporter();
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

    if (!transporter) {
        // Fallback: log to console for development
        console.log('[EmailService] OTP Email (console fallback):');
        console.log(`  To: ${toEmail}`);
        console.log(`  OTP: ${otp}`);
        return;
    }

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[EmailService] OTP email sent to ${toEmail}`);
    } catch (error) {
        // Fallback: log OTP to console so dev/testing can still proceed
        console.error('[EmailService] Failed to send OTP email:', error.message);
        console.log(`[EmailService] FALLBACK — OTP for ${toEmail}: ${otp}`);
        console.log('[EmailService] Update EMAIL_USER and EMAIL_PASS in .env with real credentials to send actual emails.');
    }
};

module.exports = { sendOtpEmail };
