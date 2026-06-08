/**
 * Driver API – uses existing APIs at https://vtms.co.in/api/supervisor/driver/
 * JWT from AsyncStorage (@vtstaff_jwt_token).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@vtstaff_jwt_token';
const BASE_URL = 'https://vtms.co.in/api/supervisor/driver';

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * GET driver status.
 * Returns { status: 200, data: { duty_status, duration, has_vehicle, vehicle_details, monthly_booking, casual_booking, upcoming_monthly_booking, upcoming_casual_booking } }
 */
export async function getDriverStatus() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/status_new.php?1=1`, { method: 'GET', headers });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json();
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.message || 'Failed to fetch status');
  }
  return json;
}

/**
 * GET dashboard slider data.
 * Returns { status: 200, data: { driver, handover } }
 */
export async function getDashboardSlider() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/slider.php`, { method: 'GET', headers });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json();
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.message || 'Failed to fetch slider');
  }
  return json;
}

/**
 * POST start-duty (multipart/form-data).
 * Fields: odometer_reading, booking_id, user_name, user_phone_no, start_latitude, start_longitude, odometer_photo (file)
 */
export async function startDuty(formData) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // Do not set Content-Type; browser will set multipart boundary
  const res = await fetch(`${BASE_URL}/start-duty.php`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');

  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.message || 'Failed to start duty');
  }
  return json;
}

/**
 * POST end-duty (multipart/form-data).
 * Fields: odometer_reading, end_latitude, end_longitude, end_odometer_photo (file)
 */
export async function endDuty(formData) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/end-duty.php`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');

  const json = await res.json().catch(() => ({}));
  console.log(json);
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.message || 'Failed to end duty');
  }
  return json;
}

/**
 * POST add-fuel (multipart/form-data).
 */
export async function addFuel(formData) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/add-fuel.php`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');

  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.msg || json.message || 'Failed to add fuel');
  }
  return json;
}
