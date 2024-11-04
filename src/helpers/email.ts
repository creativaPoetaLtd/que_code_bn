import nodemailer from "nodemailer";

const sendEmail = async ({ to, subject, text }: { to: string; subject: string; text: string }) => {
    console.log("process.env.EMAIL_USER", process.env.EMAIL_USER);
    console.log("process.env.EMAIL_PASS", process.env.EMAIL_PASS);
    
  const transporter = nodemailer.createTransport({
    service: "gmail",
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
};

export default sendEmail;
