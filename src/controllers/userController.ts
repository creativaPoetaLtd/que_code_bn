import { Request, Response } from 'express';
import { insert_function, read_function } from "../utils/db_methods";
import { UserCreationAttributes, UserModelAttributes, WalletCreationAttributes } from "../types/model";
// import cloudinary from "../helpers/cloudinary";
import bcrypt from 'bcrypt';
import sendEmail from '../helpers/email';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { uploadSingle } from "../helpers/upload";

interface MulterRequest extends Request {
    files?: {
        [fieldname: string]: Express.Multer.File[];
    } | Express.Multer.File[];
}
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Helper type guard
function isSequelizeInstance(obj: any): obj is { get: (opts?: any) => any } {
    return obj && typeof obj.get === 'function';
}

const create_user = async (req: Request, res: Response): Promise<void> => {
    try {
        const existingUser = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { email: req.body.email } }
        );

        if (existingUser) {
            res.status(400).json({ message: "User already exists" });
            return;
        }

        const { firstName, lastName, phone, email, password, province, district, sector, gender } = req.body;
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        // Generate unique public ID for sharing
        const publicId = uuidv4().replace(/-/g, '').substring(0, 12);
        const profileLink = `${process.env.FRONTEND_URL}/add-contact/${publicId}`;

        const userData: UserCreationAttributes = {
            id: uuidv4(),
            firstName,
            lastName,
            phone,
            gender,
            email,
            province,
            password: hashedPassword,
            district,
            sector,
            otp,
            otpExpires,
            publicId,
            profileLink
        };

        const newUser: any = await insert_function<UserModelAttributes>("User", "create", userData);

        // Create wallet for the new user
        try {
            const walletData: WalletCreationAttributes = {
                userId: newUser.id,
                balance: 0, // Start with zero balance
                currency: 'RWF',
                isActive: true
            };
            
            await insert_function("Wallet", "create", walletData);
        } catch (walletError) {
            console.error("Error creating wallet for user:", walletError);
            // Don't fail user creation if wallet creation fails
        }

        // Generate the QR Code
        const userProfileLink = `${process.env.FRONTEND_URL}/welcome/${newUser.id}`;
        const qrCodeData = await QRCode.toDataURL(userProfileLink);
        // Generate QR Code with the profile link
        // const qrCodeData = await QRCode.toDataURL(profileLink);

        // Update user with QR code
        await newUser.update({ qrCode: qrCodeData });

        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '10m' });

        const verificationUrl = `${process.env.FRONTEND_URL}/auth/otp?token=${token}`;
        await sendEmail({
            to: email,
            subject: 'Your OTP Code',
            type: 'code',
            data: { code: `${otp}`, verificationUrl }
        });

        const plainUser = isSequelizeInstance(newUser) ? newUser.get({ plain: true }) : newUser;
        const { password: _, ...userWithoutPassword } = plainUser;
        // const { password: _, ...userWithoutPassword } = newUser.toJSON();
        res.status(201).json({
            message: "User registered successfully. Please verify your email using the OTP sent.",
            data: {
                token,
                otp
            }
        });
    } catch (error: any) {
        console.error("User registration error:", error.message);
        res.status(500).json({ message: "An error occurred while registering the user" });
    }
};

const get_all_users = async (req: Request, res: Response): Promise<void> => {
    try {
        const allUsers = await read_function<UserModelAttributes[]>(
            "User",
            "findAll"
        );
        const plainUsers = Array.isArray(allUsers)
            ? allUsers.map(u => (isSequelizeInstance(u) ? u.get({ plain: true }) : u))
            : [];
        res.status(200).json(plainUsers);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while fetching all users" });
    }
}

const get_user_by_id = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: req.params.id } }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const plainUser = isSequelizeInstance(user) ? user.get({ plain: true }) : user;
        // Ensure welcome preferences are always present (default true)
        const userWithWelcomePrefs = {
            ...plainUser,
            showPhoneOnWelcome: plainUser.showPhoneOnWelcome !== undefined ? plainUser.showPhoneOnWelcome : true,
            showProfileImageOnWelcome: plainUser.showProfileImageOnWelcome !== undefined ? plainUser.showProfileImageOnWelcome : true,
            showStatusMessageOnWelcome: plainUser.showStatusMessageOnWelcome !== undefined ? plainUser.showStatusMessageOnWelcome : true,
        };

        res.status(200).json(userWithWelcomePrefs);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while fetching the user" });
    }
}

const update_user = async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('Incoming files:', (req as any).files);
        const user = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: req.params.id } }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        let profileImageUrl = user.profileImage;
        if ((req as any).files && (req as any).files.profileImage && (req as any).files.profileImage[0]) {
            const filePath = (req as any).files.profileImage[0].path;
            console.log('Profile image file path:', filePath);
            const uploadResult = await uploadSingle(filePath);
            console.log('Cloudinary upload result:', uploadResult);
            if (uploadResult && typeof uploadResult === 'object' && 'secure_url' in uploadResult) {
                profileImageUrl = (uploadResult as any).secure_url;
            } else if (uploadResult && typeof uploadResult === 'object' && 'error' in uploadResult) {
                console.error('Profile image upload failed:', uploadResult.error);
                res.status(400).json({ message: 'Profile image upload failed', error: uploadResult.error });
                return;
            }
        } else {
            console.log('No profileImage file found in request.');
        }

        const updateData: Partial<UserModelAttributes> = {
            ...req.body,
            profileImage: profileImageUrl,
        };
        if (req.body.statusMessage !== undefined) {
            updateData.statusMessage = req.body.statusMessage;
        }
        // Allow updating welcome preferences
        if (req.body.showPhoneOnWelcome !== undefined) {
            updateData.showPhoneOnWelcome = req.body.showPhoneOnWelcome;
        }
        if (req.body.showProfileImageOnWelcome !== undefined) {
            updateData.showProfileImageOnWelcome = req.body.showProfileImageOnWelcome;
        }
        if (req.body.showStatusMessageOnWelcome !== undefined) {
            updateData.showStatusMessageOnWelcome = req.body.showStatusMessageOnWelcome;
        }

        const updatedUser = await insert_function<UserModelAttributes>(
            "User",
            "update",
            updateData,
            { where: { id: req.params.id } }
        );

        const plainUser = isSequelizeInstance(updatedUser) ? updatedUser.get({ plain: true }) : updatedUser;
        // Ensure welcome preferences are always present (default true)
        const updatedUserWithPrefs = {
            ...plainUser,
            showPhoneOnWelcome: updateData.showPhoneOnWelcome !== undefined ? updateData.showPhoneOnWelcome : (user.showPhoneOnWelcome !== undefined ? user.showPhoneOnWelcome : true),
            showProfileImageOnWelcome: updateData.showProfileImageOnWelcome !== undefined ? updateData.showProfileImageOnWelcome : (user.showProfileImageOnWelcome !== undefined ? user.showProfileImageOnWelcome : true),
            showStatusMessageOnWelcome: updateData.showStatusMessageOnWelcome !== undefined ? updateData.showStatusMessageOnWelcome : (user.showStatusMessageOnWelcome !== undefined ? user.showStatusMessageOnWelcome : true),
        };

        res.status(200).json(updatedUserWithPrefs);
    } catch (error) {
        console.error('Error in update_user:', error);
        res.status(500).json({ message: "An error occurred while updating the user" });
    }
}

const delete_user = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: req.params.id } }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        await read_function<UserModelAttributes>(
            "User",
            "destroy",
            { where: { id: req.params.id } }
        );

        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "An error occurred while deleting the user" });
    }
}

const approve_user = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: req.params.id } }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const approvedUser = await insert_function<UserModelAttributes>(
            "User",
            "update",
            { approvalStatus: true },
            { where: { id: req.params.id } }
        );

        const plainUser = isSequelizeInstance(approvedUser) ? approvedUser.get({ plain: true }) : approvedUser;
        res.status(200).json(plainUser);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while approving the user" });
    }
}

const disapprove_user = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = await read_function<UserModelAttributes>(
            "User",
            "findOne",
            { where: { id: req.params.id } }
        );

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        const disapprovedUser = await insert_function<UserModelAttributes>(
            "User",
            "update",
            { approvalStatus: false },
            { where: { id: req.params.id } }
        );

        const plainUser = isSequelizeInstance(disapprovedUser) ? disapprovedUser.get({ plain: true }) : disapprovedUser;
        res.status(200).json(plainUser);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while disapproving the user" });
    }
}

const get_approved_users = async (req: Request, res: Response): Promise<void> => {
    try {
        const approvedUsers = await read_function<UserModelAttributes[]>(
            "User",
            "findAll",
            { where: { approvalStatus: true } }
        );
        const plainUsers = Array.isArray(approvedUsers)
            ? approvedUsers.map(u => (isSequelizeInstance(u) ? u.get({ plain: true }) : u))
            : [];
        res.status(200).json(plainUsers);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while fetching all approved users" });
    }
}

const get_unapproved_users = async (req: Request, res: Response): Promise<void> => {
    try {
        const unapprovedUsers = await read_function<UserModelAttributes[]>(
            "User",
            "findAll",
            { where: { approvalStatus: false } }
        );
        const plainUsers = Array.isArray(unapprovedUsers)
            ? unapprovedUsers.map(u => (isSequelizeInstance(u) ? u.get({ plain: true }) : u))
            : [];
        res.status(200).json(plainUsers);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while fetching all unapproved users" });
    }
}
// In your OTP verification controller
const verify_otp = async (req: Request, res: Response): Promise<void> => {
    const { token, otp } = req.body;

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
        const email = decoded.email;
        const user = await read_function<UserModelAttributes>("User", "findOne", {
            where: { email }
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ message: "User already verified" });
            return;
        }

        if (user.otp !== otp || new Date() > user.otpExpires!) {
            res.status(400).json({ message: "Invalid or expired OTP" });
            return;
        }

        // Mark as verified
        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await insert_function<UserModelAttributes>(
            "User",
            "update",
            { isVerified: true, otp: null, otpExpires: null },
            { where: { email } }
        );

        res.status(200).json({ message: "OTP verified successfully. You can now log in." });
    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ message: "An error occurred during OTP verification" });
    }
};


const RESEND_COOLDOWN = 1 * 60 * 1000; // 1 minute

const resend_otp = async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    const email = decoded.email;
    try {
        const user = await read_function<UserModelAttributes>("User", "findOne", {
            where: { email }
        });

        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ message: "User is already verified" });
            return;
        }

        const now = Date.now();
        const lastOtpSent = user.lastOtpSent ? user.lastOtpSent.getTime() : 0;

        if (now - lastOtpSent < RESEND_COOLDOWN) {
            res.status(429).json({ message: "Please wait before requesting a new OTP" });
            return;
        }

        // Generate a new OTP and expiration time
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(now + 10 * 60 * 1000); // 10 minutes from now

        // Update OTP, expiration, and lastOtpSent in the user's record
        user.otp = newOtp;
        user.otpExpires = otpExpires;
        user.lastOtpSent = new Date(now);
        await insert_function<UserModelAttributes>(
            "User",
            "update",
            { otp: newOtp, otpExpires, lastOtpSent: new Date(now) },
            { where: { email } }
        );

        // Resend OTP via email

        await sendEmail({
            to: email,
            subject: 'Your OTP Code',
            type: 'code',
            data: {
                code: `${newOtp}`
            },
        });


        res.status(200).json({ message: "A new OTP has been sent to your email" });
    } catch (error) {
        console.error("Error resending OTP:", error);
        res.status(500).json({ message: "An error occurred while resending OTP" });
    }
};

export default {
    create_user,
    get_all_users,
    get_user_by_id,
    update_user,
    delete_user,
    approve_user,
    disapprove_user,
    get_approved_users,
    get_unapproved_users,
    verify_otp,
    resend_otp
};
