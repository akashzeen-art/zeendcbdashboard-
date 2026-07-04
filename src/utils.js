const POSTBACK_URL = '/postbacks';

function intVal(v) {
  return parseInt(v ?? 0, 10) || 0;
}

function clicksFrom(item) {
  return intVal(item.clicks ?? item.click ?? item.Clicks);
}

function conversionsFrom(item) {
  return intVal(item.conversions ?? item.conversion ?? item.Conversions);
}

function stpFrom(item) {
  return intVal(item.stp ?? item.STP ?? item.sendToPartner);
}

/** Map hourly API rows to 24-slot arrays (index = hour 0–23). */
export function parseHourlyData(hourlyData) {
  const clicks      = new Array(24).fill(0);
  const conversions = new Array(24).fill(0);
  const stp         = new Array(24).fill(0);

  (hourlyData || []).forEach(item => {
    const match = String(item.hour ?? '').trim().match(/^(\d{1,2}):\d{2}/);
    if (!match) return;
    const h = parseInt(match[1], 10);
    if (h < 0 || h > 23) return;
    clicks[h]      += clicksFrom(item);
    conversions[h] += conversionsFrom(item);
    stp[h]         += stpFrom(item);
  });

  return { clicks, conversions, stp };
}

export function sumHourlyTotals(parsed) {
  const sum = arr => arr.reduce((a, b) => a + b, 0);
  return {
    clicks:      sum(parsed.clicks),
    conversions: sum(parsed.conversions),
    stp:         sum(parsed.stp),
  };
}

/** Sum clicks, conversions, STP from hourly API data. */
export function totalsFromHourlyData(hourlyData) {
  return sumHourlyTotals(parseHourlyData(hourlyData));
}

/** Local currency → USD divisors by operator code. */
const USD_DIVISORS = {
  SD_MTN:    600,
  NG_MTN:    1550,
  SAFARICOM: 130,
};

export function usdDivisorFor(operatorName) {
  const key = (operatorName || '').toUpperCase().trim();
  return USD_DIVISORS[key] || null;
}

/** Convert local revenue to USD; returns null when no rate is configured. */
export function localToUsd(amount, operatorName) {
  const divisor = usdDivisorFor(operatorName);
  if (!divisor || !amount) return null;
  return amount / divisor;
}

/** CR % = (conversions ÷ clicks) × 100 */
export function calcCR(conv, clicks) {
  const denom = intVal(clicks);
  const num = intVal(conv);
  return denom > 0 ? ((num / denom) * 100).toFixed(2) : '0.00';
}

/** STP CR % = (STP ÷ clicks) × 100 */
export function calcStpCR(stp, clicks) {
  const denom = intVal(clicks);
  return denom > 0 ? ((intVal(stp) / denom) * 100).toFixed(2) : '0.00';
}

export const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => ({
  slot:  `${i}-${i + 1}`,
  index: i,
}));

const GEO_LABELS = {
  NG: 'Nigeria (NG)',
  SD: 'Sudan (SD)',
  KE: 'Kenya (KE)',
};

/** Parse API operator code → { geo, operator } e.g. NG_MTN → Nigeria (NG), MTN */
export function parseOperatorFields(operatorName, operatorId) {
  const raw = (operatorName || '').trim();
  if (!raw && operatorId) return { geo: null, operator: String(operatorId) };

  const upper = raw.toUpperCase();

  if (upper.includes('SAFARICOM')) {
    return { geo: GEO_LABELS.KE, operator: 'Safaricom' };
  }

  const coded = upper.match(/^([A-Z]{2})[_\s-]+(.+)$/);
  if (coded) {
    const code = coded[1];
    const opRaw = coded[2].replace(/_/g, ' ').trim();
    const geo = GEO_LABELS[code] || `${code}`;
    const operator = opRaw === 'MTN' ? 'MTN' : opRaw.replace(/\b\w/g, c => c.toUpperCase());
    return { geo, operator };
  }

  if (upper.includes('NG') && upper.includes('MTN')) return { geo: GEO_LABELS.NG, operator: 'MTN' };
  if (upper.includes('SD') && upper.includes('MTN')) return { geo: GEO_LABELS.SD, operator: 'MTN' };

  return { geo: null, operator: raw || null };
}

/** Daily / Weekly / Monthly from campaign product name */
export function parsePackFromProduct(productName) {
  const p = (productName || '').toLowerCase();
  if (/\bdaily\b/.test(p)) return 'Daily';
  if (/\bweekly\b/.test(p)) return 'Weekly';
  if (/\bmonthly\b/.test(p)) return 'Monthly';
  return null;
}

/** Service name from billing row or hourly campaign */
export function resolveServiceName({ billingService, metaService, productName }) {
  if (billingService) return billingService;
  if (metaService) return metaService;
  const name = (productName || '').trim();
  if (!name) return null;
  return name.replace(/\s+(Daily|Weekly|Monthly)\s*$/i, '').trim() || name;
}

/** Map hourly campaign links/product to billing aggregator + operator. */
export function billerFromHourly(c) {
  const links   = (c.links || '').toLowerCase();
  const product = (c.productname || '').toLowerCase().trim();
  if (links.includes('/briccs/') || links.includes('briccslp') || product.includes('bric')) {
    return {
      billerName: 'BRICCS',
      operatorId: 2135,
      operatorName: 'NG_MTN',
      serviceName: 'Poker',
      ...parseOperatorFields('NG_MTN', 2135),
    };
  }
  if (links.includes('xceed') || product === 'xceed' || product.includes('xceed')) {
    return {
      billerName: 'XCEED',
      operatorId: 9039,
      operatorName: 'SD_MTN',
      serviceName: 'AIGamopedia',
      ...parseOperatorFields('SD_MTN', 9039),
    };
  }
  return null;
}

export function passesTrafficFilters(c, filters) {
  const meta = billerFromHourly(c);
  if (filters.billerName && (!meta || meta.billerName !== filters.billerName)) return false;
  if (filters.dspNetwork && (c.dspName || '') !== filters.dspNetwork) return false;
  if (filters.operatorId && (!meta || String(meta.operatorId) !== String(filters.operatorId))) return false;
  if (filters.serviceName) {
    const product = c.productname || '';
    if (product !== filters.serviceName && meta?.serviceName !== filters.serviceName) return false;
  }
  if (filters.campaignName && (c.productname || '') !== filters.campaignName) return false;
  return true;
}

export function passesBillingFilters(r, filters) {
  if (filters.dspNetwork) return false;
  if (filters.campaignName) return false;
  if (filters.billerName && r.billerName !== filters.billerName) return false;
  if (filters.operatorId && String(r.operatorId) !== String(filters.operatorId)) return false;
  if (filters.serviceName && r.serviceName !== filters.serviceName) return false;
  return true;
}

export async function updateCutValue(campaignId, links, cutValue) {
  const res = await fetch(`${POSTBACK_URL}/updateCut`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      campaignId,
      links,
      cut: parseInt(cutValue, 10),
    }),
  });
  if (!res.ok) throw new Error(`Failed to update CUT (${res.status})`);
  return res.json();
}

/** Coerce a table value to a number for Excel export (SUM-friendly). */
export function excelNum(val) {
  if (val == null || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return Number.isFinite(n) ? n : '';
}

/** Apply Excel number format to columns matched by header label. */
export function applySheetNumberFormats(ws, XLSX, numericHeaders, format = '#,##0.00') {
  if (!ws?.['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  const headerSet = new Set(numericHeaders);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (!headerCell || !headerSet.has(String(headerCell.v))) continue;
    for (let r = range.s.r + 1; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') {
        cell.t = 'n';
        cell.z = format;
      }
    }
  }
}
