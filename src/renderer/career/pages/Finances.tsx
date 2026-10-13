import { FinancePanel } from '../../screens/WorldHub';
import '../../screens/world.css';
import { useCareer } from '../store';
import { PageHead } from '../ui';

export function Finances() {
  const v = useCareer((s) => s.view)!;
  return (
    <div>
      <PageHead eyebrow="Club ledger" title="Finances" />
      <div className="fin-wrap"><FinancePanel f={v.finance} /></div>
    </div>
  );
}
