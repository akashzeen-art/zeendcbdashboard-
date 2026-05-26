export default function SkeletonRows({ cols, rows = 8 }) {
  const widths = ['60%', '45%', '55%', '35%', '50%', '40%', '65%', '30%', '48%', '52%', '38%', '42%', '36%', '58%'];
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j} style={{ padding: '.75rem 1rem' }}>
          <div className="skeleton-cell" style={{ width: widths[(i + j) % widths.length] }} />
        </td>
      ))}
    </tr>
  ));
}
