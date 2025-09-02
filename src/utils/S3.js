const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const mime = require("mime-types");
require("dotenv").config();

// Initialize DigitalOcean Spaces S3-compatible client
const s3 = new S3Client({
  region: process.env.DO_SPACES_REGION || "us-east-1",
  endpoint: process.env.DO_SPACES_ENDPOINT, // https://blr1.digitaloceanspaces.com
  forcePathStyle: false, // Use virtual-hosted-style URLs
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});

// Upload a file (direct or multipart based on size)
const uploadMultipart = async (file, folder, entityId) => {
  console.log(`Upload started for file: ${file.originalname}`);
  const startTime = Date.now();
  const fileName = `${folder}/${entityId}/${Date.now()}_${file.originalname}`;
  const fileSize = file.buffer.length;
  const contentType = file.mimetype || mime.lookup(file.originalname) || "application/octet-stream";

  if (fileSize < 5 * 1024 * 1024) {
    console.log("File size is less than 5MB, uploading directly...");
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: contentType,
      ACL: "public-read",
    });

    try {
      await s3.send(uploadCommand);
      const endTime = Date.now();
      console.log(`File uploaded directly in ${(endTime - startTime) / 1000} seconds.`);
      return `https://${process.env.DO_SPACES_BUCKET}.blr1.digitaloceanspaces.com/${fileName}`;
    } catch (error) {
      console.error("Direct upload error:", error);
      throw new Error("Direct upload failed.");
    }
  }

  console.log("File size is 5MB or more, using Multipart Upload...");
  const partSize = 5 * 1024 * 1024;
  const totalParts = Math.ceil(fileSize / partSize);

  const createUpload = new CreateMultipartUploadCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: fileName,
    ContentType: contentType,
    ACL: "public-read",
  });

  let uploadId;
  try {
    const uploadResponse = await s3.send(createUpload);
    uploadId = uploadResponse.UploadId;
    console.log(`Multipart upload initiated with UploadId: ${uploadId}`);

    const uploadPromises = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      const start = (partNumber - 1) * partSize;
      const end = Math.min(start + partSize, fileSize);
      const chunk = file.buffer.slice(start, end);

      const uploadPartCommand = new UploadPartCommand({
        Bucket: process.env.DO_SPACES_BUCKET,
        Key: fileName,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: chunk,
      });

      console.log(`Uploading part ${partNumber}...`);
      uploadPromises.push(
        s3.send(uploadPartCommand).then((res) => ({
          ETag: res.ETag,
          PartNumber: partNumber,
        }))
      );
    }

    const uploadedParts = await Promise.all(uploadPromises);

    const completeUpload = new CompleteMultipartUploadCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: fileName,
      UploadId: uploadId,
      MultipartUpload: { Parts: uploadedParts },
    });

    await s3.send(completeUpload);
    const endTime = Date.now();
    console.log(`Multipart upload completed in ${(endTime - startTime) / 1000} seconds.`);
    return `https://${process.env.DO_SPACES_BUCKET}.blr1.digitaloceanspaces.com/${fileName}`;
  } catch (error) {
    console.error("Multipart Upload Error:", error);
    if (uploadId) {
      try {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: fileName,
            UploadId: uploadId,
          })
        );
        console.log("Multipart upload aborted.");
      } catch (abortError) {
        console.error("Failed to abort multipart upload:", abortError);
      }
    }
    throw new Error("Multipart upload failed.");
  }
};

// Delete a file from DigitalOcean Spaces
const deleteFileFromS3 = async (fileUrl) => {
  try {
    const urlParts = new URL(fileUrl);
    const key = urlParts.pathname.substring(1);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
    });

    await s3.send(deleteCommand);
    console.log("File deleted from Space:", fileUrl);
  } catch (error) {
    console.error("Error deleting file:", error);
  }
};

// Upload multiple files in parallel
const bulkUploadFilesToS3 = async (files, folder, entityId) => {
  console.log(`Starting bulk upload for ${files.length} files to folder: ${folder}`);
  const startTime = Date.now();

  const uploadPromises = files.map(async (file) => {
    try {
      const url = await uploadMultipart(file, folder, entityId);
      return { originalname: file.originalname, url, error: null };
    } catch (error) {
      console.error(`Failed to upload ${file.originalname}:`, error.message);
      return { originalname: file.originalname, url: null, error: error.message };
    }
  });

  const results = await Promise.all(uploadPromises);
  const endTime = Date.now();
  console.log(`Bulk upload completed in ${(endTime - startTime) / 1000} seconds.`);

  const successful = results.filter((result) => result.url);
  const failed = results.filter((result) => result.error);

  console.log(`Bulk upload summary: ${successful.length} succeeded, ${failed.length} failed`);

  return results;
};

// Parse image file naming convention
const parseImageFilename = (filename) => {
  try {
    const primaryRegex = /^([^_]+)_primary\.\w+$/;
    const primaryMatch = filename.match(primaryRegex);
    if (primaryMatch) {
      return {
        productId: primaryMatch[1],
        colorId: null,
        isPrimary: true,
        index: 0,
      };
    }

    const colorRegex = /^([^_]+)_([^_]+)_(\d+)\.\w+$/;
    const colorMatch = filename.match(colorRegex);
    if (colorMatch) {
      return {
        productId: colorMatch[1],
        colorId: colorMatch[2],
        isPrimary: false,
        index: parseInt(colorMatch[3], 10),
      };
    }

    console.warn(`Invalid filename format: ${filename}`);
    return null;
  } catch (error) {
    console.error(`Error parsing filename ${filename}:`, error.message);
    return null;
  }
};

// Delete multiple files (cleanup)
const cleanupFailedUploads = async (fileUrls) => {
  console.log(`Cleaning up ${fileUrls.length} failed uploads`);
  const deletePromises = fileUrls.map(async (fileUrl) => {
    try {
      await deleteFileFromS3(fileUrl);
    } catch (error) {
      console.error(`Failed to delete ${fileUrl}:`, error.message);
    }
  });
  await Promise.all(deletePromises);
  console.log("Cleanup completed");
};

module.exports = {
  uploadMultipart,
  deleteFileFromS3,
  bulkUploadFilesToS3,
  parseImageFilename,
  cleanupFailedUploads,
};