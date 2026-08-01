import { Plus, Trash2 } from 'lucide-react';
import { AgentRole, TeamConfig } from '../../shared/types';

interface TeamPreviewProps {
  team: TeamConfig | null;
  onChange: (team: TeamConfig) => void;
}

function lines(value: string[]): string {
  return value.join('\n');
}

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitComma(value: string): string[] {
  return value
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TeamPreview({ team, onChange }: TeamPreviewProps) {
  if (!team) {
    return (
      <section className="panel empty-team">
        <div className="section-title">
          <span className="eyebrow">团队预览</span>
          <h2>等待生成</h2>
        </div>
        <div className="empty-note">生成团队后，可在此调整角色、流程和约定。</div>
      </section>
    );
  }

  const updateAgent = (index: number, patch: Partial<AgentRole>): void => {
    const agents = team.agents.map((agent, agentIndex) =>
      agentIndex === index ? { ...agent, ...patch } : agent
    );
    onChange({ ...team, agents });
  };

  const addAgent = (): void => {
    const agent: AgentRole = {
      id: `role-${Date.now()}`,
      name: '新角色',
      mission: '负责补充当前项目的协作能力。',
      responsibilities: [],
      skills: [],
      tools: [],
      deliverables: [],
      dependsOn: [],
      notifies: [],
    };
    onChange({ ...team, agents: [...team.agents, agent] });
  };

  const removeAgent = (index: number): void => {
    onChange({
      ...team,
      agents: team.agents.filter((_, agentIndex) => agentIndex !== index),
    });
  };

  const updateStep = (index: number, patch: Partial<TeamConfig['workflow'][number]>): void => {
    const workflow = team.workflow.map((step, stepIndex) =>
      stepIndex === index ? { ...step, ...patch } : step
    );
    onChange({ ...team, workflow });
  };

  return (
    <section className="team-preview">
      <div className="section-title">
        <span className="eyebrow">团队预览</span>
        <h2>{team.projectName}</h2>
        <span className={`source-badge ${team.generatedBy}`}>
          {team.generatedBy === 'llm' ? 'LLM' : '需求驱动'}
        </span>
      </div>

      <div className="role-list">
        {team.agents.map((agent, index) => (
          <div className="role-card" key={agent.id}>
            <div className="role-card-head">
              <input
                className="role-name-input"
                value={agent.name}
                onChange={(event) => updateAgent(index, { name: event.target.value })}
                aria-label="角色名称"
              />
              <button
                className="icon-button danger"
                type="button"
                onClick={() => removeAgent(index)}
                title="移除角色"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <label className="field">
              <span>使命</span>
              <input
                value={agent.mission}
                onChange={(event) => updateAgent(index, { mission: event.target.value })}
              />
            </label>
            <label className="field">
              <span>职责（每行一项）</span>
              <textarea
                rows={3}
                value={lines(agent.responsibilities)}
                onChange={(event) =>
                  updateAgent(index, { responsibilities: splitLines(event.target.value) })
                }
              />
            </label>
            <div className="inline-fields">
              <label className="field">
                <span>技能</span>
                <input
                  value={agent.skills.join('、')}
                  onChange={(event) => updateAgent(index, { skills: splitComma(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>工具</span>
                <input
                  value={agent.tools.join('、')}
                  onChange={(event) => updateAgent(index, { tools: splitComma(event.target.value) })}
                />
              </label>
            </div>
            <label className="field">
              <span>交付物（每行一项）</span>
              <textarea
                rows={2}
                value={lines(agent.deliverables)}
                onChange={(event) =>
                  updateAgent(index, { deliverables: splitLines(event.target.value) })
                }
              />
            </label>
            <div className="inline-fields">
              <label className="field">
                <span>依赖角色</span>
                <input
                  value={agent.dependsOn.join('、')}
                  onChange={(event) =>
                    updateAgent(index, { dependsOn: splitComma(event.target.value) })
                  }
                />
              </label>
              <label className="field">
                <span>通知角色</span>
                <input
                  value={agent.notifies.join('、')}
                  onChange={(event) =>
                    updateAgent(index, { notifies: splitComma(event.target.value) })
                  }
                />
              </label>
            </div>
          </div>
        ))}
        <button className="secondary-button add-role" type="button" onClick={addAgent}>
          <Plus size={16} aria-hidden="true" />
          添加角色
        </button>
      </div>

      <div className="workflow-editor">
        <div className="subheading">协作流程</div>
        {team.workflow.map((step, index) => (
          <div className="workflow-row" key={step.id}>
            <input
              value={step.name}
              onChange={(event) => updateStep(index, { name: event.target.value })}
              aria-label="流程名称"
            />
            <input
              value={step.description}
              onChange={(event) => updateStep(index, { description: event.target.value })}
              aria-label="流程说明"
            />
            <select
              value={step.ownerRoleId}
              onChange={(event) => updateStep(index, { ownerRoleId: event.target.value })}
              aria-label="负责人"
            >
              {team.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="conventions-editor">
        <div className="subheading">工程约定</div>
        {(
          [
            ['branch', '分支'],
            ['commits', '提交'],
            ['pullRequests', 'Pull Request'],
            ['testing', '测试'],
            ['documentation', '文档'],
          ] as const
        ).map(([key, label]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <textarea
              rows={2}
              value={team.conventions[key]}
              onChange={(event) =>
                onChange({
                  ...team,
                  conventions: { ...team.conventions, [key]: event.target.value },
                })
              }
            />
          </label>
        ))}
      </div>
    </section>
  );
}
