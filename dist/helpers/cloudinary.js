"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
const keys_1 = require("../utils/keys");
cloudinary_1.v2.config({
    cloud_name: keys_1.CLOUDINARY_CLOUD_NAME,
    api_key: keys_1.CLOUDINARY_API_KEY,
    api_secret: keys_1.CLOUDINARY_API_SECRET,
});
exports.default = cloudinary_1.v2;
