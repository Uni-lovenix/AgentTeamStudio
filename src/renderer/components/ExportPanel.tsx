import { FileDown, FolderOpen } from 'lucide-react';

interface ExportPanelProps {
  targetPath: string;
  hasTeam: boolean;
  busy: boolean;
  onSelectDirectory: () => void;
  onWrite: () => void;
}

export function ExportPanel({
  targetPath,
  hasTeam,
  busy,
  onSelectDirectory,
  onWrite,
}: ExportPanelProps) {
  return (
    <section className="export-panel">
      <div className="section-title">
        <span className="eyebrow">写入项目</span>
        <h2>导出配置</h2>
      </div>
      <button className="secondary-button" type="button" onClick={onSelectDirectory}>
        <FolderOpen size={16} aria-hidden="true" />
        选择项目目录
      </button>
      <code className="path-output">{targetPath || '尚未选择目录'}</code>
      <div className="export-note">AGENTS.md</div>
      <div className="export-note">agents.json</div>
      <button
        className="primary-button export-button"
        type="button"
        disabled={!hasTeam || !targetPath || busy}
        onClick={onWrite}
      >
        <FileDown size={16} aria-hidden="true" />
        写入项目目录
      </button>
    </section>
  );
}
