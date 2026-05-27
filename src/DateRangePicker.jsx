import { useState, useRef, useEffect } from 'react';
import {
  format, addMonths, subMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isWithinInterval, isBefore,
  startOfDay, endOfDay, subDays,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react';

const PRESETS = [
  { label: 'Today',        get: () => ({ s: startOfDay(new Date()), e: endOfDay(new Date()) }) },
  { label: 'Yesterday',    get: () => { const d = subDays(new Date(),1); return { s: startOfDay(d), e: endOfDay(d) }; } },
  { label: 'Last 7 Days',  get: () => ({ s: startOfDay(subDays(new Date(),6)), e: endOfDay(new Date()) }) },
  { label: 'Last 30 Days', get: () => ({ s: startOfDay(subDays(new Date(),29)), e: endOfDay(new Date()) }) },
  { label: 'This Month',   get: () => ({ s: startOfMonth(new Date()), e: endOfMonth(new Date()) }) },
  { label: 'Last Month',   get: () => { const d = subMonths(new Date(),1); return { s: startOfMonth(d), e: endOfMonth(d) }; } },
  { label: 'Custom Range', get: () => null },
];

const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function CalGrid({ month, sel, hover, onDay, onHover }) {
  const first = startOfMonth(month);
  const days  = eachDayOfInterval({ start: first, end: endOfMonth(month) });
  const pad   = first.getDay(); // 0=Sun

  const inRange = (d) => {
    if (sel.s && sel.e) return isWithinInterval(d, { start: startOfDay(sel.s), end: endOfDay(sel.e) });
    if (sel.s && hover && !sel.e) {
      const lo = isBefore(sel.s, hover) ? sel.s : hover;
      const hi = isBefore(sel.s, hover) ? hover : sel.s;
      return isWithinInterval(d, { start: startOfDay(lo), end: endOfDay(hi) });
    }
    return false;
  };

  return (
    <div className="drp-cal">
      <div className="drp-cal-title">{format(month, 'MMMM yyyy')}</div>
      <div className="drp-cal-grid">
        {DAYS.map(d => <div key={d} className="drp-dow">{d}</div>)}
        {Array(pad).fill(null).map((_,i) => <div key={`p${i}`} />)}
        {days.map(day => {
          const isS   = sel.s && isSameDay(day, sel.s);
          const isE   = sel.e && isSameDay(day, sel.e);
          const range = inRange(day);
          return (
            <div
              key={day.toISOString()}
              className={[
                'drp-day',
                range ? 'in-range' : '',
                isS   ? 'edge start' : '',
                isE   ? 'edge end'   : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onDay(day)}
              onMouseEnter={() => onHover(day)}
            >
              <span>{format(day,'d')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DateRangePicker({ value, onChange }) {
  const [open,    setOpen]    = useState(false);
  const [sel,     setSel]     = useState({ s: value?.s || null, e: value?.e || null });
  const [picking, setPicking] = useState(null); // first click stored here
  const [hover,   setHover]   = useState(null);
  const [leftM,   setLeftM]   = useState(value?.s ? startOfMonth(value.s) : startOfMonth(subDays(new Date(),30)));
  const [rightM,  setRightM]  = useState(value?.e ? startOfMonth(value.e) : startOfMonth(new Date()));
  const [preset,  setPreset]  = useState('Last 30 Days');
  const [startIn, setStartIn] = useState(value?.s ? format(value.s,'yyyy-MM-dd') : '');
  const [endIn,   setEndIn]   = useState(value?.e ? format(value.e,'yyyy-MM-dd') : '');
  const wrapRef = useRef();

  // outside click
  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const applyPreset = (p) => {
    setPreset(p.label);
    if (p.label === 'Custom Range') return;
    const r = p.get();
    setSel({ s: r.s, e: r.e });
    setPicking(null);
    setStartIn(format(r.s,'yyyy-MM-dd'));
    setEndIn(format(r.e,'yyyy-MM-dd'));
    setLeftM(startOfMonth(r.s));
    const rm = startOfMonth(r.e);
    setRightM(rm > startOfMonth(r.s) ? rm : addMonths(startOfMonth(r.s),1));
  };

  const handleDay = (day) => {
    setPreset('Custom Range');
    if (!picking) {
      setPicking(day);
      setSel({ s: day, e: null });
      setStartIn(format(day,'yyyy-MM-dd'));
      setEndIn('');
    } else {
      const lo = isBefore(picking, day) ? picking : day;
      const hi = isBefore(picking, day) ? day : picking;
      setSel({ s: lo, e: hi });
      setPicking(null);
      setStartIn(format(lo,'yyyy-MM-dd'));
      setEndIn(format(hi,'yyyy-MM-dd'));
    }
  };

  const handleApply = () => {
    if (sel.s && sel.e) { onChange(sel); setOpen(false); }
  };

  const handleCancel = () => {
    setSel({ s: value?.s || null, e: value?.e || null });
    setOpen(false);
  };

  const prevMonths = () => { setLeftM(p => subMonths(p,1)); setRightM(p => subMonths(p,1)); };
  const nextMonths = () => { setLeftM(p => addMonths(p,1)); setRightM(p => addMonths(p,1)); };

  const displayText = sel.s && sel.e
    ? `${format(sel.s,'MMM dd, yyyy')}  →  ${format(sel.e,'MMM dd, yyyy')}`
    : 'Select date range';

  return (
    <div className="drp-wrap" ref={wrapRef}>
      {/* Trigger */}
      <div className={`drp-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <Calendar size={15} className="drp-trigger-icon" />
        <span className={sel.s ? 'drp-trigger-val' : 'drp-trigger-ph'}>{displayText}</span>
        {open
          ? <X size={14} className="drp-trigger-arrow" onClick={e => { e.stopPropagation(); setOpen(false); }} />
          : <ChevronDown size={14} className="drp-trigger-arrow" />
        }
      </div>

      {/* Popup */}
      {open && (
        <div className="drp-popup">
          {/* Sidebar */}
          <div className="drp-sidebar">
            {PRESETS.map(p => (
              <button
                key={p.label}
                className={`drp-preset-btn ${preset === p.label ? 'active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Main */}
          <div className="drp-main">
            {/* Top date inputs */}
            <div className="drp-top-inputs">
              <div className="drp-input-box">
                <Calendar size={13} className="drp-input-icon" />
                <input
                  className="drp-input"
                  type="date"
                  value={startIn}
                  onChange={e => setStartIn(e.target.value)}
                  placeholder="Start date"
                />
              </div>
              <span className="drp-input-sep">→</span>
              <div className="drp-input-box">
                <Calendar size={13} className="drp-input-icon" />
                <input
                  className="drp-input"
                  type="date"
                  value={endIn}
                  onChange={e => setEndIn(e.target.value)}
                  placeholder="End date"
                />
              </div>
            </div>

            {/* Calendars */}
            <div className="drp-cals-row">
              <button className="drp-nav-btn" onClick={prevMonths}><ChevronLeft size={15}/></button>
              <CalGrid month={leftM}  sel={sel} hover={hover} onDay={handleDay} onHover={setHover} />
              <div className="drp-cals-divider" />
              <CalGrid month={rightM} sel={sel} hover={hover} onDay={handleDay} onHover={setHover} />
              <button className="drp-nav-btn" onClick={nextMonths}><ChevronRight size={15}/></button>
            </div>

            {/* Footer */}
            <div className="drp-footer">
              <span className="drp-footer-range">
                {sel.s ? format(sel.s,'MMM dd, yyyy') : '—'}
                {' → '}
                {sel.e ? format(sel.e,'MMM dd, yyyy') : '—'}
              </span>
              <div className="drp-footer-btns">
                <button className="drp-btn-cancel" onClick={handleCancel}>Cancel</button>
                <button className="drp-btn-apply" onClick={handleApply} disabled={!sel.s || !sel.e}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
