const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { Readable } = require("stream");
const cloudinary = require("cloudinary").v2;
const { env, hasCloudinary, isProduction } = require("../config/env");
const ApiError = require("./api-error");

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret
});

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const toPublicLocalPath = (filename) => `/uploads/${filename}`;

const saveLocally = async (file) => {
  const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
  const filename = `${Date.now()}-${uuidv4()}${ext}`;
  const fullPath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(fullPath, file.buffer);
  return {
    url: toPublicLocalPath(filename),
    publicId: filename,
    storage: "local"
  };
};

const uploadToCloudinary = (file, folder, resourceType = "auto") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          storage: "cloudinary"
        });
      }
    );
    Readable.from(file.buffer).pipe(stream);
  });

const uploadAsset = async (file, folder, resourceType = "auto") => {
  if (!file) return null;

  if (hasCloudinary) {
    try {
      return await uploadToCloudinary(file, folder, resourceType);
    } catch (error) {
      if (isProduction) {
        throw new ApiError(502, "Cloudinary upload failed. Check Cloudinary environment variables.");
      }
      return saveLocally(file);
    }
  }

  return saveLocally(file);
};

const uploadManyAssets = async (files, folder, resourceType = "auto") => {
  if (!files || files.length === 0) return [];
  const uploads = await Promise.all(
    files.map((file) => uploadAsset(file, folder, resourceType))
  );
  return uploads.filter(Boolean);
};

module.exports = {
  uploadAsset,
  uploadManyAssets
};
