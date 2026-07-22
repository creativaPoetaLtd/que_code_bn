import cloudinary from "../helpers/cloudinary";
import {
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_FOLDER_NAME,
} from "../utils/keys";

const folder = CLOUDINARY_FOLDER_NAME;

export const MEDIA_TYPES = {
    IMAGE: {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
        maxSize: 10 * 1024 * 1024, // 10MB
        folder: 'chat/images'
    },
    VIDEO: {
        extensions: ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
        mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'],
        maxSize: 100 * 1024 * 1024, // 100MB
        folder: 'chat/videos'
    },
    AUDIO: {
        extensions: ['.mp3', '.wav', '.ogg', '.m4a', '.aac'],
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac'],
        maxSize: 20 * 1024 * 1024, // 20MB
        folder: 'chat/audio'
    },
    DOCUMENT: {
        extensions: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt'],
        mimeTypes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain'
        ],
        maxSize: 50 * 1024 * 1024, // 50MB
        folder: 'chat/documents'
    }
};

export const getMediaTypeFromMime = (mimeType: string): string | null => {
    if (MEDIA_TYPES.IMAGE.mimeTypes.includes(mimeType)) return 'image';
    if (MEDIA_TYPES.VIDEO.mimeTypes.includes(mimeType)) return 'video';
    if (MEDIA_TYPES.AUDIO.mimeTypes.includes(mimeType)) return 'audio';
    if (MEDIA_TYPES.DOCUMENT.mimeTypes.includes(mimeType)) return 'document';
    return null;
};

const getUploadFolder = (mediaType: string): string => {
    const baseFolder = folder || 'qiew';
    switch (mediaType) {
        case 'image':
            return `${baseFolder}/${MEDIA_TYPES.IMAGE.folder}`;
        case 'video':
            return `${baseFolder}/${MEDIA_TYPES.VIDEO.folder}`;
        case 'audio':
            return `${baseFolder}/${MEDIA_TYPES.AUDIO.folder}`;
        case 'document':
            return `${baseFolder}/${MEDIA_TYPES.DOCUMENT.folder}`;
        default:
            return `${baseFolder}/chat/files`;
    }
};

// Validate file size
export const validateFileSize = (file: Express.Multer.File): { valid: boolean; error?: string } => {
    const mediaType = getMediaTypeFromMime(file.mimetype);

    if (!mediaType) {
        return { valid: false, error: 'Unsupported file type' };
    }

    let maxSize: number;
    switch (mediaType) {
        case 'image':
            maxSize = MEDIA_TYPES.IMAGE.maxSize;
            break;
        case 'video':
            maxSize = MEDIA_TYPES.VIDEO.maxSize;
            break;
        case 'audio':
            maxSize = MEDIA_TYPES.AUDIO.maxSize;
            break;
        case 'document':
            maxSize = MEDIA_TYPES.DOCUMENT.maxSize;
            break;
        default:
            maxSize = 10 * 1024 * 1024; // Default 10MB
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB for ${mediaType} files`
        };
    }

    return { valid: true };
};

// Upload chat media file to Cloudinary with retry logic
export const uploadChatMedia = async (
    file: Express.Multer.File,
    retries: number = 2
): Promise<{
    success: boolean;
    data?: {
        url: string;
        thumbnailUrl?: string;
        mediaType: string;
        fileSize: number;
        fileName: string;
        mimeType: string;
        duration?: number;
        width?: number;
        height?: number;
    };
    error?: string;
}> => {
    try {
        console.log(`Starting upload for file: ${file.originalname}, size: ${file.size} bytes`);

        // Validate file
        const validation = validateFileSize(file);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const mediaType = getMediaTypeFromMime(file.mimetype);
        if (!mediaType) {
            return { success: false, error: 'Unsupported file type' };
        }

        const uploadFolder = getUploadFolder(mediaType);
        console.log(`Uploading ${mediaType} to folder: ${uploadFolder}`);

        // Prepare upload options based on media type
        let uploadOptions: any = {
            folder: uploadFolder,
            resource_type: 'auto',
            timeout: 120000, // 120 seconds timeout
            chunk_size: 6000000, // 6MB chunks for large files
        };

        // For images, simple upload without eager transformations
        if (mediaType === 'image') {
            uploadOptions = {
                ...uploadOptions,
                transformation: [
                    { width: 1920, height: 1080, crop: 'limit', quality: 'auto:good' }
                ],
            };
        }

        // For videos, use basic upload
        if (mediaType === 'video') {
            uploadOptions = {
                ...uploadOptions,
                resource_type: 'video',
            };
        }

        // For documents, use raw resource type
        if (mediaType === 'document') {
            uploadOptions = {
                ...uploadOptions,
                resource_type: 'raw',
            };
        }

        // Upload to Cloudinary with retry logic
        let result;
        try {
            console.log('Starting Cloudinary upload...');
            result = await cloudinary.uploader.upload(file.path, uploadOptions);
            console.log('Cloudinary upload successful:', result.secure_url);
        } catch (uploadError: any) {
            console.error('Cloudinary upload error:', uploadError);

            // Retry on timeout or network errors
            if (retries > 0 && (uploadError.http_code === 499 || uploadError.name === 'TimeoutError')) {
                console.log(`Retrying upload... (${retries} retries left)`);
                // Wait 2 seconds before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
                return uploadChatMedia(file, retries - 1);
            }

            throw uploadError;
        }

        // Generate thumbnail URL using Cloudinary URL transformation
        let thumbnailUrl: string | undefined;
        if (mediaType === 'image') {
            // Generate thumbnail URL via transformation
            thumbnailUrl = cloudinary.url(result.public_id, {
                width: 300,
                height: 300,
                crop: 'thumb',
                gravity: 'auto',
                fetch_format: 'auto',
                quality: 'auto:good'
            });
        } else if (mediaType === 'video') {
            // Generate video thumbnail URL
            thumbnailUrl = cloudinary.url(result.public_id, {
                resource_type: 'video',
                width: 300,
                height: 300,
                crop: 'thumb',
                gravity: 'center',
                format: 'jpg',
                start_offset: '0'
            });
        }

        // For videos, extract duration
        let duration: number | undefined;
        if (mediaType === 'video' && result.duration) {
            duration = Math.round(result.duration);
        }

        // For audio, extract duration
        if (mediaType === 'audio' && result.duration) {
            duration = Math.round(result.duration);
        }

        return {
            success: true,
            data: {
                url: result.secure_url,
                thumbnailUrl,
                mediaType,
                fileSize: file.size,
                fileName: file.originalname,
                mimeType: file.mimetype,
                duration,
                width: result.width,
                height: result.height
            }
        };
    } catch (error) {
        console.error('Error uploading chat media:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload file'
        };
    }
};

export const uploadEncryptedChatMedia = async (
    file: Express.Multer.File,
    retries: number = 2
): Promise<{
    success: boolean;
    data?: {
        url: string;
        fileSize: number;
        fileName: string;
        mimeType: string;
    };
    error?: string;
}> => {
    try {
        if (file.size > 110 * 1024 * 1024) {
            return { success: false, error: 'Encrypted file size exceeds maximum allowed size of 110MB' };
        }

        if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
            return { success: false, error: 'Secure media storage is not configured' };
        }

        const uploadFolder = `${folder || 'qiew'}/chat/secure`;
        const uploadOptions = {
            folder: uploadFolder,
            resource_type: 'raw' as const,
            timeout: 120000,
            chunk_size: 6000000,
        };

        let result;
        try {
            result = await cloudinary.uploader.upload(file.path, uploadOptions);
        } catch (uploadError: any) {
            if (retries > 0 && (uploadError.http_code === 499 || uploadError.name === 'TimeoutError')) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return uploadEncryptedChatMedia(file, retries - 1);
            }

            throw uploadError;
        }

        return {
            success: true,
            data: {
                url: result.secure_url,
                fileSize: file.size,
                fileName: file.originalname,
                mimeType: file.mimetype,
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to upload encrypted file'
        };
    }
};

// Delete media from Cloudinary
export const deleteChatMedia = async (url: string): Promise<boolean> => {
    try {
        // Extract public ID from URL
        const urlParts = url.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/');
        const publicId = publicIdWithExtension.split('.')[0];

        await cloudinary.uploader.destroy(publicId);
        return true;
    } catch (error) {
        console.error('Error deleting chat media:', error);
        return false;
    }
};

// Generate thumbnail for document (placeholder - would need external service)
export const generateDocumentThumbnail = async (
    documentUrl: string
): Promise<string | null> => {
    // This is a placeholder for document thumbnail generation
    // In production, you might use services like:
    // - Cloudinary's transformation for PDFs
    // - External services like PDF.js or ImageMagick
    // - AWS Lambda or similar serverless functions

    // For now, return a generic document icon based on file type
    const extension = documentUrl.split('.').pop()?.toLowerCase();

    // You can use Cloudinary to generate PDF thumbnails
    if (extension === 'pdf') {
        try {
            // Extract public ID and generate thumbnail
            const urlParts = documentUrl.split('/');
            const publicIdWithExtension = urlParts.slice(-2).join('/');
            const publicId = publicIdWithExtension.replace('.pdf', '');

            // Cloudinary can generate PDF thumbnails
            const thumbnailUrl = cloudinary.url(publicId, {
                format: 'jpg',
                page: 1,
                width: 300,
                height: 300,
                crop: 'fill'
            });

            return thumbnailUrl;
        } catch (error) {
            console.error('Error generating PDF thumbnail:', error);
        }
    }

    return null;
};

export default {
    uploadChatMedia,
    deleteChatMedia,
    validateFileSize,
    getMediaTypeFromMime,
    generateDocumentThumbnail,
    MEDIA_TYPES
};
