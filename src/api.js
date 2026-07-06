import { updateCutValue } from './utils';

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

/** Fetch all summary rows for a date range (paginated). */
export async function fetchAllSummary(filters) {
  const pageSize = 500;
  let page = 1;
  let all = [];
  let meta = {};

  while (true) {
    const res = await fetchSummary({ ...filters, page, size: pageSize });
    meta = {
      total: res.total,
      dateRange: res.dateRange,
      startDate: res.startDate,
      endDate: res.endDate,
      status: res.status,
    };
    const batch = res.data || [];
    all = all.concat(batch);
    if (!batch.length || batch.length < pageSize) break;
    page += 1;
  }

  return { data: all, meta };
}

/** Fetch all summary-details rows for a date range (paginated). */
export async function fetchAllSummaryDetails(startDate, endDate, extra = {}) {
  const pageSize = 500;
  let page = 1;
  let all = [];
  let total = Infinity;

  while (all.length < total) {
    const res = await fetchSummaryDetails({ startDate, endDate, page, size: pageSize, ...extra });
    const batch = res.data || [];
    all = all.concat(batch);
    total = res.total ?? all.length;
    if (!batch.length) break;
    page += 1;
  }

  return all;
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

// Update CUT — GET /optimize?id={campaignId}&cut={0–100 step 10}
export async function updateCut(campaignId, links, cut) {
  return updateCutValue(campaignId, links, cut);
}
