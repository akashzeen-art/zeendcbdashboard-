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

/** CR % = (conversions ÷ clicks) × 100 */
export function calcCR(conv, clicks) {
  return clicks > 0 ? ((conv / clicks) * 100).toFixed(2) : '0.00';
}

/** STP CR % = (STP ÷ clicks) × 100 */
export function calcStpCR(stp, clicks) {
  return clicks > 0 ? ((stp / clicks) * 100).toFixed(2) : '0.00';
}

export const HOUR_SLOTS = Array.from({ length: 24 }, (_, i) => ({
  slot:  `${i}-${i + 1}`,
  index: i,
}));

/** Map hourly campaign links/product to billing aggregator + operator. */
export function billerFromHourly(c) {
  const links   = (c.links || '').toLowerCase();
  const product = (c.productname || '').toLowerCase().trim();
  if (links.includes('/briccs/') || links.includes('briccslp') || product.includes('bric')) {
    return { billerName: 'BRICCS', operatorId: 2135, operatorName: 'NG_MTN (2135)', serviceName: 'Poker' };
  }
  if (links.includes('xceed') || product === 'xceed' || product.includes('xceed')) {
    return { billerName: 'XCEED', operatorId: 9039, operatorName: 'SD_MTN (9039)', serviceName: 'AIGamopedia' };
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
