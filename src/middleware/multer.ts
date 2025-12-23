import multer from "multer";
import path from "path";

// Configure multer for organization file uploads
const organizationFileUpload = multer({
	storage: multer.diskStorage({}),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
		files: 2, // Maximum 2 files (logo + operational document)
	},
	fileFilter: (_req, file, callback) => {
		const ext = path.extname(file.originalname).toLowerCase();
		
		// Allow images for logo
		const allowedImageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.jfif', '.tif'];
		// Allow documents for operational document
		const allowedDocExts = ['.pdf', '.doc', '.docx'];
		
		const allAllowedExts = [...allowedImageExts, ...allowedDocExts];
		
		if (!allAllowedExts.includes(ext)) {
			return callback(new Error(`File type ${ext} is not allowed. Allowed types: ${allAllowedExts.join(', ')}`));
		}
		
		callback(null, true);
	},
});

// General file upload (for backward compatibility)
const fileUpload = multer({
	storage: multer.diskStorage({}),
	fileFilter: (_req, file, callback) => {
		const ext = path.extname(file.originalname);
		if (
			ext !== ".png" &&
			ext !== ".jpg" &&
			ext !== ".jpeg" &&
			ext !== ".gif" &&
			ext !== ".webp" &&
			ext !== ".bmp" &&
			ext !== ".tiff" &&
			ext !== ".jfif" &&
			ext !== ".tif" &&
			ext !== ".pdf"
		) {
			return callback(null, false);
		}
		callback(null, true);
	},
});

// Configure multer for action cover image uploads
const actionCoverImageUpload = multer({
	storage: multer.diskStorage({}),
	limits: {
		fileSize: 10 * 1024 * 1024, // 10MB limit
		files: 1, // Only cover image
	},
	fileFilter: (_req, file, callback) => {
		const ext = path.extname(file.originalname).toLowerCase();
		
		// Allow only images for cover
		const allowedImageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.jfif', '.tif'];
		
		if (!allowedImageExts.includes(ext)) {
			return callback(new Error(`File type ${ext} is not allowed. Allowed types: ${allowedImageExts.join(', ')}`));
		}
		
		callback(null, true);
	},
});

export { organizationFileUpload, actionCoverImageUpload };
export default fileUpload;