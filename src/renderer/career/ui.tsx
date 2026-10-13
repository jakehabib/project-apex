import type { ReactNode } from 'react';

export const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
export const usdK = (n: number) => (Math.abs(n) >= 1e6 ? `${n < 0 ? '−' : ''}$${(Math.abs(n) / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e4 ? `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n) / 1e3)}k` : usd(n));

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-h">
          <h3>{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="page-h">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="display">{title}</h1>
      </div>
      {children && <div className="page-h-x">{children}</div>}
    </header>
  );
}

/** OVR chip coloured by tier. */
export function Ovr({ v }: { v: number }) {
  const cls = v >= 88 ? 'o-elite' : v >= 82 ? 'o-star' : v >= 75 ? 'o-pro' : v >= 68 ? 'o-semi' : 'o-low';
  return <span className={`ovr ${cls} mono`}>{v}</span>;
}

export function Bar({ v, max = 100 }: { v: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  const cls = v >= 85 ? 'b-hi' : v >= 70 ? 'b-mid' : 'b-lo';
  return (
    <span className="attr-bar">
      <i className={cls} style={{ width: `${pct}%` }} />
    </span>
  );
}
