import { AgentRole, IterationStatus, ProcessManagement } from '../../shared/types';

interface ProcessManagementEditorProps {
  process: ProcessManagement;
  agents: AgentRole[];
  onChange: (process: ProcessManagement) => void;
}

const STATUS_LABELS: Record<IterationStatus, string> = {
  planned: '计划中',
  active: '进行中',
  completed: '已完成',
  blocked: '阻塞',
};

function lines(value: string[]): string {
  return value.join('\n');
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProcessManagementEditor({
  process,
  agents,
  onChange,
}: ProcessManagementEditorProps) {
  const updatePhase = (
    phaseId: ProcessManagement['phases'][number]['id'],
    patch: Partial<ProcessManagement['phases'][number]>
  ): void => {
    onChange({
      ...process,
      phases: process.phases.map((phase) =>
        phase.id === phaseId ? { ...phase, ...patch } : phase
      ),
    });
  };

  const updateIteration = (
    iterationId: string,
    patch: Partial<ProcessManagement['iterations'][number]>
  ): void => {
    const nextIterations = process.iterations.map((iteration) =>
      iteration.id === iterationId ? { ...iteration, ...patch } : iteration
    );
    onChange({
      ...process,
      iterations: nextIterations,
      phases: process.phases.map((phase) => ({
        ...phase,
        iterationIds: nextIterations
          .filter((iteration) => iteration.phaseId === phase.id)
          .map((iteration) => iteration.id),
      })),
    });
  };

  return (
    <div className="process-management-editor">
      <div className="subheading">RUP 过程管理</div>
      <div className="rup-phase-grid">
        {process.phases.map((phase) => (
          <div className="rup-phase-card" key={phase.id}>
            <div className="rup-phase-head">
              <strong>{phase.name}阶段</strong>
              <code>{phase.id}</code>
            </div>
            <label className="field">
              <span>阶段目的</span>
              <textarea
                rows={2}
                value={phase.purpose}
                onChange={(event) => updatePhase(phase.id, { purpose: event.target.value })}
              />
            </label>
            <label className="field">
              <span>里程碑</span>
              <input
                value={phase.milestone}
                onChange={(event) => updatePhase(phase.id, { milestone: event.target.value })}
              />
            </label>
            <label className="field">
              <span>目标（每行一项）</span>
              <textarea
                rows={2}
                value={lines(phase.goals)}
                onChange={(event) => updatePhase(phase.id, { goals: splitLines(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>交付物（每行一项）</span>
              <textarea
                rows={2}
                value={lines(phase.deliverables)}
                onChange={(event) =>
                  updatePhase(phase.id, { deliverables: splitLines(event.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>退出标准（每行一项）</span>
              <textarea
                rows={2}
                value={lines(phase.exitCriteria)}
                onChange={(event) =>
                  updatePhase(phase.id, { exitCriteria: splitLines(event.target.value) })
                }
              />
            </label>
          </div>
        ))}
      </div>

      <div className="rup-iteration-list">
        {process.iterations.map((iteration) => {
          const phase = process.phases.find((item) => item.id === iteration.phaseId);
          return (
            <details className="rup-iteration-row" key={iteration.id}>
              <summary>
                <strong>{iteration.name}</strong>
                <span>{phase?.name ?? iteration.phaseId}</span>
                <span className={`iteration-status ${iteration.status}`}>
                  {STATUS_LABELS[iteration.status]}
                </span>
              </summary>
              <div className="rup-iteration-fields">
                <label className="field">
                  <span>迭代名称</span>
                  <input
                    value={iteration.name}
                    onChange={(event) => updateIteration(iteration.id, { name: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span>所属阶段</span>
                  <select
                    value={iteration.phaseId}
                    onChange={(event) =>
                      updateIteration(iteration.id, {
                        phaseId: event.target.value as ProcessManagement['iterations'][number]['phaseId'],
                      })
                    }
                  >
                    {process.phases.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>状态</span>
                  <select
                    value={iteration.status}
                    onChange={(event) =>
                      updateIteration(iteration.id, {
                        status: event.target.value as IterationStatus,
                      })
                    }
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>迭代目标</span>
                  <textarea
                    rows={2}
                    value={iteration.objective}
                    onChange={(event) =>
                      updateIteration(iteration.id, { objective: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>范围（每行一项）</span>
                  <textarea
                    rows={2}
                    value={lines(iteration.scope)}
                    onChange={(event) =>
                      updateIteration(iteration.id, { scope: splitLines(event.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>计划（每行一项）</span>
                  <textarea
                    rows={2}
                    value={lines(iteration.plan)}
                    onChange={(event) =>
                      updateIteration(iteration.id, { plan: splitLines(event.target.value) })
                    }
                  />
                </label>
                <label className="field">
                  <span>退出标准（每行一项）</span>
                  <textarea
                    rows={2}
                    value={lines(iteration.exitCriteria)}
                    onChange={(event) =>
                      updateIteration(iteration.id, {
                        exitCriteria: splitLines(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>交付物（每行一项）</span>
                  <textarea
                    rows={2}
                    value={lines(iteration.deliverables)}
                    onChange={(event) =>
                      updateIteration(iteration.id, {
                        deliverables: splitLines(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="field">
                  <span>负责人</span>
                  <select
                    value={iteration.ownerRoleId}
                    onChange={(event) =>
                      updateIteration(iteration.id, { ownerRoleId: event.target.value })
                    }
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>反馈目标</span>
                  <select
                    value={iteration.feedbackTargetRoleId}
                    onChange={(event) =>
                      updateIteration(iteration.id, {
                        feedbackTargetRoleId: event.target.value,
                      })
                    }
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
