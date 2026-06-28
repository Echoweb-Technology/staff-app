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

/**
 * Fetch vehicles assigned to the logged-in supervisor for the current month.
 */
export async function getChecklistVehicles() {
  const headers = await getAuthHeaders();

  const res = await fetch(`${BASE_URL}/checklist-vehicles.php`, {
    method: 'GET',
    headers,
  });

  console.log('Response:', res);

  const data = await parseJsonResponse(
    res,
    'Failed to load vehicles'
  );

  console.log('Parsed Data:', headers);

  // Merge with locally tracked inspections for this month
  try {
    const monthKey = `@inspected_${new Date().getFullYear()}_${new Date().getMonth() + 1}`;
    const stored = await AsyncStorage.getItem(monthKey);
    const localInspected = stored ? JSON.parse(stored) : [];
    
    if (data && data.vehicles) {
      data.vehicles = data.vehicles.map(v => {
        if (localInspected.includes(v.registration)) {
          return { ...v, already_inspected: true };
        }
        return v;
      });
    }
  } catch (e) {
    console.warn('Failed to merge local inspections', e);
  }

  return data;
}
/**
 * Submit a vehicle checklist with all 18 items, remarks, and optional photo.
 * @param {FormData} formData - multipart form with all checklist fields
 */
export async function submitChecklist(formData, reg) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/checklist-submit.php`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await parseJsonResponse(res, 'Failed to submit checklist');
  
  // Track this inspection locally so the UI reflects it immediately
  // even if the backend hasn't updated its monthly logic yet.
  if (reg) {
    try {
      const monthKey = `@inspected_${new Date().getFullYear()}_${new Date().getMonth() + 1}`;
      const stored = await AsyncStorage.getItem(monthKey);
      const list = stored ? JSON.parse(stored) : [];
      if (!list.includes(reg)) {
        list.push(reg);
        await AsyncStorage.setItem(monthKey, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('Failed to track local inspection', e);
    }
  }

  return data;
}

/**
 * Fetch manager-level summary of inspections across all supervisors.
 */
export async function getChecklistSummary() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/checklist-summary.php`, {
    method: 'GET',
    headers,
  });
  return parseJsonResponse(res, 'Failed to load summary');
}

/**
 * Fetch details of a specific vehicle's inspection for the current month.
 * @param {string} vehicleReg 
 */
export async function getChecklistDetails(vehicleReg) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/checklist-details.php?vehicle=${encodeURIComponent(vehicleReg)}`, {
    method: 'GET',
    headers,
  });
  return parseJsonResponse(res, 'Failed to load inspection details');
}
