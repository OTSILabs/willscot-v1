import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const defaultRegion = "us-west-2";

const sharedCredentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  sessionToken: process.env.AWS_SESSION_TOKEN,
};

const s3ClientsByRegion = new Map<string, S3Client>();

function getS3Client(region?: string) {
  const resolvedRegion = region || defaultRegion;
  const existing = s3ClientsByRegion.get(resolvedRegion);
  if (existing) return existing;

  const client = new S3Client({
    region: resolvedRegion,
    credentials: sharedCredentials,
    useAccelerateEndpoint: process.env.ENABLE_S3_ACCELERATION === "true",
  });

  s3ClientsByRegion.set(resolvedRegion, client);
  return client;
}

/**
 * Parses an S3 URI (s3://bucket/key) into bucket and key
 */
function parseS3Uri(uri: string) {
  const match = uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) return null;
  return {
    bucket: match[1],
    key: match[2],
  };
}

/**
 * Generates a pre-signed URL for a given S3 URI (for GET operations)
 */
export async function getPresignedUrl(
  s3Uri: string,
  expiresIn: number = 3600,
  region?: string,
) {
  try {
    const parsed = parseS3Uri(s3Uri);
    if (!parsed) return s3Uri; // Return original if not a valid s3 uri

    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });

    const s3Client = getS3Client(region);
    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating presigned URL for", s3Uri, error);
    return s3Uri;
  }
}

/**
 * Generates a pre-signed URL for uploading a file to S3 (PUT operation)
 */
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number = 3600,
  region?: string,
) {
  try {
    const s3Client = getS3Client(region);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating presigned upload URL:", error);
    throw error;
  }
}

/**
 * Uploads a file buffer to S3
 */
export async function uploadFileToS3Buffer(
  buffer: Buffer,
  bucket: string,
  key: string,
  contentType: string,
  region?: string,
) {
  try {
    const s3Client = getS3Client(region);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);
    return `s3://${bucket}/${key}`;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

/**
 * Initiates a multipart upload
 */
export async function initiateMultipartUpload(
  bucket: string,
  key: string,
  contentType: string,
  region?: string,
) {
  try {
    const s3Client = getS3Client(region);
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const response = await s3Client.send(command);
    return {
      uploadId: response.UploadId,
      key: response.Key,
      bucket: response.Bucket,
    };
  } catch (error) {
    console.error("Error initiating multipart upload:", error);
    throw error;
  }
}

/**
 * Generates presigned URLs for a set of parts in a multipart upload
 */
export async function getPresignedPartUrls(
  bucket: string,
  key: string,
  uploadId: string,
  partsCount: number,
  region?: string,
) {
  try {
    const s3Client = getS3Client(region);
    const presignedUrls: { partNumber: number; url: string }[] = [];

    for (let i = 1; i <= partsCount; i++) {
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: i,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      presignedUrls.push({ partNumber: i, url });
    }

    return presignedUrls;
  } catch (error) {
    console.error("Error generating presigned part URLs:", error);
    throw error;
  }
}

/**
 * Completes a multipart upload
 */
export async function completeMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[],
  region?: string,
) {
  try {
    const s3Client = getS3Client(region);
    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });

    const response = await s3Client.send(command);
    return {
      location: response.Location,
      bucket: response.Bucket,
      key: response.Key,
      s3Uri: `s3://${response.Bucket}/${response.Key}`,
    };
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    throw error;
  }
}

/**
 * Aborts a multipart upload
 */
export async function abortMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  region?: string,
) {
  try {
    const s3Client = getS3Client(region);
    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });

    await s3Client.send(command);
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    throw error;
  }
}
