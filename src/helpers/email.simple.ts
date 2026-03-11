import * as nodemailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export interface EmailOptions {
  to: string;
  subject: string;
  type:
    | "code"
    | "success"
    | "notification"
    | "contact_invitation"
    | "invitation_response"
    | "group_invitation"
    | "group_join_request"
    | "join_request_response"
    | "email_verification"
    | "admin_user_creation"
    | "admin_organization_creation";
  data: { [key: string]: string | undefined };
}

// Simplified email service with aggressive timeout handling
const sendEmail = async ({
  to,
  subject,
  type,
  data,
}: EmailOptions): Promise<void> => {

  // Create transporter for each email to avoid connection issues
  const transportOptions: SMTPTransport.Options = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  };

  const transporter = nodemailer.createTransport(transportOptions);

  const generateEmailTemplate = (
    type: string,
    data: { [key: string]: string | undefined },
  ): string => {
    switch (type) {
      case "email_verification":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Welcome ${
              data.name
            }!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Thank you for registering with us! To complete your registration and verify your email address, please use the following OTP and click the button below.
            </p>
            <p style="color: #333; font-size: 18px; font-weight: bold; margin-bottom: 20px;">
              Your OTP: <span style="color: #00B512;">${
                data.otp || "N/A"
              }</span>
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 30px;">
              This OTP and verification link will expire in 10 minutes for security reasons.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.verificationUrl}" style="
                display: inline-block;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
                background: #00B512;
                color: white;
                font-size: 16px;
              ">Verify My Email Address</a>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
              If the button doesn't work, you can also copy and paste this link into your browser:<br/>
              <span style="color: #00B512; word-break: break-all;">${
                data.verificationUrl
              }</span>
            </p>
          </div>
        `;
      case "admin_user_creation":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Welcome ${
              data.name
            }!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              An account has been created for you by an administrator. You can now log in and start using our platform.
            </p>
            <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <h3 style="color: #333; font-size: 16px; margin-bottom: 15px;">Your Login Credentials:</h3>
              <p style="color: #666; font-size: 14px; margin: 8px 0;">
                <strong>Email:</strong> <span style="color: #00B512;">${
                  data.email
                }</span>
              </p>
              <p style="color: #666; font-size: 14px; margin: 8px 0;">
                <strong>Password:</strong> <span style="color: #00B512; font-family: monospace;">${
                  data.password
                }</span>
              </p>
            </div>
            <p style="color: #ff6b6b; font-size: 14px; margin-bottom: 20px;">
              ⚠️ For security reasons, please change your password after your first login.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl}" style="
                display: inline-block;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
                background: #00B512;
                color: white;
                font-size: 16px;
              ">Login to Your Account</a>
            </div>
          </div>
        `;
      case "admin_organization_creation":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Welcome ${
              data.organizationName
            }!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Your organization account has been created by an administrator. You can now log in and start managing your organization.
            </p>
            <div style="background-color: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <h3 style="color: #333; font-size: 16px; margin-bottom: 15px;">Your Login Credentials:</h3>
              <p style="color: #666; font-size: 14px; margin: 8px 0;">
                <strong>Organization Email:</strong> <span style="color: #00B512;">${
                  data.email
                }</span>
              </p>
              <p style="color: #666; font-size: 14px; margin: 8px 0;">
                <strong>Password:</strong> <span style="color: #00B512; font-family: monospace;">${
                  data.password
                }</span>
              </p>
            </div>
            <p style="color: #ff6b6b; font-size: 14px; margin-bottom: 20px;">
              ⚠️ For security reasons, please change your password after your first login.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.loginUrl}" style="
                display: inline-block;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
                background: #00B512;
                color: white;
                font-size: 16px;
              ">Login to Organization Account</a>
            </div>
          </div>
        `;
      case "success":
        return `
          <div style="text-align: center;">
            <h2 style="color: #00B512; font-size: 22px; font-weight: bold;">Action Successful!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              ${data.message}
            </p>
          </div>
        `;
      default:
        return `<p style="text-align: center; color: #ff0000;">Invalid email type</p>`;
    }
  };

  const htmlTemplate = `
    <div style="
      font-family: Arial, sans-serif;
      max-width: 600px;
      margin: 20px auto;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      text-align: center;
    ">
      <div style="background-color: #00B512; color: #ffffff; padding: 20px;">
        <h1 style="font-size: 26px; margin: 0;">QiewCode</h1>
      </div>
      <div style="padding: 30px 20px;">
        ${generateEmailTemplate(type, data)}
      </div>
      <div style="background-color: #f9f9f9; padding: 20px; color: #666; font-size: 14px;">
        <p>Thank you for choosing us!</p>
        <p>Need help? Contact us at <a href="mailto:support@qiewcode.com" style="color: #00B512; text-decoration: none;">support@qiewcode.com</a></p>
      </div>
    </div>
  `;

  console.log(`📧 Template generated, preparing to send...`);
  const startTime = Date.now();

  try {
    // Create a promise that times out after 10 seconds
    const emailPromise = transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlTemplate,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Email sending timeout after 10 seconds")),
        10000,
      ),
    );

    console.log(`📧 Sending email...`);
    await Promise.race([emailPromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    console.log(`✅ Email sent successfully to ${to} in ${duration}ms`);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(
      `❌ Failed to send email to ${to} after ${duration}ms:`,
      error.message,
    );
    throw new Error(`Email sending failed: ${error.message}`);
  } finally {
    // Always close the transporter
    transporter.close();
    console.log(`📧 Transporter closed`);
  }
};

export default sendEmail;
