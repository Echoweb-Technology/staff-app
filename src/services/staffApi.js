/**
 * Staff app APIs – attendance at https://vtms.co.in/api/staff-app/
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@vtstaff_jwt_token';
const USER_KEY = '@vtstaff_user';
const BASE_URL = 'https://vtms.co.in/api/staff-app';

function parseStoredJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function decodeBase64Fallback(value) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let buffer = 0;
  let bits = 0;
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '=') {
      break;
    }

    const decoded = chars.indexOf(char);
    if (decoded === -1) {
      continue;
    }

    buffer = (buffer << 6) | decoded;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  return output;
}

function decodeBase64Url(value) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding =
    normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const encoded = `${normalized}${padding}`;
  const decoded =
    typeof global.atob === 'function'
      ? global.atob(encoded)
      : decodeBase64Fallback(encoded);

  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map(char => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
  } catch (error) {
    return decoded;
  }
}

function decodeJwtPayload(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [, payload] = token.split('.');
  const decodedPayload = decodeBase64Url(payload);
  if (!decodedPayload) {
    return null;
  }

  try {
    return JSON.parse(decodedPayload);
  } catch (error) {
    return null;
  }
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id ?? null,
    code: user.code ?? user.user_code ?? null,
    name: user.name ?? user.user_name ?? null,
    image: user.image ?? null,
    type: user.type ?? null,
    mobile_no: user.mobile_no ?? user.mobile ?? null,
  };
}

export async function storeAuthSession(token, user) {
  const operations = [];

  if (token) {
    operations.push(AsyncStorage.setItem(TOKEN_KEY, token));
  }

  const normalizedUser = normalizeUser(user);
  if (normalizedUser) {
    operations.push(AsyncStorage.setItem(USER_KEY, JSON.stringify(normalizedUser)));
  }

  await Promise.all(operations);
}

export async function getStoredStaffUser() {
  const [storedUser, token] = await Promise.all([
    AsyncStorage.getItem(USER_KEY),
    AsyncStorage.getItem(TOKEN_KEY),
  ]);

  const parsedUser = normalizeUser(parseStoredJson(storedUser));
  if (parsedUser?.name) {
    return parsedUser;
  }

  const payload = decodeJwtPayload(token);
  return normalizeUser(payload);
}

export async function clearStoredStaffSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function getAttendanceStatus(date) {
  const headers = await getAuthHeaders();
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${BASE_URL}/status.php${query}`, {method: 'GET', headers});
  console.log('getAttendanceStatus', res);
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json();
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.msg || 'Failed to fetch attendance status');
  }

  return json;
}

/**
 * POST attendance punch (multipart).
 * Fields: action (in|out), latitude, longitude, photo (optional file)
 */
export async function punchAttendance(formData) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/punch.php`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.msg || 'Failed to mark attendance');
  }

  return json;
}

/**
 * Fetch permissions for the current user.
 */
export async function getPermissions() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/permissions.php`, {
    method: 'GET',
    headers,
  });
  
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.msg || 'Failed to fetch permissions');
  }

  return json;
}
