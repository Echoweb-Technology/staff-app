const BASE_URL = 'https://vtms.co.in/api/supervisor/driver';

export async function checkAppVersion() {
  try {
    const res = await fetch(`${BASE_URL}/check_version.php?v=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('Network response was not ok');
    }

    const json = await res.json();
    if (json.status === 200) {
      return json.data;
    } else {
      throw new Error(json.message || 'Failed to check version');
    }
  } catch (error) {
    console.error('App Version Check Error:', error);
    return null;
  }
}
