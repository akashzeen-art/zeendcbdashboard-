import { useState, useEffect } from 'react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import StatsTable from './StatsTable';
import './Stats.css';

// Generate realistic mock rows per day in range
function generateMockData(filters) {
  const start = filters?.startDate ? parseISO(filters.startDate) : new Date(Date.now() - 30 * 86400000);
  const end   = filters?.endDate   ? parseISO(filters.endDate)   : new Date();
  const days  = eachDayOfInterval({ start, end });
  const networks = ['MTN', 'Zain', 'Sudani', 'Airtel'];

  return days.map(day => {
    const clicks      = Math.floor(Math.random() * 8000) + 500;
    const sendPin     = Math.floor(clicks * (0.3 + Math.random() * 0.3));
    const uniqSendPin = Math.floor(sendPin * 0.85);
    const verPin      = Math.floor(sendPin * (0.4 + Math.random() * 0.3));
    const uniqVerPin  = Math.floor(verPin * 0.9);
    const sucesVerPin = Math.floor(verPin * (0.6 + Math.random() * 0.3));
    const actCount    = Math.floor(sucesVerPin * (0.5 + Math.random() * 0.4));
    const actRev      = actCount * (900 + Math.floor(Math.random() * 600));
    const park        = Math.floor(actCount * 0.05);
    const dct         = Math.floor(actCount * 0.03);
    const sdd         = Math.floor(actCount * 0.02);
    const renewCount  = Math.floor(Math.random() * 300) + 50;
    const renewRev    = renewCount * (900 + Math.floor(Math.random() * 300));
    const totalRevNum = actCount * 1050 + renewCount * 1000;
    const campCr      = ((actCount / clicks) * 100).toFixed(2);
    const pubCr       = ((actCount / Math.max(sendPin, 1)) * 100).toFixed(2);

    return {
      date:         format(day, 'yyyy-MM-dd'),
      clicks,
      network:      filters?.operatorId
                      ? (filters.operatorId === '9039' ? 'MTN' : filters.operatorId === '2135' ? 'NG_MTN' : networks[Math.floor(Math.random() * networks.length)])
                      : networks[Math.floor(Math.random() * networks.length)],
      sendPin,      uniqSendPin,
      verPin,       uniqVerPin,   sucesVerPin,
      actCount,
      actRev:       actRev.toLocaleString(),
      park,         dct,          sdd,
      renewCount,
      renewRev:     renewRev.toLocaleString(),
      totalRev:     totalRevNum.toLocaleString(),
      totalRevUsd:  (totalRevNum / 550).toFixed(2),
      sentToPub:    (totalRevNum * 0.15).toLocaleString(),
      spend:        (totalRevNum * 0.3).toLocaleString(),
      campCr,       pubCr,
    };
  });
}

const PAGE_SIZE = 15;

export default function StatsPage({ filters }) {
  const [allData, setAllData] = useState([]);
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);

  // Auto-load whenever filters change
  useEffect(() => {
    setLoading(true);
    setPage(1);
    setTimeout(() => {
      const rows = generateMockData(filters);
      setAllData(rows);
      setTotal(rows.length);
      setData(rows.slice(0, PAGE_SIZE));
      setLoading(false);
    }, 400);
  }, [filters]);

  const handlePageChange = (p) => {
    setPage(p);
    setData(allData.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE));
  };

  const handleExport = () => {
    if (!allData.length) return;
    const headers = ['Date','Clicks','Network','Send Pin','Uniq Send Pin','Ver Pin','Uniq Ver Pin','Suces Ver Pin','ACT Count','Act Rev','PARK','DCT','SDD','Renew Count','Renew Rev','Total Rev','Total Rev USD','Sent To Pub','Spend','Camp CR','Pub CR'];
    const keys    = ['date','clicks','network','sendPin','uniqSendPin','verPin','uniqVerPin','sucesVerPin','actCount','actRev','park','dct','sdd','renewCount','renewRev','totalRev','totalRevUsd','sentToPub','spend','campCr','pubCr'];
    const csv = [headers.join(','), ...allData.map(r => keys.map(k => r[k] ?? '').join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'analytics_stats.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stats-page">
      <StatsTable
        data={data}
        loading={loading}
        total={total}
        page={page}
        onPageChange={handlePageChange}
        onExport={handleExport}
      />
    </div>
  );
}
