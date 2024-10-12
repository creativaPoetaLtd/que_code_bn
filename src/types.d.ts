// types.d.ts
import { Request } from "express"; 

// Define the types for the files property from Multer
export interface MulterFiles {
    [fieldname: string]: Express.Multer.File[]; // This matches the structure of req.files
}

// Extend the Express Request interface
export interface CustomRequest extends Request {
    files?: MulterFiles; // Optional files property
}
