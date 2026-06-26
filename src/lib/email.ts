import { Resend } from "resend";

function resendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email is not configured");
  return new Resend(apiKey);
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "Actions Tracker <onboarding@resend.dev>";
}

export async function sendPasswordResetEmail(params: {
  to: string;
  username: string;
  resetUrl: string;
}) {
  const resend = resendClient();
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to: params.to,
    subject: "Reset your Actions Tracker password",
    html: `
      <p>Hi ${escapeHtml(params.username)},</p>
      <p>We received a request to reset your password. Click the link below to choose a new one. This link expires in 1 hour.</p>
      <p><a href="${params.resetUrl}">Reset password</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `
  });
  if (error) throw new Error(error.message);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
