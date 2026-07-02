const nodemailer = require("nodemailer");

let transporterPromise = null;

function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (process.env.SMTP_HOST) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
    );
  } else {
    // No SMTP configured: fall back to an Ethereal test account (free, no signup)
    // so emails can still be "sent" and previewed during local development.
    transporterPromise = nodemailer.createTestAccount().then((testAccount) =>
      nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      })
    );
  }
  return transporterPromise;
}

async function sendEmail({ to, subject, html }) {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Rent & Flatmate Finder" <no-reply@rff.local>',
      to,
      subject,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[email] Preview URL (Ethereal test account): ${previewUrl}`);
    }
    return info;
  } catch (err) {
    // Email failures must never break the calling request flow.
    console.error("[email] Failed to send email:", err.message);
    return null;
  }
}

async function notifyOwnerHighCompatibilityInterest({ ownerEmail, ownerName, tenantName, listingLocation, score, explanation }) {
  return sendEmail({
    to: ownerEmail,
    subject: `Strong match (${score}/100) interested in your listing`,
    html: `
      <p>Hi ${ownerName},</p>
      <p><strong>${tenantName}</strong> has expressed interest in your listing at <strong>${listingLocation}</strong>
      with a high AI compatibility score of <strong>${score}/100</strong>.</p>
      <p><em>${explanation}</em></p>
      <p>Log in to Rent & Flatmate Finder to review and respond.</p>
    `,
  });
}

async function notifyTenantInterestResponse({ tenantEmail, tenantName, listingLocation, accepted }) {
  return sendEmail({
    to: tenantEmail,
    subject: accepted
      ? `Your interest in a room at ${listingLocation} was accepted!`
      : `Update on your interest at ${listingLocation}`,
    html: `
      <p>Hi ${tenantName},</p>
      <p>The owner of the listing at <strong>${listingLocation}</strong> has
      <strong>${accepted ? "accepted" : "declined"}</strong> your interest request.</p>
      ${accepted ? "<p>You can now chat with the owner directly on the platform.</p>" : ""}
    `,
  });
}

module.exports = { sendEmail, notifyOwnerHighCompatibilityInterest, notifyTenantInterestResponse };
