const BASE_URL = '/vaspay';

function buildParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) params.append(k, v);
  });
  return params.toString();
}

export async function fetchSummary(filters) {
  const res = await fetch(`${BASE_URL}/dashboard/summary?${buildParams(filters)}`);
  if (!res.ok) throw new Error(`Failed to fetch summary (${res.status})`);
  return res.json();
}

export async function fetchSummaryDetails(filters) {
  const res = await fetch(`${BASE_URL}/dashboard/summary-details?${buildParams(filters)}`);
  if (!res.ok) throw new Error(`Failed to fetch details (${res.status})`);
  return res.json();
}

// Used by FilterBar to populate dropdowns from real API data
export async function fetchFilterOptions() {
  const end   = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const res   = await fetch(`${BASE_URL}/dashboard/summary?startDate=${start}&endDate=${end}&page=1&size=500`);
  if (!res.ok) throw new Error(`Failed to fetch filter options (${res.status})`);
  return res.json();
}
