import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  type: "code" | "success" | "notification" | "contact_invitation" | "invitation_response" | "group_invitation" | "group_join_request" | "join_request_response";
  data: { [key: string]: string | undefined };
}

const sendEmail = async ({ to, subject, type, data }: EmailOptions): Promise<void> => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const generateEmailTemplate = (): string => {
    switch (type) {
      case "code":
        // First check if data.code exists and is a string
        if (!data.code || typeof data.code !== 'string') {
          return `<p style="text-align: center; color: #ff0000;">Invalid verification code</p>`;
        }

        return `
      <div style="text-align: center;">
        <h2 style="color: #333; font-size: 22px; font-weight: bold;">Verification Code</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
          Use the following verification code to complete your action. This code will expire in 10 minutes. Please do not share it with anyone.
        </p>
        <div style="display: inline-flex; justify-content: center; align-items: center; gap: 15px; margin: 0 auto 30px;">
          ${data.code.split('').map(
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
        ).join('')}
        </div>
        ${data.verificationUrl
            ? `
          <p>Click the link below:</p>
          <a href="${data.verificationUrl}" style="color: #00B512; text-decoration: none;">Verify my account</a>`
            : ""
          }
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
        const isAccepted = data.action === 'accept';
        const invitationBgColor = isAccepted ? '#28a745' : '#dc3545';
        return `
          <div style="text-align: center;">
            <h2 style="color: ${invitationBgColor}; font-size: 22px; font-weight: bold;">Invitation ${isAccepted ? 'Accepted' : 'Declined'}</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              <strong>${data.responderName}</strong> has <strong>${data.actionText}</strong> your contact invitation.
            </p>
            
            ${isAccepted ?
            '<p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">You can now view them in your contacts list and start connecting!</p>' :
            '<p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">Don\'t worry, you can always try reaching out through other means.</p>'
          }
          </div>
        `;
      case "group_invitation":
        return `
    <div style="text-align: center;">
      <h2 style="color: #333; font-size: 22px; font-weight: bold;">You're Invited to Join a Group!</h2>
      <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
        <strong>${data.inviterName}</strong> has invited you to join the group <strong>${data.groupName}</strong>.
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
      <p><strong>Accept:</strong> <a href="${data.acceptUrl}" style="color: #00B512;">${data.acceptUrl}</a></p>
      <p><strong>Decline:</strong> <a href="${data.rejectUrl}" style="color: #dc3545;">${data.rejectUrl}</a></p>
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
        const isApproved = data.action === 'approved';
        const bgColor = isApproved ? '#28a745' : '#dc3545';
        return `
        <div style="text-align: center;">
            <h2 style="color: ${bgColor}; font-size: 22px; font-weight: bold;">
                Join Request ${isApproved ? 'Approved' : 'Rejected'}
            </h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                <strong>${data.responderName}</strong> has <strong>${data.action}</strong> your request to join 
                <strong>${data.groupName}</strong>.
            </p>
            
            ${isApproved ? `
                <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                    ${data.message}
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
                        background: #28a745;
                        color: white;
                    ">Go to Group</a>
                </div>
                <p>Or copy and paste this URL into your browser:</p>
                <p><a href="${data.groupLink}" style="color: #00B512;">${data.groupLink}</a></p>
                ` : ''}
            ` : `
                <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                    ${data.message}
                </p>
            `}
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
        <img 
          src="${process.env.EMAIL_LOGO_URL || 'https://res.cloudinary.com/daognkuqr/image/upload/v1735213214/lrbpfjaspdl0lafdw7tx.png'}" 
          alt="Company Logo" 
          style="max-width: 120px; margin: 0 auto 10px; display: block;"
        >
        <h1 style="font-size: 26px; margin: 0;">${process.env.EMAIL_COMPANY_NAME || 'QiewCode'}</h1>
      </div>
      <div style="padding: 30px 20px;">
        ${generateEmailTemplate()}
      </div>
      <div style="background-color: #f9f9f9; padding: 20px; color: #666; font-size: 14px;">
        <p>${process.env.EMAIL_FOOTER_TEXT || 'Thank you for choosing us!'}</p>
        <p>Need help? Contact us at <a href="mailto:${process.env.EMAIL_SUPPORT}" style="color: #00B512; text-decoration: none;">${process.env.EMAIL_SUPPORT || 'support@qiewcode.com'}</a></p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html: htmlTemplate,
    });
    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw new Error("Email sending failed");
  }
};

export default sendEmail;