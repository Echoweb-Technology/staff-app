/**
 * Location helpers using @react-native-community/geolocation.
 * - Requests runtime permission
 * - Tries high accuracy first, then falls back to balanced accuracy
 */

import { Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

function getCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (err) => reject(new Error(err?.message || 'Unable to get location')),
      options
    );
  });
}

export async function getCurrentPositionAsync() {
  try {
    return await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 10000,
      distanceFilter: 0,
      forceRequestLocation: true,
      showLocationDialog: true,
    });
  } catch (_err) {
    // Fallback for devices where GPS fix takes too long indoors/with weak signal.
    return getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 60000,
      distanceFilter: 0,
      forceRequestLocation: true,
      showLocationDialog: true,
    });
  }
}

/**
 * Request location permission before reading current location.
 */
export async function requestLocationPermissionAsync() {
  if (Platform.OS === 'android') {
    const { PermissionsAndroid } = require('react-native');
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const fineGranted =
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const coarseGranted =
      result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return fineGranted || coarseGranted;
  }

  if (Platform.OS === 'ios') {
    const status = await Geolocation.requestAuthorization('whenInUse');
    return status === 'granted';
  }

  return true;
}
