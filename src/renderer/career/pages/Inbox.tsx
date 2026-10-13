import { formatDate } from '../../../core/world/calendar';
import { useCareer } from '../store';
import { PageHead } from '../ui';

const ICON: Record<string, string> = { match: '⚔', result: '★', invite: '✉', qualifier: '⚑', window: '⇄', contract: '✎', finance: '$', event: '🏆', welcome: '◆' };

export function Inbox() {
  const v = useCareer((s) => s.view)!;
  return (
    <div>
      <PageHead eyebrow="Messages" title="Inbox" />
      <ul className="inbox">
        {v.inbox.map((m, i) => (
          <li key={m.id} className={`ib-${m.kind}`} style={{ animationDelay: `${Math.min(i, 20) * 20}ms` }}>
            <i>{ICON[m.kind] ?? '•'}</i>
            <div>
              <b>{m.title}</b>
              <small className="muted">{formatDate(m.day)}</small>
              <p>{m.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
