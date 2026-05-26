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
  if (!res.ok) throw new Error(`Failed to fetch summary details (${res.status})`);
  return res.json();
}
