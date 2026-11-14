import {randomUUID} from 'node:crypto';
import {S3ServiceException} from '@aws-sdk/client-s3';
import {Router} from 'express';
import {listingMediaUploadSchema} from '@other-half/contracts';
import {prisma} from '../lib/prisma.js';
import {HttpError, asyncRoute} from '../lib/http.js';
import {requireSession} from './auth.js';
import {
  copyStoredObject, createSignedUploadUrl, deleteStoredObject, inspectStoredObject,
  MEDIA_STORAGE_CONFIGURED, readStoredObjectPrefix,
} from '../lib/mediaStorage.js';

const MAX_MEDIA = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const signatures: Record<string, (bytes: Buffer) => boolean> = {
  'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (bytes) => bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
};

export const listingMediaRouter = Router();

listingMediaRouter.post('/listings/:id/media/uploads', requireSession, asyncRoute(async (request, response) => {
  if (!MEDIA_STORAGE_CONFIGURED) throw new HttpError(503, 'MEDIA_STORAGE_UNAVAILABLE', 'Listing photo storage is not configured. Start the local MinIO service and configure the MEDIA_S3 settings.');
  const parsed = listingMediaUploadSchema.safeParse(request.body);
  if (!parsed.success) throw new HttpError(400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid photo details.');
  const listingId = request.params.id as string;
  const ownerId = response.locals.sessionUserId as string;
  const mediaId = randomUUID();
  const objectKey = `listings/${listingId}/pending/${mediaId}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.$transaction(async (transaction) => {
    const listing = await transaction.listing.findFirst({where: {id: listingId, ownerId, status: 'ACTIVE'}, select: {id: true}});
    if (!listing) throw new HttpError(404, 'LISTING_NOT_FOUND', 'An active listing owned by you was not found.');
    await transaction.$queryRaw`SELECT id FROM "Listing" WHERE id = ${listingId} FOR UPDATE`;
    const count = await transaction.listingMedia.count({where: {listingId, OR: [
      {status: 'READY'}, {status: 'PENDING', expiresAt: {gt: new Date()}},
    ]}});
    if (count >= MAX_MEDIA) throw new HttpError(409, 'MEDIA_LIMIT_REACHED', 'A listing can have up to five photos. Remove a photo before adding another.');
    await transaction.listingMedia.create({data: {
      id: mediaId, listingId, uploaderId: ownerId, objectKey,
      contentType: parsed.data.contentType, byteSize: parsed.data.byteSize, altText: parsed.data.altText,
      sortOrder: count, expiresAt,
    }});
  });
  try {
    const uploadUrl = await createSignedUploadUrl(objectKey, parsed.data.contentType, parsed.data.byteSize);
    response.status(201).json({mediaId, uploadUrl, expiresInSeconds: 600});
  } catch (cause) {
    await prisma.listingMedia.delete({where: {id: mediaId}});
    throw cause;
  }
}));

listingMediaRouter.post('/listings/:id/media/:mediaId/complete', requireSession, asyncRoute(async (request, response) => {
  const ownerId = response.locals.sessionUserId as string;
  const listingId = request.params.id as string;
  const mediaId = request.params.mediaId as string;
  const media = await prisma.listingMedia.findFirst({where: {
    id: mediaId, listingId, uploaderId: ownerId, status: 'PENDING', expiresAt: {gt: new Date()},
    listing: {ownerId, status: 'ACTIVE'},
  }});
  if (!media) throw new HttpError(404, 'MEDIA_UPLOAD_NOT_FOUND', 'This pending photo upload was not found.');
  let sourceValid = false;
  try {
    const metadata = await inspectStoredObject(media.objectKey);
    if (metadata.contentLength === media.byteSize && metadata.contentLength <= MAX_BYTES && metadata.contentType === media.contentType) {
      sourceValid = signatures[media.contentType]?.(await readStoredObjectPrefix(media.objectKey)) ?? false;
    }
  } catch (cause) {
    if (!(cause instanceof S3ServiceException && cause.$metadata.httpStatusCode === 404)) throw cause;
  }
  const finalKey = `listings/${listingId}/ready/${media.id}`;
  if (!sourceValid) {
    await deleteStoredObject(media.objectKey).catch(() => undefined);
    await prisma.listingMedia.deleteMany({where: {id: media.id, status: 'PENDING'}});
    throw new HttpError(400, 'INVALID_MEDIA_UPLOAD', 'The uploaded file is missing or is not a valid JPEG, PNG, or WebP image with the declared size and type.');
  }
  await copyStoredObject(media.objectKey, finalKey, media.contentType);
  let finalValid = false;
  try {
    const finalMetadata = await inspectStoredObject(finalKey);
    finalValid = finalMetadata.contentLength === media.byteSize && finalMetadata.contentType === media.contentType &&
      (signatures[media.contentType]?.(await readStoredObjectPrefix(finalKey)) ?? false);
  } catch {
    finalValid = false;
  }
  if (!finalValid) {
    await deleteStoredObject(finalKey).catch(() => undefined);
    await deleteStoredObject(media.objectKey).catch(() => undefined);
    await prisma.listingMedia.deleteMany({where: {id: media.id, status: 'PENDING'}});
    throw new HttpError(400, 'INVALID_MEDIA_UPLOAD', 'The uploaded file changed during verification. Please upload the photo again.');
  }
  const result = await prisma.listingMedia.updateMany({
    where: {id: media.id, status: 'PENDING'},
    data: {objectKey: finalKey, status: 'READY', verifiedAt: new Date()},
  });
  if (result.count !== 1) {
    await deleteStoredObject(finalKey).catch(() => undefined);
    throw new HttpError(409, 'MEDIA_UPLOAD_CHANGED', 'This upload changed. Refresh the listing and try again.');
  }
  await deleteStoredObject(media.objectKey).catch(() => undefined);
  response.status(204).end();
}));

listingMediaRouter.delete('/listings/:id/media/:mediaId', requireSession, asyncRoute(async (request, response) => {
  const ownerId = response.locals.sessionUserId as string;
  const media = await prisma.listingMedia.findFirst({where: {
    id: request.params.mediaId as string,
    listingId: request.params.id as string,
    uploaderId: ownerId,
    listing: {ownerId},
  }});
  if (!media) throw new HttpError(404, 'LISTING_MEDIA_NOT_FOUND', 'Photo not found.');
  try { await deleteStoredObject(media.objectKey); } catch (cause) {
    throw new HttpError(503, 'MEDIA_DELETE_FAILED', 'The photo could not be removed from storage. Please retry.');
  }
  await prisma.listingMedia.delete({where: {id: media.id}});
  response.status(204).end();
}));

