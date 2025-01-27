import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string; // Recipient's email address
  subject: string; // Email subject
  type: "code" | "success" | "notification"; // Type of email
  data: { [key: string]: string }; // Dynamic data for the email template
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

  // Email template generator
  const generateEmailTemplate = (): string => {
    switch (type) {
      case "code":
        return `
          <div style="text-align: center;">
            <h2 style="color: #333; font-size: 22px; font-weight: bold;">Verification Code</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
              Use the following verification code to complete your action. This code will expire in 10 minutes. Please do not share it with anyone.
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