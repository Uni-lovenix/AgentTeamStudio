import { v4 as uuidv4 } from 'uuid';
import { ProjectDraft } from '../shared/types';
import { PersistenceService } from './persistence-service';
import { logger } from './logger';
import { migrateTeamToLatest } from './process-management';

const SERVICE = 'project-service';

export class ProjectService {
  private log = logger.forService(SERVICE);

  constructor(private persistence: PersistenceService) {}

  list(): ProjectDraft[] {
    const stored = this.persistence.readJson<ProjectDraft[]>('projects.json') ?? [];
    let migratedCount = 0;
    const projects = stored.map((draft) => {
      const team = migrateTeamToLatest(draft.team);
      if (team === draft.team) return draft;
      migratedCount += 1;
      return { ...draft, team };
    });
    if (migratedCount > 0) {
      this.persistence.writeJson('projects.json', projects);
      this.log.info('Migrated project drafts to latest schema', {
        migratedCount,
      });
    }
    const sorted = projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    this.log.debug('Listed project drafts', { count: sorted.length });
    return sorted;
  }

  get(id: string): ProjectDraft | null {
    const project = this.list().find((item) => item.id === id) ?? null;
    this.log.debug('Loaded project draft', { id, found: Boolean(project) });
    return project;
  }

  create(projectName = '未命名项目'): ProjectDraft {
    const now = new Date().toISOString();
    const draft: ProjectDraft = {
      id: uuidv4(),
      projectName,
      requirement: '',
      techStackHints: '',
      team: null,
      targetPath: null,
      createdAt: now,
      updatedAt: now,
    };
    this.save(draft);
    this.log.info('Created project draft', { id: draft.id });
    return draft;
  }

  save(draft: ProjectDraft): ProjectDraft {
    if (!draft.id) {
      throw new Error('Project draft id is required');
    }
    const projects = this.list();
    const updated = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    const index = projects.findIndex((item) => item.id === updated.id);
    if (index >= 0) {
      projects[index] = updated;
    } else {
      projects.unshift(updated);
    }
    this.persistence.writeJson('projects.json', projects);
    this.log.info('Saved project draft', { id: updated.id, projectName: updated.projectName });
    return updated;
  }

  delete(id: string): boolean {
    const projects = this.list().filter((item) => item.id !== id);
    this.persistence.writeJson('projects.json', projects);
    this.log.info('Deleted project draft', { id, remaining: projects.length });
    return true;
  }
}
