import { Request, Response } from 'express';
import { insert_function, read_function } from "../utils/db_methods";
import { UserCreationAttributes, UserModelAttributes } from "../types/model";
import cloudinary from "../helpers/cloudinary";
import bcrypt from 'bcrypt';


interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const create_user = async (req: MulterRequest, res: Response): Promise<void> => {
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

        const {
            firstName, lastName, phone, email, password, province, district, sector, gender
        } = req.body;

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        let national_id = '';

        if (req.files) {
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };

            if (files.national_id && files.national_id[0]) {
                const national_idUpload = await cloudinary.uploader.upload(files.national_id[0].path);
                national_id = national_idUpload.secure_url;
            }
        }

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
            national_id,
            apporvalStatus: false
        };

        const newUser = await insert_function<UserModelAttributes>(
            "User",
            "create",
            userData
        );

        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json({
            message: "User registered successfully",
            data: userWithoutPassword
        });
    } catch (error) {
        console.error("User registration error:", error);
        res.status(500).json({
            message: "An error occurred while registering the user"
        });
    }
}
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


export default {
    create_user,
    get_all_users,
    get_user_by_id,
    update_user,
    delete_user,
    approve_user,
    disapprove_user,
    get_approved_users,
    get_unapproved_users
};
