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
  | "group_creation_notification"
  | "fundraising_target_reached"
  | "group_expiring_soon";
  data: { [key: string]: string | undefined };
}

// Create a singleton transporter to reuse connections
class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter;
  private isConnected = false;

  private constructor() {
    const transportOptions: SMTPTransport.Options = {
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      // Timeout settings to prevent hanging
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    };

    this.transporter = nodemailer.createTransport(transportOptions);

    // Don't verify connection on startup - do it when needed
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.isConnected = true;
      console.log("SMTP connection verified successfully");
    } catch (error) {
      console.error("SMTP connection verification failed:", error);
      this.isConnected = false;
    }
  }

  private generateEmailTemplate(
    type: string,
    data: { [key: string]: string | undefined }
  ): string {
    switch (type) {
      case "code":
        // First check if data.code exists and is a string
        if (!data.code || typeof data.code !== "string") {
          return `<p style="text-align: center; color: #ff0000;">Invalid verification code</p>`;
        }

        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Verification Code</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Use the following verification code to complete your action. This code will expire in ${data.expiryTime || '2 days'}. Please do not share it with anyone.
            </p>
            <div style="display: inline-flex; justify-content: center; align-items: center; gap: 15px; margin: 0 auto 30px;">
              ${[...data.code]
            .map(
              (digit) => `
                    <div style="
                      width: 50px;
                      height: 50px;
                      font-size: 20px;
                      font-weight: bold;
                      color: #00B512;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      margin: 0 auto;
                    ">
                      ${digit}
                    </div>
                  `
            )
            .join("")}
            </div>
            ${data.verificationUrl
            ? `
            <h2>or use the following link to verify your account</h2>
            <p>Click the link below:</p>
            <a href="${data.verificationUrl}" style="color: #00B512; text-decoration: none; background-color: #00B512; padding: 10px 20px; border-radius: 5px; color: #fff;">Verify my account</a>`
            : ""
          }
      </div>
    `;
      case "email_verification":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Welcome ${data.name}!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Thank you for registering with us! To complete your registration and verify your email address, please click the button below.
            </p>
            <p style="color: #666; font-size: 14px; margin-bottom: 30px;">
              This verification link will expire in 2 days for security reasons.
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
              <span style="color: #00B512; word-break: break-all;">${data.verificationUrl}</span>
            </p>
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
      case "notification":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">${data.title}</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              ${data.body}
            </p>
          </div>
        `;
      case "contact_invitation":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Contact Invitation</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              <strong>${data.inviterName}</strong> (${data.inviterEmail}) would like to add you to their contacts.
            </p>
            
            <p>You can respond to this invitation by clicking one of the buttons below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.acceptUrl}" style="
                display: inline-block;
                padding: 12px 24px;
                margin: 10px 5px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
                background: #28a745;
                color: white;
              ">Accept Invitation</a>
              <a href="${data.rejectUrl}" style="
                display: inline-block;
                padding: 12px 24px;
                margin: 10px 5px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                text-align: center;
                background: #dc3545;
                color: white;
              ">Decline Invitation</a>
            </div>
            
            <p>If the buttons don't work, you can copy and paste these URLs into your browser:</p>
            <p><strong>Accept:</strong> ${data.acceptUrl}</p>
            <p><strong>Decline:</strong> ${data.rejectUrl}</p>
          </div>
        `;
      case "invitation_response":
        const isAccepted = data.action === "accept";
        const invitationBgColor = isAccepted ? "#28a745" : "#dc3545";
        return `
          <div style="text-align: center;">
            <h2 style="color: ${invitationBgColor}; font-size: 22px; font-weight: bold;">Invitation ${isAccepted ? "Accepted" : "Declined"
          }</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              <strong>${data.responderName}</strong> has <strong>${data.actionText
          }</strong> your contact invitation.
            </p>
            
            ${isAccepted
            ? '<p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">You can now view them in your contacts list and start connecting!</p>'
            : '<p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Don\'t worry, you can always try reaching out through other means.</p>'
          }
          </div>
        `;
      case "group_invitation":
        return `
    <div style="text-align: center;">
      <h2 style="color: #333; font-size: 22px; font-weight: bold;">You're Invited to Join a Group!</h2>
      <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
        <strong>${data.inviterName
          }</strong> has invited you to join the group <strong>${data.groupName
          }</strong>.
      </p>
      <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
        ${data.groupDescription || "No group description provided."}
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.acceptUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          margin: 10px 5px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          text-align: center;
          background: #28a745;
          color: white;
        ">Accept Invitation</a>
        <a href="${data.rejectUrl}" style="
          display: inline-block;
          padding: 12px 24px;
          margin: 10px 5px;
          text-decoration: none;
          border-radius: 5px;
          font-weight: bold;
          text-align: center;
          background: #dc3545;
          color: white;
        ">Decline Invitation</a>
      </div>

      <p>If the buttons don't work, use these links:</p>
      <p><strong>Accept:</strong> <a href="${data.acceptUrl
          }" style="color: #00B512;">${data.acceptUrl}</a></p>
      <p><strong>Decline:</strong> <a href="${data.rejectUrl
          }" style="color: #dc3545;">${data.rejectUrl}</a></p>
    </div>
  `;
      case "group_join_request":
        return `
        <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">New Group Join Request</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                <strong>${data.userName}</strong> (${data.userEmail}) has requested to join your group <strong>${data.groupName}</strong>.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.approveUrl}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    margin: 10px 5px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    text-align: center;
                    background: #28a745;
                    color: white;
                ">Approve Request</a>
                <a href="${data.declineUrl}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    margin: 10px 5px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    text-align: center;
                    background: #dc3545;
                    color: white;
                ">Decline Request</a>
            </div>
            
            <p>If the buttons don't work, you can copy and paste these URLs into your browser:</p>
            <p><strong>Approve:</strong> ${data.approveUrl}</p>
            <p><strong>Decline:</strong> ${data.declineUrl}</p>
        </div>
    `;
      case "join_request_response":
        const isApproved = data.action === "approved";
        const bgColor = isApproved ? "#28a745" : "#dc3545";
        return `
        <div style="text-align: center;">
            <h2 style="color: ${bgColor}; font-size: 22px; font-weight: bold;">
                ${isApproved ? "✓ Join Request Approved" : "✗ Join Request Declined"}
            </h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                <strong>${data.responderName}</strong> has <strong>${data.actionText}</strong> for 
                <strong>${data.groupName}</strong>.
            </p>
            
            ${isApproved
            ? `
                <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                    ${data.message || "You can now access the group and participate in conversations."}
                </p>
                ${data.groupLink
              ? `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.groupLink}" style="
                        display: inline-block;
                        padding: 12px 24px;
                        margin: 10px 5px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                        text-align: center;
                        background: #28a745;
                        color: white;
                    ">Open Group</a>
                </div>
                <p>Or copy and paste this URL into your browser:</p>
                <p><a href="${data.groupLink}" style="color: #00B512;">${data.groupLink}</a></p>
                `
              : ""
            }
                `
            : `
                <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                    ${data.message || "Feel free to request to join again if you wish."}
                </p>
                `
          }
        </div>
        `;
      case "group_creation_notification":
        return `
        <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">🎉 Group Created Successfully!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                Your group <strong>${data.groupName}</strong> has been created successfully!
            </p>
            
            ${data.groupDescription ? `
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 20px; font-style: italic;">
                "${data.groupDescription}"
            </p>
            ` : ''}
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #333; margin-bottom: 15px;">Group Details:</h3>
                <p><strong>Privacy:</strong> ${data.privacyType}</p>
                <p><strong>Max Members:</strong> ${data.maxMembers || 'Unlimited'}</p>
                ${data.hasFundraising === 'true' ? `<p><strong>Fundraising Target:</strong> $${data.fundraisingTarget}</p>` : ''}
                ${data.expirationDate ? `<p><strong>Expires:</strong> ${data.expirationDate}</p>` : ''}
            </div>
            
            ${data.accessLink ? `
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.accessLink}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    margin: 10px 5px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    text-align: center;
                    background: #007bff;
                    color: white;
                ">View Group</a>
            </div>
            ` : ''}
        </div>
        `;

      case "fundraising_target_reached":
        return `
        <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">🎯 Fundraising Target Reached!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                Congratulations! The group <strong>${data.groupName}</strong> has reached its fundraising target!
            </p>
            
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #c3e6cb;">
                <h3 style="color: #155724; margin-bottom: 15px;">🎉 Target Achieved!</h3>
                <p><strong>Target Amount:</strong> $${data.targetAmount}</p>
                <p><strong>Amount Raised:</strong> $${data.currentAmount}</p>
                <p><strong>Achievement Date:</strong> ${data.achievementDate}</p>
            </div>
            
            ${data.groupLink ? `
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.groupLink}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    margin: 10px 5px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    text-align: center;
                    background: #28a745;
                    color: white;
                ">View Group Details</a>
            </div>
            ` : ''}
        </div>
        `;

      case "group_expiring_soon":
        return `
        <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">⏰ Group Expiring Soon</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                The group <strong>${data.groupName}</strong> will expire soon!
            </p>
            
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #ffeaa7;">
                <h3 style="color: #856404; margin-bottom: 15px;">⚠️ Expiration Notice</h3>
                <p><strong>Expiration Date:</strong> ${data.expirationDate}</p>
                <p><strong>Days Remaining:</strong> ${data.daysRemaining}</p>
                <p><strong>Expiration Type:</strong> ${data.expirationType}</p>
            </div>
            
            <p style="color: #666; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                Make sure to complete any important activities before the group expires.
            </p>
            
            ${data.groupLink ? `
            <div style="text-align: center; margin: 30px 0;">
                <a href="${data.groupLink}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    margin: 10px 5px;
                    text-decoration: none;
                    border-radius: 5px;
                    font-weight: bold;
                    text-align: center;
                    background: #ffc107;
                    color: #212529;
                ">Manage Group</a>
            </div>
            ` : ''}
        </div>
        `;

      default:
        return `<p style="text-align: center; color: #ff0000;">Invalid email type</p>`;
    }
  }

  public async sendEmail({
    to,
    subject,
    type,
    data,
  }: EmailOptions): Promise<void> {
    console.log(`📧 Starting email send to: ${to}`);
    console.log(`📧 Email subject: ${subject}`);
    console.log(`📧 Email type: ${type}`);

    // Verify connection if not connected
    if (!this.isConnected) {
      console.log(`📧 Connection not verified, verifying...`);
      await this.verifyConnection();
    }

    console.log(`📧 Generating email template...`);
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
          <img 
            src="${process.env.EMAIL_LOGO_URL ||
      "https://res.cloudinary.com/daognkuqr/image/upload/v1735213214/lrbpfjaspdl0lafdw7tx.png"
      }" 
            alt="Company Logo" 
            style="max-width: 120px; margin: 0 auto 10px; display: block;"
          >
          <h1 style="font-size: 26px; margin: 0;">${process.env.EMAIL_COMPANY_NAME || "QiewCode"
      }</h1>
        </div>
        <div style="padding: 30px 20px;">
          ${this.generateEmailTemplate(type, data)}
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; color: #666; font-size: 14px;">
          <p>${process.env.EMAIL_FOOTER_TEXT || "Thank you for choosing us!"
      }</p>
          <p>Need help? Contact us at <a href="mailto:${process.env.EMAIL_SUPPORT
      }" style="color: #00B512; text-decoration: none;">${process.env.EMAIL_SUPPORT || "support@qiewcode.com"
      }</a></p>
        </div>
      </div>
    `;

    console.log(`📧 Template generated, preparing to send...`);
    const startTime = Date.now();

    try {
      // Add a timeout promise
      const emailPromise = this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        html: htmlTemplate,
      });

      const timeoutPromise = new Promise(
        (_, reject) =>
          setTimeout(() => reject(new Error("Email sending timeout")), 15000) // 15 second timeout
      );

      console.log(`📧 Sending email to transporter...`);
      await Promise.race([emailPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      console.log(`✅ Email sent successfully to ${to} in ${duration}ms`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Failed to send email to ${to} after ${duration}ms:`,
        error.message
      );
      console.error(`❌ Full error:`, error);

      // Try to reconnect on failure
      this.isConnected = false;
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }

  // Method to close connections gracefully
  public async close(): Promise<void> {
    this.transporter.close();
    console.log("Email transporter closed");
  }
}

// Export the singleton instance method
const emailService = EmailService.getInstance();

const sendEmail = async (options: EmailOptions): Promise<void> => {
  return emailService.sendEmail(options);
};

export default sendEmail;

// For graceful shutdown
process.on("SIGTERM", async () => {
  await emailService.close();
});

process.on("SIGINT", async () => {
  await emailService.close();
});
