import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { JPEG_QUALITY, MAX_IMAGE_EDGE, downscaleTarget } from './photoImageSizing';

/**
 * Getting a meal photo ready to estimate.
 *
 * The sizing maths lives in photoImageSizing so it can be tested without pulling React
 * Native in; this file is only the device interaction around it.
 *
 * Nothing here throws, and nothing raises a modal: every outcome is a value the caller can
 * render inline, including the person simply changing their mind.
 */

export type PhotoCaptureSource = 'camera' | 'library';

export type PhotoCaptureResult =
  | { ok: true; base64: string; mediaType: 'image/jpeg'; uri: string; width: number; height: number }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'permission_denied'; detail: string }
  | { ok: false; reason: 'unavailable'; detail: string };

async function ensurePermission(source: PhotoCaptureSource): Promise<PhotoCaptureResult | null> {
  const request = source === 'camera'
    ? ImagePicker.requestCameraPermissionsAsync
    : ImagePicker.requestMediaLibraryPermissionsAsync;
  try {
    const { granted, canAskAgain } = await request();
    if (granted) return null;
    return {
      ok: false,
      reason: 'permission_denied',
      detail: canAskAgain
        ? source === 'camera'
          ? 'Healthi needs camera access to estimate a meal from a photo.'
          : 'Healthi needs photo access to estimate a meal from a photo.'
        : `Allow ${source === 'camera' ? 'camera' : 'photo'} access in Settings to use this.`
    };
  } catch {
    return { ok: false, reason: 'unavailable', detail: 'Could not check photo permissions on this device.' };
  }
}

/**
 * Takes or picks a photo, shrinks it, and returns it as base64.
 *
 * `base64` is requested from the manipulator rather than the picker so it is always the
 * resized bytes that travel, never the original.
 */
export async function capturePhotoForEstimate(
  source: PhotoCaptureSource,
  maxEdge = MAX_IMAGE_EDGE
): Promise<PhotoCaptureResult> {
  const denied = await ensurePermission(source);
  if (denied) return denied;

  let picked: ImagePicker.ImagePickerResult;
  try {
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      // The photo is evidence of a portion; cropping it would throw away the size cues
      // the estimate depends on, so the frame is left as taken.
      allowsEditing: false,
      quality: 1,
      exif: false
    };
    picked = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  } catch {
    return { ok: false, reason: 'unavailable', detail: 'Could not open the camera on this device.' };
  }

  if (picked.canceled || !picked.assets?.length) return { ok: false, reason: 'cancelled' };
  const asset = picked.assets[0]!;

  try {
    const target = downscaleTarget(asset.width ?? 0, asset.height ?? 0, maxEdge);
    const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);
    if (target) context.resize(target);
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      base64: true,
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG
    });
    if (!saved.base64) {
      return { ok: false, reason: 'unavailable', detail: 'Could not prepare that photo for an estimate.' };
    }
    return {
      ok: true,
      base64: saved.base64,
      mediaType: 'image/jpeg',
      uri: saved.uri,
      width: saved.width ?? target?.width ?? asset.width ?? 0,
      height: saved.height ?? target?.height ?? asset.height ?? 0
    };
  } catch {
    return { ok: false, reason: 'unavailable', detail: 'Could not prepare that photo for an estimate.' };
  }
}

export { MAX_IMAGE_EDGE, downscaleTarget, estimateImageTokens } from './photoImageSizing';
