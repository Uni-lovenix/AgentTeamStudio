import { List } from 'lucide-react';
import { TeamConfig } from '../../shared/types';

interface GenerationLogProps {
  team: TeamConfig | null;
  busy: boolean;
}

export function GenerationLog({ team, busy }: GenerationLogProps) {
  const entries = team?.generationLog ?? [];

  return (
    <section className="generation-log">
      <div className="section-title">
        <List size={18} aria-hidden="true" />
        <div>
          <span className="eyebrow">决策过程</span>
          <h2>实际生成过程</h2>
        </div>
        {busy && <span className="log-status">生成中</span>}
      </div>
      {!team ? (
        <div className="empty-note">生成团队后，这里会显示角色与职责的决策过程。</div>
      ) : entries.length === 0 ? (
        <div className="empty-note">当前草稿没有生成日志。</div>
      ) : (
        <ol className="generation-log-list">
          {entries.map((entry, index) => (
            <li key={`${entry.step}-${index}`}>
              <div className="log-arrow">{index === entries.length - 1 ? '✓' : '→'}</div>
              <div className="log-content">
                <p className="log-detail">{entry.detail}</p>
                {entry.evidence && (
                  <div className="log-evidence">
                    依据：<code>{entry.evidence}</code>
                  </div>
                )}
                {entry.role && (
                  <div className="log-role">
                    角色：<strong>{entry.role}</strong>
                  </div>
                )}
                {entry.outcome && <div className="log-outcome">{entry.outcome}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
