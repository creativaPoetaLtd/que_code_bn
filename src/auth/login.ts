import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { read_function } from "../utils/db_methods";
import { UserModelAttributes, OrganizationModelAttributes } from "../types/model";

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

const login_user = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    // Add rate limiting here if needed

    // Check both tables simultaneously
    const [user, organization] = await Promise.all([
      read_function<UserModelAttributes>(
        "User",
        "findOne",
        { 
          where: { email },
          attributes: { 
            exclude: ['createdAt', 'updatedAt'] // Exclude unnecessary fields
          }
        }
      ),
      read_function<OrganizationModelAttributes>(
        "Organization",
        "findOne",
        { 
          where: { email },
          attributes: { 
            exclude: ['createdAt', 'updatedAt']
          }
        }
      )
    ]);

    const account = user || organization;
    if (!account) {
      res.status(404).json({ message: "Account not found" });
      return;
    }

    // Check if user is approved (if applicable)
    if (user && user.approvalStatus) {
      res.status(403).json({ message: "Account pending approval" });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({
      id: account.id,
      email: account.email,
      accountType: user ? 'user' : 'organization',
      // Add any other necessary claims
    }, JWT_SECRET, {
      expiresIn: '1h',
      algorithm: 'HS256'
    });

    // Remove sensitive data
    const { password: _, ...accountWithoutPassword } = account;

    res.status(200).json({
      message: "Login successful",
      token,
      accountType: user ? 'user' : 'organization',
      data: accountWithoutPassword,
      permissions: user ? 'user_permissions' : 'organization_permissions'
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "An error occurred during login" });
  }
};

export default { login_user };