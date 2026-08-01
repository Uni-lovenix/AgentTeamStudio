import { AppStatus } from '../../shared/types';

interface StatusBarProps {
  status: AppStatus;
}

export function StatusBar({ status }: StatusBarProps) {
  return (
    <footer className="status-bar">
      <span>项目草稿：{status.projectCount}</span>
      <span>LLM：{status.llmEnabled ? '已启用' : '未启用'}</span>
      <span>密钥：{status.hasApiKey ? '已保存' : '未保存'}</span>
      <span className="status-spacer" />
      <span>{status.lastActivity ? `最近活动：${new Date(status.lastActivity).toLocaleString()}` : '暂无活动'}</span>
    </footer>
  );
}
