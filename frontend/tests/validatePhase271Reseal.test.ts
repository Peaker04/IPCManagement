import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FROZEN_OPERATIONAL_BASE, HISTORICAL_ROOTS, MARKER_PATH, PAYLOAD_PATHS, canonicalPlanningDelta, freezePlanningHead, planningDeltaSha256, validateHistoricalRoots, validateTopologyDocument } from './validatePhase271Reseal';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'phase271-01v-')); git(cwd, 'init'); git(cwd, 'config', 'user.email', 'test@example.com'); git(cwd, 'config', 'user.name', 'Test');
  mkdirSync(join(cwd, '.planning'), { recursive: true }); writeFileSync(join(cwd, '.planning/ROADMAP.md'), '# Project Roadmap\n'); git(cwd, 'add', '.planning/ROADMAP.md'); git(cwd, 'commit', '-m', 'base');
  return { cwd, base: git(cwd, 'rev-parse', 'HEAD') };
}
function canonicalPlan(cwd: string, name = '27.1-02-PLAN.md') {
  const dir = join(cwd, '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c'); mkdirSync(dir, { recursive: true });
  const path = join(dir, name); writeFileSync(path, '---\nphase: 27.1\nplan: 02\n---\n<objective>Test</objective>\n<tasks></tasks>\n'); return path;
}
function commitAll(cwd: string, message: string) { git(cwd, 'add', '.'); git(cwd, 'commit', '-m', message); return git(cwd, 'rev-parse', 'HEAD'); }
function validDocument(base: string, head: string) {
  const delta = { base, head, commits: [] };
  return { schemaVersion: 1, phase: '27.1', planId: '27.1-01V', status: 'READY_TO_SEAL', authority: 'TOPOLOGY_VALIDATOR_ONLY', frozenOperationalBase: FROZEN_OPERATIONAL_BASE, planningHead: head, planningDelta: { ...delta, base: FROZEN_OPERATIONAL_BASE }, planningDeltaSha256: planningDeltaSha256({ ...delta, base: FROZEN_OPERATIONAL_BASE }), expectedLiveHead: head, validatorPins: [{ path: 'frontend/tests/validatePhase271Reseal.test.ts', sha256: 'a'.repeat(64), gitBlobId: 'b'.repeat(40) }, { path: 'frontend/tests/validatePhase271Reseal.ts', sha256: 'a'.repeat(64), gitBlobId: 'b'.repeat(40) }], payloadMembers: PAYLOAD_PATHS, blockers: [] } as const;
}

describe('Phase 27.1 01V planning delta seal', () => {
  it('accepts a clean later planning-only commit and produces a stable ordered hash', () => {
    const { cwd, base } = fixture(); canonicalPlan(cwd); const head = commitAll(cwd, 'planning'); const delta = canonicalPlanningDelta(cwd, base, head);
    expect(delta).toEqual({ base, head, commits: [{ commit: head, parent: base, paths: [{ status: 'A', path: '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/27.1-02-PLAN.md' }] }] });
    expect(planningDeltaSha256(delta)).toMatch(/^[a-f0-9]{64}$/); expect(freezePlanningHead(cwd, base).planningHead).toBe(head);
  });

  it.each([
    ['frontend source', 'frontend/src/App.tsx'],
    ['evidence', '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/evidence/x.json'],
    ['runtime snapshot', 'frontend/tests/x.spec.ts-snapshots/x.png'],
    ['unrelated planning', '.planning/STATE.md'],
  ])('rejects %s paths', (_label, path) => {
    const { cwd, base } = fixture(); const absolute = join(cwd, path); mkdirSync(join(absolute, '..'), { recursive: true }); writeFileSync(absolute, 'x'); const head = commitAll(cwd, 'bad');
    expect(() => canonicalPlanningDelta(cwd, base, head)).toThrow(/non-planning path/);
  });

  it('rejects deletion and malformed planning content independently', () => {
    const first = fixture(); canonicalPlan(first.cwd); const allowed = commitAll(first.cwd, 'allowed'); git(first.cwd, 'rm', '.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c/27.1-02-PLAN.md'); const deleted = commitAll(first.cwd, 'delete');
    expect(() => canonicalPlanningDelta(first.cwd, allowed, deleted)).toThrow(/deletion/);
    const second = fixture(); const path = canonicalPlan(second.cwd); writeFileSync(path, 'not a plan'); const malformed = commitAll(second.cwd, 'malformed'); expect(() => canonicalPlanningDelta(second.cwd, second.base, malformed)).toThrow(/malformed PLAN/);
  });

  it('rejects merge commits in the planning interval', () => {
    const { cwd, base } = fixture(); git(cwd, 'checkout', '-b', 'side'); canonicalPlan(cwd); commitAll(cwd, 'side'); git(cwd, 'checkout', 'master'); writeFileSync(join(cwd, '.planning/ROADMAP.md'), '# Project Roadmap\nmain\n'); commitAll(cwd, 'main'); git(cwd, 'merge', '--no-ff', 'side', '-m', 'merge');
    expect(() => canonicalPlanningDelta(cwd, base, git(cwd, 'rev-parse', 'HEAD'))).toThrow(/merge commit/);
  });

  it('rejects staged, unstaged, and untracked state independently', () => {
    for (const mode of ['staged','unstaged','untracked']) { const { cwd, base } = fixture(); if (mode === 'staged') { writeFileSync(join(cwd, '.planning/ROADMAP.md'), '# Project Roadmap\nstaged'); git(cwd, 'add', '.planning/ROADMAP.md'); } else if (mode === 'unstaged') writeFileSync(join(cwd, '.planning/ROADMAP.md'), '# Project Roadmap\ndirty'); else writeFileSync(join(cwd, 'untracked'), 'x'); expect(() => freezePlanningHead(cwd, base)).toThrow(/clean/); }
  });

  it('validates all historical markers from their explicit commits, not HEAD', () => {
    const cwd = git(process.cwd(), 'rev-parse', '--show-toplevel'); expect(() => validateHistoricalRoots(cwd, HISTORICAL_ROOTS.map((root) => ({ commit: root.commit, marker: root.marker })))).not.toThrow();
    const substituted = HISTORICAL_ROOTS.map((root) => ({ commit: root.commit, marker: root.marker })); substituted[0].commit = git(cwd, 'rev-parse', 'HEAD'); expect(() => validateHistoricalRoots(cwd, substituted)).toThrow(/substituted/);
  });

  it('rejects reordered, collapsed, detached, wrong-marker, and unreachable roots', () => {
    const cwd = git(process.cwd(), 'rev-parse', '--show-toplevel'); const roots = HISTORICAL_ROOTS.map((root) => ({ commit: root.commit, marker: root.marker }));
    for (const mutate of [(x: typeof roots) => [x[1],x[0],x[2],x[3]], (x: typeof roots) => { x[1] = x[0]; return x; }, (x: typeof roots) => { x[2].commit = 'a'.repeat(40); return x; }, (x: typeof roots) => { x[3].marker = MARKER_PATH; return x; }]) expect(() => validateHistoricalRoots(cwd, mutate(structuredClone(roots)))).toThrow();
  });

  it('enforces closed, distinct planning/base/live fields and exact members', () => {
    const doc = validDocument(FROZEN_OPERATIONAL_BASE, 'c'.repeat(40)); expect(() => validateTopologyDocument(doc, 'READY_TO_SEAL')).not.toThrow();
    const unknown = { ...doc, surprise: true }; expect(() => validateTopologyDocument(unknown, 'READY_TO_SEAL')).toThrow(/schema/);
    for (const field of ['frozenOperationalBase','planningHead'] as const) { const bad = structuredClone(doc) as any; bad[field] = 'd'.repeat(40); expect(() => validateTopologyDocument(bad, 'READY_TO_SEAL')).toThrow(); }
    const missing = structuredClone(doc) as any; delete missing.planningDeltaSha256; expect(() => validateTopologyDocument(missing, 'READY_TO_SEAL')).toThrow(/schema/);
    const widened = structuredClone(doc) as any; widened.payloadMembers.push('extra'); expect(() => validateTopologyDocument(widened, 'READY_TO_SEAL')).toThrow(/membership/);
  });
});
