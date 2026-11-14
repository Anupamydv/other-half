import {
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {env} from '../config/env.js';

const configured = Boolean(
  env.MEDIA_S3_ENDPOINT && env.MEDIA_S3_PUBLIC_ENDPOINT && env.MEDIA_S3_ACCESS_KEY && env.MEDIA_S3_SECRET_KEY,
);

const credentials = configured ? {accessKeyId: env.MEDIA_S3_ACCESS_KEY!, secretAccessKey: env.MEDIA_S3_SECRET_KEY!} : undefined;
const internalClient = configured ? new S3Client({
  endpoint: env.MEDIA_S3_ENDPOINT,
  region: env.MEDIA_S3_REGION,
  forcePathStyle: true,
  credentials,
}) : null;
const browserClient = configured ? new S3Client({
  endpoint: env.MEDIA_S3_PUBLIC_ENDPOINT,
  region: env.MEDIA_S3_REGION,
  forcePathStyle: true,
  credentials,
}) : null;

export const MEDIA_BUCKET = env.MEDIA_S3_BUCKET;
export const MEDIA_STORAGE_CONFIGURED = configured;

function requireInternalClient() {
  if (!internalClient || !browserClient) throw new Error('Private media storage is not configured.');
  return {internalClient, browserClient};
}

export async function createSignedUploadUrl(key: string, contentType: string, contentLength: number) {
  const {browserClient} = requireInternalClient();
  return getSignedUrl(browserClient, new PutObjectCommand({
    Bucket: MEDIA_BUCKET, Key: key, ContentType: contentType, ContentLength: contentLength,
  }), {expiresIn: 10 * 60});
}

export async function createSignedViewUrl(key: string) {
  const {browserClient} = requireInternalClient();
  return getSignedUrl(browserClient, new GetObjectCommand({Bucket: MEDIA_BUCKET, Key: key}), {expiresIn: 15 * 60});
}

export async function inspectStoredObject(key: string) {
  const {internalClient} = requireInternalClient();
  const metadata = await internalClient.send(new HeadObjectCommand({Bucket: MEDIA_BUCKET, Key: key}));
  return {contentLength: metadata.ContentLength ?? 0, contentType: metadata.ContentType ?? ''};
}

export async function copyStoredObject(sourceKey: string, destinationKey: string, contentType: string) {
  const {internalClient} = requireInternalClient();
  await internalClient.send(new CopyObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: destinationKey,
    CopySource: `${MEDIA_BUCKET}/${sourceKey}`,
    MetadataDirective: 'REPLACE',
    ContentType: contentType,
  }));
}

export async function readStoredObjectPrefix(key: string, byteLength = 16) {
  const {internalClient} = requireInternalClient();
  const result = await internalClient.send(new GetObjectCommand({
    Bucket: MEDIA_BUCKET, Key: key, Range: `bytes=0-${byteLength - 1}`,
  }));
  return result.Body ? Buffer.from(await result.Body.transformToByteArray()) : Buffer.alloc(0);
}

export async function deleteStoredObject(key: string) {
  if (!internalClient) return;
  await internalClient.send(new DeleteObjectCommand({Bucket: MEDIA_BUCKET, Key: key}));
}
