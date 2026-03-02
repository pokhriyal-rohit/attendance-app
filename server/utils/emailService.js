const nodemailer = require("nodemailer");

const ensureSmtpConfig = () => {
  const requiredVariables = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);
  if (missingVariables.length > 0) {
    throw new Error("SMTP configuration is missing");
  }
};

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  if (!to) {
    throw new Error("Recipient email is required");
  }

  if (!subject) {
    throw new Error("Email subject is required");
  }

  ensureSmtpConfig();
  const transporter = createTransporter();

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
    attachments,
  });
};

const sendAttendanceReportEmail = async ({
  to,
  subject,
  text,
  attachmentBuffer,
  fileName = "attendance.xlsx",
}) => {
  if (!to) {
    throw new Error("Recipient email is required");
  }

  if (!attachmentBuffer) {
    throw new Error("Email attachment buffer is required");
  }

  await sendEmail({
    to,
    subject,
    text,
    attachments: [
      {
        filename: fileName,
        content: attachmentBuffer,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    ],
  });
};

const verifySmtpTransport = async () => {
  ensureSmtpConfig();
  const transporter = createTransporter();
  await transporter.verify();
};

module.exports = { sendEmail, sendAttendanceReportEmail, verifySmtpTransport };
