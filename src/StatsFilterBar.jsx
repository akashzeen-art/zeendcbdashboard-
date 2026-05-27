import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Calendar, RotateCcw, Download, BarChart2, X } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import DateRangePicker from './DateRangePicker';

const ADVERTISERS = ['All Advertisers', 'AIGamopedia', 'Zeend VAS', 'MTN Services', 'XCEED Media'];
const CAMPAIGNS   = ['All Campaigns', 'Campaign Alpha', 'Campaign Beta', 'Summer Push', 'Retention Drive'];
const PUBLISHERS  = ['All Publishers', 'Publisher A', 'Publisher B', 'Publisher C', 'Direct'];
const BILLERS     = ['All Billers', 'XCEED', 'MTN', 'Zain', 'Sudani'];

function SelectDropdown({ label, icon: Icon, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="sf-field" ref={ref}>
      <label className="sf-label">{label}</label>
      <div className={`sf-select ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        {Icon && <Icon size={15} className="sf-select-icon" />}
        <span className={value === options[0] ? 'sf-placeholder' : 'sf-value'}>{value}</span>
        <ChevronDown size={15} className={`sf-chevron ${open ? 'rotated' : ''}`} />
      </div>
      {open && (
        <div className="sf-dropdown">
          {options.map(opt => (
            <div key={opt} className={`sf-option ${value === opt ? 'active' : ''}`} onClick={() => { onChange(opt); setOpen(false); }}>
              {value === opt && <span className="sf-option-check">✓</span>}
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const defaultRange = {
  start: startOfDay(subDays(new Date(), 29)),
  end:   endOfDay(new Date()),
};

export default function StatsFilterBar({ onApply }) {
  const [advertiser, setAdvertiser] = useState('All Advertisers');
  const [campaign,   setCampaign]   = useState('All Campaigns');
  const [publisher,  setPublisher]  = useState('All Publishers');
  const [biller,     setBiller]     = useState('All Billers');
  const [dateRange,  setDateRange]  = useState(defaultRange);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef();

  useEffect(() => {
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleReset = () => {
    setAdvertiser('All Advertisers');
    setCampaign('All Campaigns');
    setPublisher('All Publishers');
    setBiller('All Billers');
    setDateRange(defaultRange);
  };

  const handleApply = () => {
    onApply({ advertiser, campaign, publisher, biller, dateRange });
  };

  const handleExport = () => {
    onApply({ advertiser, campaign, publisher, biller, dateRange, export: true });
  };

  return (
    <div className="sf-panel">
      <div className="sf-panel-header">
        <div className="sf-panel-title">
          <div className="sf-panel-icon"><BarChart2 size={16} /></div>
          Select Filters
        </div>
        <span className="sf-panel-sub">Refine your analytics view</span>
      </div>

      <div className="sf-body">
        {/* Row 1 */}
        <div className="sf-row">
          <SelectDropdown label="Advertiser Name" options={ADVERTISERS} value={advertiser} onChange={setAdvertiser} />
          <SelectDropdown label="Campaign Name"   options={CAMPAIGNS}   value={campaign}   onChange={setCampaign} />
          <SelectDropdown label="Biller / Aggregator" options={BILLERS} value={biller}     onChange={setBiller} />
          <SelectDropdown label="Publisher Name"  options={PUBLISHERS}  value={publisher}  onChange={setPublisher} />
        </div>

        {/* Date Row */}
        <div className="sf-row sf-row-date">
          <div className="sf-field sf-field-date" ref={pickerRef}>
            <label className="sf-label">Date Period</label>
            <div className={`sf-select ${pickerOpen ? 'open' : ''}`} onClick={() => setPickerOpen(o => !o)}>
              <Calendar size={15} className="sf-select-icon" />
              <span className="sf-value">
                {format(dateRange.start, 'MMM dd, yyyy')} → {format(dateRange.end, 'MMM dd, yyyy')}
              </span>
              {pickerOpen
                ? <X size={14} className="sf-chevron" onClick={(e) => { e.stopPropagation(); setPickerOpen(false); }} />
                : <ChevronDown size={15} className="sf-chevron" />
              }
            </div>
            {pickerOpen && (
              <div className="drp-wrapper">
                <DateRangePicker
                  value={dateRange}
                  onChange={(r) => { setDateRange(r); setPickerOpen(false); }}
                  onClose={() => setPickerOpen(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sf-footer">
        <div className="sf-footer-left">
          <button className="sf-btn sf-btn-reset" onClick={handleReset}>
            <RotateCcw size={14} /> Reset Filters
          </button>
          <button className="sf-btn sf-btn-export" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>
        <button className="sf-btn sf-btn-primary" onClick={handleApply}>
          <BarChart2 size={14} /> Get Statistics
        </button>
      </div>
    </div>
  );
}
