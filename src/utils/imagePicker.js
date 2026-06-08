/**
 * Pick image from camera or gallery and optionally resize (e.g. max width 1024, quality 0.7).
 */

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import { PermissionsAndroid, Platform } from 'react-native';

const RESIZE_WIDTH = 1024;
const QUALITY = 70;

export function pickImageOptions() {
  return {
    mediaType: 'photo',
    includeBase64: false,
    saveToPhotos: false,
  };
}

async function ensureCameraPermission() {
  if (Platform.OS !== 'android') return true;

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
    {
      title: 'Camera permission',
      message: 'VTStaff needs camera access to capture odometer photos.',
      buttonPositive: 'OK',
    }
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Open camera or gallery. Returns { uri } or null if cancelled.
 */
export async function pickImageFromCamera() {
  const hasPermission = await ensureCameraPermission();
  if (!hasPermission) {
    throw new Error('Camera permission denied. Please allow camera access from app settings.');
  }

  const result = await launchCamera(pickImageOptions());
  if (result.didCancel) {
    return null;
  }
  if (result.errorCode) {
    throw new Error(result.errorMessage || 'Unable to open camera.');
  }
  if (!result.assets?.[0]?.uri) {
    return null;
  }
  return { uri: result.assets[0].uri };
}

export async function pickImageFromGallery() {
  const result = await launchImageLibrary(pickImageOptions());
  if (result.didCancel) {
    return null;
  }
  if (result.errorCode) {
    throw new Error(result.errorMessage || 'Unable to open gallery.');
  }
  if (!result.assets?.[0]?.uri) {
    return null;
  }
  return { uri: result.assets[0].uri };
}

/**
 * Resize image at uri to max width 1024 and quality 70. Returns path to resized file (uri).
 */
export async function resizeImage(uri) {
  const res = await ImageResizer.createResizedImage(
    uri,
    RESIZE_WIDTH,
    9999,
    'JPEG',
    QUALITY,
    0,
    undefined,
    false
  );
  return res.uri;
}

/**
 * Aggressive compression for low-bandwidth networks (e.g., fuel slips).
 * Max width 800, 45% JPEG quality.
 */
export async function compressImageHeavy(uri) {
  const res = await ImageResizer.createResizedImage(
    uri,
    800,
    9999,
    'JPEG',
    45,
    0,
    undefined,
    false
  );
  return res.uri;
}
