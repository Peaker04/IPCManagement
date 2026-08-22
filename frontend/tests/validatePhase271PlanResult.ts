import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './validateVisualReconciliation.ts';

const RESULT_KEYS = ['schemaVersion', 'phase', 'planId', 'status', 'summary', 'mappingDeltaOnly', 'originalLineage', 'correctedMatrix', 'validator', 'sourceSuiteRerun', 'blockers'] as const;
const MARKER_KEYS = ['schemaVersion', 'phase', 'planId', 'status', 'summary', 'payloadResult', 'payloadCommit', 'originalLineage', 'correctedMatrix', 'validator'] as const;

function closed(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value);
  const extras = actual.filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !actual.includes(key));
  if (extras.length || missing.length) throw new Error(`${label} schema mismatch; extra=${extras.join(',')} missing=${missing.join(',')}`);
}
function artifact(value: unknown, label: string): asserts value is { path: string; sha256: string } {
  closed(value, ['path', 'sha256'], label);
  if (typeof value.path !== 'string' || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error(`${label} is invalid`);
}
function lineage(value: unknown) {
  closed(value, ['marker', 'markerCommit', 'matrix'], 'originalLineage');
  artifact(value.marker, 'original marker'); artifact(value.matrix, 'original matrix');
  if (value.markerCommit !== 'c52c80f8186b985d07619a7ad0ed7abc0572675c') throw new Error('original marker commit mismatch');
  if (value.marker.sha256 !== 'b2975e45e548896d7831a98083fc36d82f3e63a9d068c087482231e330fbcc02') throw new Error('original marker hash mismatch');
  if (value.matrix.sha256 !== '15878b85b8a68d16df6582ed0ed279ab7fd1515e3cf8c3b285fed79837ae4ca2') throw new Error('old matrix hash mismatch');
}

export function validateCorrectionResult(value: unknown) {
  closed(value, RESULT_KEYS, 'result');
  if (value.schemaVersion !== 1 || value.phase !== '27.1' || value.planId !== '27.1-01C' || value.status !== 'READY_TO_SEAL') throw new Error('result identity/status mismatch');
  if (value.mappingDeltaOnly !== true || value.sourceSuiteRerun !== false) throw new Error('correction must be mapping-only with no source rerun');
  artifact(value.summary, 'summary'); lineage(value.originalLineage); artifact(value.correctedMatrix, 'correctedMatrix');
  closed(value.validator, ['path', 'sha256', 'version'], 'validator');
  if ((value.validator as Record<string, unknown>).version !== '27.1-01C' || typeof (value.validator as Record<string, unknown>).path !== 'string' || !/^[a-f0-9]{64}$/.test(String((value.validator as Record<string, unknown>).sha256))) throw new Error('validator pin is invalid');
  if (!Array.isArray(value.blockers) || value.blockers.length) throw new Error('result blockers must be empty');
}

export function validateCorrectionMarker(value: unknown) {
  closed(value, MARKER_KEYS, 'marker');
  if (value.schemaVersion !== 1 || value.phase !== '27.1' || value.planId !== '27.1-01C' || value.status !== 'COMPLETE') throw new Error('marker identity/status mismatch');
  artifact(value.summary, 'summary'); artifact(value.payloadResult, 'payloadResult'); lineage(value.originalLineage); artifact(value.correctedMatrix, 'correctedMatrix');
  closed(value.validator, ['path', 'sha256', 'version'], 'validator');
  if ((value.validator as Record<string, unknown>).version !== '27.1-01C') throw new Error('validator version mismatch');
  if (typeof value.payloadCommit !== 'string' || !/^[a-f0-9]{40}$/.test(value.payloadCommit)) throw new Error('payload commit is invalid');
}

function git(...args: string[]) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
function main() {
  const args = process.argv.slice(2); const arg = (name: string) => args[args.indexOf(name) + 1];
  if (arg('--plan') !== '27.1-01C' || arg('--require') !== 'COMPLETE') throw new Error('exact correction plan and COMPLETE status required');
  const phaseDir = resolve('.planning/phases/27.1-reconcile-21-non-warehouse-visual-failures-before-phase-27-c');
  const markerPath = resolve(phaseDir, arg('--marker')); const marker = JSON.parse(readFileSync(markerPath, 'utf8')); validateCorrectionMarker(marker);
  const originalPath = resolve(phaseDir, arg('--require-original-lineage'));
  if (sha256(readFileSync(originalPath)) !== arg('--original-marker-sha256')) throw new Error('original marker bytes drifted');
  if (marker.originalLineage.markerCommit !== arg('--original-marker-commit') || marker.originalLineage.matrix.sha256 !== arg('--old-matrix-sha256')) throw new Error('CLI lineage pin mismatch');
  for (const required of ['--require-correction-matrix-hash', '--require-validator-hash', '--require-payload-commit', '--require-marker-only-commit']) if (!args.includes(required)) throw new Error(`${required} is required`);
  for (const item of [marker.summary, marker.payloadResult, marker.correctedMatrix, marker.validator]) {
    if (sha256(readFileSync(resolve(item.path))) !== item.sha256) throw new Error(`artifact hash mismatch: ${item.path}`);
  }
  const payloadPaths = git('diff-tree', '--no-commit-id', '--name-only', '-r', marker.payloadCommit).split(/\r?\n/).filter(Boolean);
  if (!payloadPaths.includes(marker.summary.path) || !payloadPaths.includes(marker.payloadResult.path) || !payloadPaths.includes(marker.correctedMatrix.path) || !payloadPaths.includes(marker.validator.path)) throw new Error('payload commit is incomplete');
  const markerRepoPath = markerPath.replace(resolve('.').replaceAll('\\', '/'), '').replace(/^[/\\]/, '').replaceAll('\\', '/');
  const headPaths = git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD').split(/\r?\n/).filter(Boolean);
  if (headPaths.length !== 1 || headPaths[0] !== markerRepoPath) throw new Error('HEAD is not the marker-only correction commit');
  console.log(`PASS 27.1-01C COMPLETE: dual lineage, old/new hashes, reachable payload, and marker-only HEAD verified`);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
