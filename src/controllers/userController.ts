import { Request, Response } from 'express';
import { insert_function, read_function } from "../utils/db_methods";
import { UserCreationAttributes, UserModelAttributes } from "../types/model";
// import cloudinary from "../helpers/cloudinary";
import bcrypt from 'bcrypt';
import sendEmail from '../helpers/email';
import jwt from 'jsonwebtoken';

interface MulterRequest extends Request {
    files?: {
        [fieldname: string]: Express.Multer.File[];
    } | Express.Multer.File[];
}
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

const create_user = async (req: Request, res: Response): Promise<void> => {
    try {
        // if (!req.files || !('national_id' in req.files) || !req.files.national_id[0]) {
        //     res.status(400).json({ message: "National ID Document is required" });
        //     return;
        // }

        // const file = Array.isArray(req.files) ? req.files[0] : req.files.national_id[0];

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
        // Generate OTP and expiration time

        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Random 6-digit number
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // Expires in 10 minutes
        // const national_idUpload = await cloudinary.uploader.upload(file.path, {
        //     folder: 'national_ids',
        //     resource_type: 'auto'
        // });

        const userData: UserCreationAttributes = {
            firstName,
            lastName,
            phone,
            gender,
            email,
            province,
            password: hashedPassword,
            district,
            sector,
            // national_id: national_idUpload.secure_url,
            approvalStatus: false,
            otp,
            otpExpires
        };
        const newUser = await insert_function<UserModelAttributes>("User", "create", userData);
        const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '10m' });
        const verificationUrl = `${process.env.FRONTEND_URL}/auth/otp?token=${token}`;
        await sendEmail({
            to: email,
            subject: 'Your OTP Code',
            type: 'code',
            data: { code: `${otp}`, verificationUrl }
        });
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({
            message: "User registered successfully. Please verify your email using the OTP sent.",
            data: userWithoutPassword
        });
    } catch (error) {
        console.error("User registration error:", error);
        res.status(500).json({ message: "An error occurred while registering the user" });
    }
};
const get_all_users = async (req: Request, res: Response): Promise<void> => {
    try {
        const allUsers = await read_function<UserModelAttributes[]>(
            "User",
            "findAll"
        );

        res.status(200).json(allUsers);
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

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "An error occurred while fetching the user" });
    }
}

const update_user = async (req: Request, res: Response): Promise<void> => {
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

        const updatedUser = await insert_function<UserModelAttributes>(
            "User",
            "update",
            req.body,
            { where: { id: req.params.id } }
        );

        res.status(200).json(updatedUser);
    } catch (error) {
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

        res.status(200).json(approvedUser);
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

        res.status(200).json(disapprovedUser);
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

        res.status(200).json(approvedUsers);
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

        res.status(200).json(unapprovedUsers);
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

        if (user.approvalStatus) {
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
