import { FolderPlus, Settings, Trash2 } from 'lucide-react';
import { ProjectDraft } from '../../shared/types';

interface SidebarProps {
  projects: ProjectDraft[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  projects,
  activeId,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div>
          <span className="eyebrow">项目</span>
          <h2>团队配置</h2>
        </div>
        <button className="icon-button" type="button" onClick={onOpenSettings} title="设置">
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
      <button className="primary-button sidebar-create" type="button" onClick={onCreate}>
        <FolderPlus size={16} aria-hidden="true" />
        新建项目
      </button>
      <div className="project-list">
        {projects.length === 0 && <div className="empty-note">暂无项目草稿</div>}
        {projects.map((project) => (
          <div
            key={project.id}
            className={`project-row ${activeId === project.id ? 'active' : ''}`}
          >
            <button type="button" className="project-select" onClick={() => onSelect(project.id)}>
              <span className="project-title">{project.projectName}</span>
              <span className="project-time">{new Date(project.updatedAt).toLocaleString()}</span>
            </button>
            <button
              className="row-delete"
              type="button"
              onClick={() => onDelete(project.id)}
              title="删除草稿"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
