import { Save, Sparkles } from 'lucide-react';

interface RequirementEditorProps {
  projectName: string;
  requirement: string;
  techStackHints: string;
  useLlm: boolean;
  llmEnabled: boolean;
  busy: boolean;
  onChangeProjectName: (value: string) => void;
  onChangeRequirement: (value: string) => void;
  onChangeTechStackHints: (value: string) => void;
  onToggleLlm: () => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
}

export function RequirementEditor({
  projectName,
  requirement,
  techStackHints,
  useLlm,
  llmEnabled,
  busy,
  onChangeProjectName,
  onChangeRequirement,
  onChangeTechStackHints,
  onToggleLlm,
  onGenerate,
  onSaveDraft,
}: RequirementEditorProps) {
  return (
    <section className="requirement-editor">
      <div className="section-title">
        <span className="eyebrow">项目输入</span>
        <h2>需求与团队</h2>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>项目名称</span>
          <input
            value={projectName}
            onChange={(event) => onChangeProjectName(event.target.value)}
            placeholder="例如：企业知识库"
          />
        </label>
        <label className="field">
          <span>技术栈提示</span>
          <input
            value={techStackHints}
            onChange={(event) => onChangeTechStackHints(event.target.value)}
            placeholder="React, Electron, TypeScript"
          />
        </label>
        <label className="field field-wide">
          <span>需求描述</span>
          <textarea
            value={requirement}
            onChange={(event) => onChangeRequirement(event.target.value)}
            placeholder="描述项目的目标、主要功能、用户角色和约束条件"
            rows={7}
          />
        </label>
      </div>
      <div className="editor-actions">
        <label className="toggle">
          <input type="checkbox" checked={useLlm} disabled={!llmEnabled} onChange={onToggleLlm} />
          <span>使用 LLM 生成</span>
        </label>
        {!llmEnabled && <span className="muted-note">LLM 未启用</span>}
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={onSaveDraft} disabled={busy}>
            <Save size={16} aria-hidden="true" />
            保存草稿
          </button>
          <button className="primary-button" type="button" onClick={onGenerate} disabled={busy}>
            <Sparkles size={16} aria-hidden="true" />
            {busy ? '生成中' : '生成团队'}
          </button>
        </div>
      </div>
    </section>
  );
}
