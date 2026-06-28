import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@vtstaff_jwt_token';
const BASE_URL = 'https://vtms.co.in/api/staff-app';

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function buildQuery(params = {}) {
  const serialized = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join('&');

  return serialized ? `?${serialized}` : '';
}

async function parseJsonResponse(res, fallbackMessage) {
  if (res.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  const json = await res.json().catch(() => ({}));
  if (res.status !== 200 || (json.status && json.status !== 200)) {
    throw new Error(json.msg || json.message || fallbackMessage);
  }

  return json;
}

export async function getTransferMeta(params) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/handover-meta.php${buildQuery(params)}`, {
    method: 'GET',
    headers,
  });

  return parseJsonResponse(res, 'Failed to load handover data');
}

export async function submitHandover(formData) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/handover.php`, {
    method: 'POST',
    headers,
    body: formData,
  });

  return parseJsonResponse(res, 'Failed to submit handover');
}

export async function submitTakeover(formData) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/takeover.php`, {
    method: 'POST',
    headers,
    body: formData,
  });

  return parseJsonResponse(res, 'Failed to submit takeover');
}
