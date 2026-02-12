import { v2 as cloudinary } from "cloudinary";
import { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
	CLOUDINARY_CLOUD_NAME, } from "../utils/keys";

cloudinary.config({
	cloud_name: CLOUDINARY_CLOUD_NAME,
	api_key: CLOUDINARY_API_KEY,
	api_secret: CLOUDINARY_API_SECRET,
	// Increase timeout for large files (120 seconds)
	timeout: 120000,
	// Add proxy support if HTTP_PROXY env var is set
	https_proxy: process.env.HTTPS_PROXY || process.env.https_proxy,
	http_proxy: process.env.HTTP_PROXY || process.env.http_proxy,
});

console.log('Cloudinary config:', {
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY ? '***' : undefined,
  api_secret: CLOUDINARY_API_SECRET ? '***' : undefined,
  timeout: '120s',
  proxy: process.env.HTTP_PROXY || process.env.HTTPS_PROXY ? 'configured' : 'none'
});

export default cloudinary;