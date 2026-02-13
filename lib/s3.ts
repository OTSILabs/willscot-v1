import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
});

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
 * Generates a pre-signed URL for a given S3 URI
 */
export async function getPresignedUrl(s3Uri: string, expiresIn: number = 3600) {
  try {
    const parsed = parseS3Uri(s3Uri);
    if (!parsed) return s3Uri; // Return original if not a valid s3 uri

    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error("Error generating presigned URL for", s3Uri, error);
    return s3Uri;
  }
}
