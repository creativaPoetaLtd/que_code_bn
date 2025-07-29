import crypto from "crypto";
import { Request, Response } from "express";
import { read_function, update_function } from "../utils/db_methods";
import { UserModelAttributes } from "../types/model";
import sendEmail from "../helpers/email";
import bcrypt from "bcrypt";

const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: { email },
    });
    if (!user) {
      res.status(404).json({ message: "User not found" });
    }
    else {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpires = new Date(Date.now() + 3600000);
      await update_function("User", "update", { resetToken, resetTokenExpires }, { where: { email } });
      const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password/${resetToken}`;
      const message = `You are receiving this because you requested a password reset. Please click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}`;

      await sendEmail({
        to: user.email,
        subject: "Password Reset",
        type: 'notification',
        data: { 
          title: "Password Reset Request",
          body: message 
        },
      });

      res.status(200).json({ message: "Reset email sent" });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "An error occurred while requesting password reset" });
  }
};
const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    const user = await read_function<UserModelAttributes>("User", "findOne", {
      where: {
        resetToken: token,
      },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
    } else {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await update_function("User", "update", {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      }, { where: { id: user.id } });

      res.status(200).json({ message: "Password reset successful" });
    }
  }
  catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "An error occurred while resetting password" });
  }
};


export default { forgotPassword, resetPassword };