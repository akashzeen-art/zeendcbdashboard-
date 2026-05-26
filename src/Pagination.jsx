export default function Pagination({ page, total, size, onChange }) {
  const totalPages = Math.ceil(total / size) || 1;
  const start = (page - 1) * size + 1;
  const end = Math.min(page * size, total);

  const getPages = () => {
    const pages = [];
    const delta = 2;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing <strong>{total === 0 ? 0 : start}–{end}</strong> of <strong>{total}</strong> records
      </div>
      {totalPages > 1 && (
        <div className="pagination-controls">
          <button className="page-btn" onClick={() => onChange(1)} disabled={page === 1} title="First">«</button>
          <button className="page-btn" onClick={() => onChange(page - 1)} disabled={page === 1} title="Previous">‹</button>
          {getPages().map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} style={{ padding: '0 .25rem', color: 'var(--text-light)' }}>…</span>
            ) : (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => onChange(p)}>{p}</button>
            )
          )}
          <button className="page-btn" onClick={() => onChange(page + 1)} disabled={page === totalPages} title="Next">›</button>
          <button className="page-btn" onClick={() => onChange(totalPages)} disabled={page === totalPages} title="Last">»</button>
        </div>
      )}
    </div>
  );
}
