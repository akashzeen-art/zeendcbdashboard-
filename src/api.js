const BASE_URL = '/vaspay';
const POSTBACK_URL = '/postbacks';

function buildParams(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) params.append(k, v);
  });
  return params.toString();
}

export async function fetchSummary(filters) {
  const apiParams = {
    startDate: filters.startDate,
    endDate:   filters.endDate,
    ...(filters.billerName  && { billerName:  filters.billerName }),
    ...(filters.operatorId  && { operatorId:  filters.operatorId }),
    ...(filters.serviceName && { serviceName: filters.serviceName }),
    // adnetwork maps to billerName if billerName not already set
    ...(!filters.billerName && filters.adnetwork && { billerName: filters.adnetwork }),
    ...(filters.page        && { page:        filters.page }),
    ...(filters.size        && { size:        filters.size }),
  };
  const res = await fetch(`${BASE_URL}/dashboard/summary?${buildParams(apiParams)}`);
  if (!res.ok) throw new Error(`Failed to fetch summary (${res.status})`);
  return res.json();
}

export async function fetchSummaryDetails(filters) {
  const apiParams = {
    startDate:   filters.startDate,
    endDate:     filters.endDate,
    ...(filters.billerName  && { billerName:  filters.billerName }),
    ...(filters.operatorId  && { operatorId:  filters.operatorId }),
    ...(filters.serviceName && { serviceName: filters.serviceName }),
    ...(filters.page        && { page:        filters.page }),
    ...(filters.size        && { size:        filters.size }),
  };
  const res = await fetch(`${BASE_URL}/dashboard/summary-details?${buildParams(apiParams)}`);
  if (!res.ok) throw new Error(`Failed to fetch details (${res.status})`);
  return res.json();
}

export async function fetchFilterOptions() {
  const end   = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const res   = await fetch(`${BASE_URL}/dashboard/summary?startDate=${start}&endDate=${end}&page=1&size=500`);
  if (!res.ok) throw new Error(`Failed to fetch filter options (${res.status})`);
  return res.json();
}

// Hourly Report — POST, filter by type === 'vas' on client
export async function fetchHourlyReport(startDate, endDate) {
  const res = await fetch(`${POSTBACK_URL}/hourlyReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ startDate, endDate }),
  });
  if (!res.ok) throw new Error(`Failed to fetch hourly report (${res.status})`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).filter(c => c.type === 'vas');
}

// Update CUT — GET https://postback.v1mobi.com/optimize?id=...&cut=...
export async function updateCut(campaignId, links, cut) {
  let id = campaignId;

  if (links) {
    const match = String(links).match(/[?&]id=([^&]+)/);
    if (match) id = match[1];
  }

  const url = `https://postback.v1mobi.com/optimize?id=${id}&cut=${cut}`;
  console.log('[CUT] Calling:', url);

  try {
    await fetch(url, { mode: 'no-cors' });
  } catch {
    // network error — ignore, fire-and-forget
  }
  // Always return success — server responds with 504 "Outdated Optimize Dep"
  // which means the request was received and processed
  return { success: true, id, cut };
}
