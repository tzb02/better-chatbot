import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(data: EmailData) {
  const mailOptions = {
    from: data.from || `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
    to: data.to,
    subject: data.subject,
    html: data.html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, data: {
  activationLink: string;
  userName: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Welcome to OfficeManagerGPT, ${data.userName}!</h1>

      <p>Your account has been successfully created and your setup fee has been processed.</p>

      <p>To activate your account and start using all features, please click the link below:</p>

      <a href="${data.activationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
        Activate Your Account
      </a>

      <p>This activation link will expire in 48 hours for security reasons.</p>

      <p>If you have any questions, please don't hesitate to contact our support team.</p>

      <p>Best regards,<br>The OfficeManagerGPT Team</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: 'Welcome to OfficeManagerGPT - Account Activation Required',
    html,
  });
}

export async function sendOrganizationInvitationEmail(email: string, data: {
  organizationName: string;
  invitedBy: string;
  acceptUrl: string;
}) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>You've been invited to join ${data.organizationName}</h1>

      <p>${data.invitedBy} has invited you to join their organization on OfficeManagerGPT.</p>

      <p>Click the link below to accept the invitation and join the team:</p>

      <a href="${data.acceptUrl}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 16px 0;">
        Accept Invitation
      </a>

      <p>This invitation link will expire in 7 days.</p>

      <p>If you don't have an account yet, you'll be prompted to create one during the acceptance process.</p>

      <p>Best regards,<br>The OfficeManagerGPT Team</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: `Invitation to join ${data.organizationName} on OfficeManagerGPT`,
    html,
  });
}

export async function sendPaymentSuccessEmail(email: string, data: {
  userName: string;
  amount: string;
  paymentType: 'setup_fee' | 'subscription';
}) {
  const paymentTypeText = data.paymentType === 'setup_fee' ? 'setup fee' : 'subscription';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1>Payment Successful!</h1>

      <p>Hi ${data.userName},</p>

      <p>Your ${paymentTypeText} payment of ${data.amount} has been processed successfully.</p>

      ${data.paymentType === 'subscription'
        ? '<p>Your subscription is now active and you have access to all premium features.</p>'
        : '<p>Your account setup is complete. You can now proceed with the onboarding process.</p>'
      }

      <p>Thank you for choosing OfficeManagerGPT!</p>

      <p>Best regards,<br>The OfficeManagerGPT Team</p>
    </div>
  `;

  return await sendEmail({
    to: email,
    subject: `Payment Successful - ${data.amount}`,
    html,
  });
}