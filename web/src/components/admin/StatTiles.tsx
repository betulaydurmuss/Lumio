import { useLocale } from '../../api/catalog.js';
import { formatCount } from '../../lib/format.js';

/** The stat cards from the design system: a big number and what it counts. */
export function StatTiles({ items }: { items: { label: string; value: number }[] }) {
  const locale = useLocale();
  return (
    <div className="stats">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <div className="n">{formatCount(item.value, locale)}</div>
          <div className="l">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function StatTilesSkeleton({ count }: { count: number }) {
  return (
    <div className="stats" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="stat skeleton" style={{ height: 92 }} />
      ))}
    </div>
  );
}
