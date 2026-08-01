import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  AppStatus,
  ProjectDraft,
  SettingsSnapshot,
  TeamConfig,
} from '../shared/types';
import { Sidebar } from './components/Sidebar';
import { RequirementEditor } from './components/RequirementEditor';
import { TeamPreview } from './components/TeamPreview';
import { ExportPanel } from './components/ExportPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBar } from './components/StatusBar';

const EMPTY_STATUS: AppStatus = {
  projectCount: 0,
  llmEnabled: false,
  hasApiKey: false,
  lastActivity: '',
};

export function App() {
  const [projects, setProjects] = useState<ProjectDraft[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [requirement, setRequirement] = useState('');
  const [techStackHints, setTechStackHints] = useState('');
  const [generatedTeam, setGeneratedTeam] = useState<TeamConfig | null>(null);
  const [targetPath, setTargetPath] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [useLlm, setUseLlm] = useState(false);
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [status, setStatus] = useState<AppStatus>(EMPTY_STATUS);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    const [projectList, settingsSnapshot, appStatus] = await Promise.all([
      window.agentTeamStudio.projects.list(),
      window.agentTeamStudio.settings.get(),
      window.agentTeamStudio.app.status(),
    ]);
    setProjects(projectList);
    setSettings(settingsSnapshot);
    setStatus(appStatus);
    setUseLlm(settingsSnapshot.llm.enabled);
    if (projectList.length > 0 && !activeId) {
      setActiveId(projectList[0].id);
    }
  }, [activeId]);

  useEffect(() => {
    refresh().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [refresh]);

  useEffect(() => {
    const project = projects.find((item) => item.id === activeId);
    if (project) {
      setProjectName(project.projectName);
      setRequirement(project.requirement);
      setTechStackHints(project.techStackHints);
      setGeneratedTeam(project.team);
      setTargetPath(project.targetPath ?? '');
    }
  }, [activeId, projects]);

  const resetForm = useCallback(() => {
    setProjectName('');
    setRequirement('');
    setTechStackHints('');
    setGeneratedTeam(null);
    setTargetPath('');
    setWarnings([]);
  }, []);

  const createProject = useCallback(async (): Promise<ProjectDraft> => {
    const draft = await window.agentTeamStudio.projects.create(projectName || '未命名项目');
    setProjects((current) => [draft, ...current]);
    setActiveId(draft.id);
    resetForm();
    return draft;
  }, [projectName, resetForm]);

  const handleCreateProject = useCallback(async () => {
    setError('');
    setNotice('');
    try {
      await createProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [createProject]);

  const selectProject = useCallback(
    (id: string) => {
      setActiveId(id);
      setWarnings([]);
      setNotice('');
    },
    []
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!window.confirm('删除该项目草稿？不会修改目标项目目录中的文件。')) return;
      await window.agentTeamStudio.projects.delete(id);
      const next = projects.filter((item) => item.id !== id);
      setProjects(next);
      setActiveId(next[0]?.id ?? null);
      if (!next[0]) resetForm();
    },
    [projects, resetForm]
  );

  const handleDeleteProject = useCallback(
    async (id: string) => {
      setError('');
      setNotice('');
      try {
        await deleteProject(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [deleteProject]
  );

  const buildDraft = useCallback(
    (
      draft: ProjectDraft | null,
      team: TeamConfig | null,
      targetOverride?: string
    ): ProjectDraft => {
      const now = new Date().toISOString();
      const base: ProjectDraft = draft ?? {
        id: `draft-${Date.now()}`,
        projectName: projectName || '未命名项目',
        requirement: '',
        techStackHints: '',
        team: null,
        targetPath: null,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...base,
        projectName: projectName || base.projectName,
        requirement,
        techStackHints,
        team,
        targetPath: targetOverride || targetPath || base.targetPath,
        updatedAt: now,
      };
    },
    [projectName, requirement, targetPath, techStackHints]
  );

  const saveCurrentDraft = useCallback(
    async (team: TeamConfig | null, targetOverride?: string): Promise<ProjectDraft> => {
      const current = projects.find((item) => item.id === activeId) ?? null;
      const draft = buildDraft(current, team, targetOverride);
      const saved = await window.agentTeamStudio.projects.save(draft);
      setProjects((list) => {
        const exists = list.some((item) => item.id === saved.id);
        return exists ? list.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...list];
      });
      setActiveId(saved.id);
      return saved;
    },
    [activeId, buildDraft, projects]
  );

  const handleGenerate = useCallback(async () => {
    setError('');
    setNotice('');
    setWarnings([]);
    setBusy(true);
    try {
      const result = await window.agentTeamStudio.team.generate({
        projectName,
        requirement,
        techStackHints,
        useLlm: useLlm && Boolean(settings?.llm.enabled),
      });
      setGeneratedTeam(result.team);
      setWarnings(result.warnings);
      await saveCurrentDraft(result.team);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    projectName,
    requirement,
    saveCurrentDraft,
    settings?.llm.enabled,
    techStackHints,
    useLlm,
  ]);

  const handleSaveDraft = useCallback(async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await saveCurrentDraft(generatedTeam);
      setNotice('草稿已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [generatedTeam, saveCurrentDraft]);

  const handleSelectDirectory = useCallback(async () => {
    const selected = await window.agentTeamStudio.dialog.selectDirectory();
    if (selected) {
      setTargetPath(selected);
      await saveCurrentDraft(generatedTeam, selected);
    }
  }, [generatedTeam, saveCurrentDraft]);

  const handleWrite = useCallback(async () => {
    const team = generatedTeam;
    if (!team) {
      setError('请先生成团队');
      return;
    }
    if (!targetPath) {
      await handleSelectDirectory();
      return;
    }
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const inspection = await window.agentTeamStudio.team.inspect(targetPath);
      if (!inspection.directoryExists) {
        throw new Error('目标目录不存在');
      }
      if (inspection.existingFiles.length > 0) {
        const confirmed = window.confirm(
          `目标目录已有 ${inspection.existingFiles.join('、')}，是否覆盖？`
        );
        if (!confirmed) return;
      }
      const result = await window.agentTeamStudio.team.write({
        team,
        targetDirectory: targetPath,
        overwrite: inspection.existingFiles.length > 0,
      });
      setNotice(
        `已写入 ${[...result.createdFiles, ...result.overwrittenFiles].join('、')} 到 ${result.targetDirectory}`
      );
      await saveCurrentDraft(team);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [generatedTeam, handleSelectDirectory, saveCurrentDraft, targetPath]);

  const handleSaveSettings = useCallback(
    async (input: {
      llm: SettingsSnapshot['llm'];
      apiKey?: string;
      clearApiKey?: boolean;
    }) => {
      const snapshot = await window.agentTeamStudio.settings.save(input);
      setSettings(snapshot);
      setUseLlm(snapshot.llm.enabled);
      setShowSettings(false);
      setNotice('设置已保存');
      setStatus(await window.agentTeamStudio.app.status());
    },
    []
  );

  const handleTestConnection = useCallback(
    async (llm: SettingsSnapshot['llm'], apiKey?: string) => {
      return window.agentTeamStudio.settings.test({ llm, apiKey });
    },
    []
  );

  const handleReset = useCallback(async () => {
    if (!window.confirm('重置会清除全部本地草稿和设置，且不会修改目标项目目录。继续？')) return;
    await window.agentTeamStudio.app.reset();
    setProjects([]);
    setActiveId(null);
    resetForm();
    await refresh();
    setNotice('应用数据已重置');
  }, [refresh, resetForm]);

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        activeId={activeId}
        onSelect={selectProject}
        onCreate={() => {
          void handleCreateProject();
        }}
        onDelete={(id) => {
          void handleDeleteProject(id);
        }}
        onOpenSettings={() => setShowSettings(true)}
      />
      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Agent Team Studio</span>
            <h1>多智能体协作配置</h1>
          </div>
          <button className="secondary-button" type="button" onClick={handleReset}>
            <RotateCcw size={16} aria-hidden="true" />
            重置
          </button>
        </header>
        {error && (
          <div className="message error">
            <AlertTriangle size={16} aria-hidden="true" />
            {error}
          </div>
        )}
        {notice && <div className="message success">{notice}</div>}
        {warnings.length > 0 && (
          <div className="message warning">
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        )}
        <RequirementEditor
          projectName={projectName}
          requirement={requirement}
          techStackHints={techStackHints}
          useLlm={useLlm}
          llmEnabled={Boolean(settings?.llm.enabled)}
          busy={busy}
          onChangeProjectName={setProjectName}
          onChangeRequirement={setRequirement}
          onChangeTechStackHints={setTechStackHints}
          onToggleLlm={() => setUseLlm((current) => !current)}
          onGenerate={() => {
            void handleGenerate();
          }}
          onSaveDraft={() => {
            void handleSaveDraft();
          }}
        />
        <div className="workspace-grid">
          <TeamPreview team={generatedTeam} onChange={setGeneratedTeam} />
          <ExportPanel
            targetPath={targetPath}
            hasTeam={Boolean(generatedTeam)}
            busy={busy}
            onSelectDirectory={() => {
              void handleSelectDirectory();
            }}
            onWrite={() => {
              void handleWrite();
            }}
          />
        </div>
      </main>
      <SettingsPanel
        open={showSettings}
        settings={settings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        onTest={handleTestConnection}
      />
      <StatusBar status={status} />
    </div>
  );
}
