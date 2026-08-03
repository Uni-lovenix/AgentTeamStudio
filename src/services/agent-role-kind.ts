import { AgentRoleKind } from '../shared/types';

export const AGENT_ROLE_KIND_VALUES: AgentRoleKind[] = [
  'planner',
  'evaluator',
  'developer',
  'documentation',
  'custom',
];

export const AGENT_ROLE_KIND_LABELS: Record<AgentRoleKind, string> = {
  planner: '规划者',
  evaluator: '评估者',
  developer: '开发者',
  documentation: '文档与交接',
  custom: '自定义',
};

export function isAgentRoleKind(value: unknown): value is AgentRoleKind {
  return (
    typeof value === 'string' &&
    AGENT_ROLE_KIND_VALUES.includes(value as AgentRoleKind)
  );
}

export function inferAgentRoleKind(name: string): AgentRoleKind {
  const normalized = name.trim().toLowerCase();
  if (
    normalized === '规划者' ||
    normalized === 'planner' ||
    normalized.includes('规划')
  ) {
    return 'planner';
  }
  if (
    normalized === '评估者' ||
    normalized === 'evaluator' ||
    normalized.includes('评估')
  ) {
    return 'evaluator';
  }
  if (
    normalized.includes('开发者') ||
    normalized.includes('developer') ||
    normalized.includes('开发')
  ) {
    return 'developer';
  }
  if (
    normalized.includes('文档') ||
    normalized.includes('documentation') ||
    normalized.includes('交接')
  ) {
    return 'documentation';
  }
  return 'custom';
}
