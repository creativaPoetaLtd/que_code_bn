"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCloudinaryFile = exports.uploadMultiple = exports.uploadSingle = void 0;
const cloudinary_1 = __importDefault(require("./cloudinary"));
const keys_1 = require("../utils/keys");
const folder = keys_1.CLOUDINARY_FOLDER_NAME;
const uploadSingle = (image) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const result = yield cloudinary_1.default.uploader.upload(image, {
            folder,
        });
        return result;
    }
    catch (error) {
        const err = error.message;
        return { error: err };
    }
});
exports.uploadSingle = uploadSingle;
const uploadMultiple = (images, req) => __awaiter(void 0, void 0, void 0, function* () {
    const imageUrls = [];
    const errors = [];
    if (images.length < 3 || images.length > 8) {
        req.info = {
            message: images.length < 3
                ? "Product must have at least 3 images!"
                : "Product can't have more than 8 images!",
        };
    }
    for (const i in images) {
        try {
            const data = yield (0, exports.uploadSingle)(images[i].path);
            if ("error" in data) {
                req.info = {
                    message: "Uploading image failed!",
                };
            }
            else {
                imageUrls.push(data === null || data === void 0 ? void 0 : data.secure_url);
            }
        }
        catch (error) {
            errors.push(error.message);
            req.info = {
                message: message(imageUrls.length, errors),
            };
        }
    }
    return { images: imageUrls };
});
exports.uploadMultiple = uploadMultiple;
function message(imageLen, errors) {
    if (errors.length > 0) {
        return `${imageLen === 0 ? "No" : imageLen} other product images were uploaded, (${errors.length}) went wrong as ${errors
            .filter((error, index) => errors.indexOf(error) === index)
            .join(", ")}!`;
    }
}
const deleteCloudinaryFile = (url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield cloudinary_1.default.uploader.destroy(url);
        return true;
    }
    catch (error) {
        return error;
    }
});
exports.deleteCloudinaryFile = deleteCloudinaryFile;
