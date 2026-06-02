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

const cleanCloudinaryFolderPart = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/^safety-hse\//i, "")
    .replace(/^uploads\//i, "");

const resolveCloudinaryFolder = (folder = "") => {
  const rootFolder = cleanCloudinaryFolderPart(env.cloudinary.uploadFolder || "uploads") || "uploads";
  const childFolder = cleanCloudinaryFolderPart(folder);
  return [rootFolder, childFolder].filter(Boolean).join("/");
};

const cleanUploadRelativePath = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^uploads\//i, "")
    .replace(/[^\w./-]/g, "");

const removeExtension = (value = "") => {
  const ext = path.extname(value);
  return ext ? value.slice(0, -ext.length) : value;
};

const getCloudinaryPrefixCandidates = (filename = "") => {
  const relativePath = cleanUploadRelativePath(filename);
  if (!relativePath) return [];

  const relativeStem = removeExtension(relativePath);
  const basenameStem = removeExtension(path.basename(relativePath));
  const rootFolder = cleanCloudinaryFolderPart(env.cloudinary.uploadFolder || "uploads");

  return Array.from(
    new Set(
      [
        rootFolder && relativeStem ? `${rootFolder}/${relativeStem}` : "",
        relativeStem,
        rootFolder && basenameStem ? `${rootFolder}/${basenameStem}` : "",
        basenameStem
      ].filter(Boolean)
    )
  );
};

const findCloudinaryAssetByFilename = async (filename, resourceType = "image") => {
  if (!hasCloudinary) return null;

  const prefixes = getCloudinaryPrefixCandidates(filename);
  if (!prefixes.length) return null;

  for (let index = 0; index < prefixes.length; index += 1) {
    try {
      const result = await cloudinary.api.resources({
        type: "upload",
        resource_type: resourceType,
        prefix: prefixes[index],
        max_results: 1
      });
      const asset = result?.resources?.[0];
      if (asset?.secure_url) return asset.secure_url;
    } catch (_error) {
      // Try the next prefix before giving up.
    }
  }

  return null;
};

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
        folder: resolveCloudinaryFolder(folder),
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
          folder: resolveCloudinaryFolder(folder),
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
  uploadManyAssets,
  findCloudinaryAssetByFilename
};
