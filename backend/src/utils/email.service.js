const { Resend } = require("resend");
const ENV = require("../configs/env");

let resendClient;

function getResendClient() {
  if (!ENV.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!resendClient) {
    resendClient = new Resend(ENV.RESEND_API_KEY);
  }

  return resendClient;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildFromAddress() {
  return `${ENV.MAIL_FROM_NAME} <${ENV.MAIL_FROM_EMAIL}>`;
}

async function sendPasswordResetEmail({ to, name, resetUrl, expiresInMinutes }) {
  const displayName = name ? name.split(" ").at(0) : "there";
  const safeName = escapeHtml(displayName);
  const safeResetUrl = escapeHtml(resetUrl);
  const safeExpiresIn = escapeHtml(expiresInMinutes);

  const { error } = await getResendClient().emails.send({
    from: buildFromAddress(),
    to: [to],
    subject: "Reset your Bookify password",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 560px; margin: 0 auto;">
        <h1 style="font-size: 24px; margin: 0 0 16px;">Reset your password</h1>
        <p>Hi ${safeName},</p>
        <p>We received a request to reset your Bookify password. Use the button below to choose a new password.</p>
        <p style="margin: 28px 0;">
          <a href="${safeResetUrl}" style="background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; display: inline-block; font-weight: 700;">Reset password</a>
        </p>
        <p>This link expires in ${safeExpiresIn} minutes. If you did not request this, you can ignore this email.</p>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">If the button does not work, copy and paste this link into your browser:<br />${safeResetUrl}</p>
      </div>
    `,
    text: `Hi ${displayName},

We received a request to reset your Bookify password.

Reset your password: ${resetUrl}

This link expires in ${expiresInMinutes} minutes. If you did not request this, you can ignore this email.`,
  });

  if (error) {
    throw new Error(error.message || "Resend failed to send email");
  }
}

module.exports = { sendPasswordResetEmail };
