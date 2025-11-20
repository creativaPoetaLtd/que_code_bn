import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface UploadResult {
    url: string;
    publicId: string;
}

export class CloudinaryService {
    /**
     * Upload an image to Cloudinary
     */
    static async uploadImage(
        fileBuffer: Buffer,
        folder: string = 'group-profiles',
        fileName?: string
    ): Promise<UploadResult> {
        return new Promise((resolve, reject) => {
            const uploadOptions: any = {
                folder,
                resource_type: 'image',
                format: 'jpg',
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto:good' }
                ]
            };

            if (fileName) {
                uploadOptions.public_id = fileName;
            }

            cloudinary.uploader.upload_stream(
                uploadOptions,
                (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(new Error(`Image upload failed: ${error.message}`));
                    } else if (result) {
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id
                        });
                    } else {
                        reject(new Error('Image upload failed: No result returned'));
                    }
                }
            ).end(fileBuffer);
        });
    }

    /**
     * Upload image from base64 string
     */
    static async uploadBase64Image(
        base64String: string,
        folder: string = 'group-profiles',
        fileName?: string
    ): Promise<UploadResult> {
        return new Promise((resolve, reject) => {
            const uploadOptions: any = {
                folder,
                resource_type: 'image',
                format: 'jpg',
                transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto:good' }
                ]
            };

            if (fileName) {
                uploadOptions.public_id = fileName;
            }

            cloudinary.uploader.upload(
                base64String,
                uploadOptions,
                (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(new Error(`Image upload failed: ${error.message}`));
                    } else if (result) {
                        resolve({
                            url: result.secure_url,
                            publicId: result.public_id
                        });
                    } else {
                        reject(new Error('Image upload failed: No result returned'));
                    }
                }
            );
        });
    }

    /**
     * Delete an image from Cloudinary
     */
    static async deleteImage(publicId: string): Promise<boolean> {
        try {
            const result = await cloudinary.uploader.destroy(publicId);
            return result.result === 'ok';
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            return false;
        }
    }

    /**
     * Update/replace an existing image
     */
    static async updateImage(
        oldPublicId: string,
        newImageBuffer: Buffer,
        folder: string = 'group-profiles'
    ): Promise<UploadResult> {
        try {
            // Upload new image
            const uploadResult = await this.uploadImage(newImageBuffer, folder);
            
            // Delete old image
            await this.deleteImage(oldPublicId);
            
            return uploadResult;
        } catch (error) {
            console.error('Cloudinary update error:', error);
            throw error;
        }
    }

    /**
     * Generate a unique filename for uploads
     */
    static generateFileName(prefix: string = 'group'): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${prefix}_${timestamp}_${random}`;
    }
}

export default CloudinaryService;