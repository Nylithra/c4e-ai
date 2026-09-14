import { UserProfile } from '../types';
import { verifyAdminAccess } from './securityHelper';

export const MAX_NORMAL_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_SPARK_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB

// Post Character Limits (200 for regular users, 1000 for Spark supporters)
export const MAX_NORMAL_POST_LENGTH = 200;
export const MAX_SPARK_POST_LENGTH = 1000;

// Allowed Safe MIME types
export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

export const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

export interface FileSizeValidationResult {
  isValid: boolean;
  errorType?: 'exceeds_normal_15mb' | 'exceeds_spark_250mb' | 'unsupported_file_type';
  fileSizeMB: number;
  maxAllowedMB: number;
  isSpark: boolean;
  fileName: string;
  mimeType?: string;
}

/**
 * Checks whether a user holds the paid Spark supporter perks.
 *
 * SECURITY: the answer comes exclusively from `supporter_tier`, a profile column that only
 * the backend / administrators can write (enforced by a Postgres trigger, see
 * supabase_schema.sql), or from the administrator flag.
 *
 * The previous implementation also accepted `role`, `badges` and `subscription` — all of
 * which a user can set on their own profile — so anyone could simply type "Spark" into
 * their role field and unlock the 250MB upload / 1000 character perks for free.
 */
export function isUserSpark(user?: Partial<UserProfile> | null): boolean {
  if (!user) return false;

  const tier = (user.supporter_tier || (user as any).custom_fields?.supporter_tier || '').toString().toLowerCase().trim();
  if (tier === 'spark') return true;

  // Platform administrators implicitly get the full limits.
  return verifyAdminAccess(user as any);
}

/**
 * Returns the maximum post character limit (200 for regular, 1000 for Spark supporters).
 */
export function getMaxPostLength(user?: Partial<UserProfile> | null): number {
  return isUserSpark(user) ? MAX_SPARK_POST_LENGTH : MAX_NORMAL_POST_LENGTH;
}

/**
 * Validates a file against safe MIME types and user limits (15MB for normal, 250MB for Spark supporters).
 */
export function validateFileSize(file: File, user?: Partial<UserProfile> | null): FileSizeValidationResult {
  const isSparkUser = isUserSpark(user);
  const maxBytes = isSparkUser ? MAX_SPARK_FILE_SIZE_BYTES : MAX_NORMAL_FILE_SIZE_BYTES;
  const maxAllowedMB = isSparkUser ? 250 : 15;
  const fileSizeMB = Math.round((file.size / (1024 * 1024)) * 10) / 10;
  const mime = file.type?.toLowerCase() || '';

  // Validate allowed file types
  const isAllowedImage = ALLOWED_IMAGE_TYPES.has(mime) || file.type.startsWith('image/');
  const isAllowedVideo = ALLOWED_VIDEO_TYPES.has(mime) || file.type.startsWith('video/');

  if (!isAllowedImage && !isAllowedVideo) {
    return {
      isValid: false,
      errorType: 'unsupported_file_type',
      fileSizeMB,
      maxAllowedMB,
      isSpark: isSparkUser,
      fileName: file.name,
      mimeType: mime
    };
  }

  // Enforce size limits
  if (file.size > maxBytes) {
    const errorType = isSparkUser ? 'exceeds_spark_250mb' : 'exceeds_normal_15mb';
    return {
      isValid: false,
      errorType,
      fileSizeMB,
      maxAllowedMB,
      isSpark: isSparkUser,
      fileName: file.name,
      mimeType: mime
    };
  }

  return {
    isValid: true,
    fileSizeMB,
    maxAllowedMB,
    isSpark: isSparkUser,
    fileName: file.name,
    mimeType: mime
  };
}

/**
 * Dispatches a global event for the animated top banner
 */
export function notifyFileSizeExceeded(result: FileSizeValidationResult): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('c4e:file_size_exceeded', {
        detail: result
      })
    );
  }
}
