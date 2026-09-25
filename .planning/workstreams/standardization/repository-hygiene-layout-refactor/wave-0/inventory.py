from pathlib import Path
import subprocess, json, os, re, hashlib, datetime, sys

sys.path.insert(0, str(Path.cwd() / 'scripts'))
from evidence_index_scan import scan_evidence_index

root = Path.cwd()
out = root / '.planning/workstreams/standardization/repository-hygiene-layout-refactor/wave-0'
out.mkdir(parents=True, exist_ok=True)

def git(*args):
    return subprocess.run(['git', *args], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True).stdout

def listz(*args):
    return git(*args).decode('utf-8', 'surrogateescape').split('\0')[:-1]

tracked = listz('ls-files', '-z')
tracked_set = set(tracked)
tracked_ignored = listz('ls-files', '-ci', '--exclude-standard', '-z')
untracked = listz('ls-files', '--others', '--exclude-standard', '-z')

ignore_rules = []
for name in ['.gitignore', '.git/info/exclude']:
    path = root / name
    if path.exists():
        for line_no, line in enumerate(path.read_text('utf-8', errors='replace').splitlines(), 1):
            pattern = line.strip()
            if pattern and not pattern.startswith('#'):
                ignore_rules.append({'file': name, 'line': line_no, 'pattern': pattern})

def tree_size(path):
    total = files = dirs = 0
    if path.is_file():
        try:
            return path.stat().st_size, 1, 0
        except OSError:
            return 0, 0, 0
    for base, child_dirs, child_files in os.walk(path, followlinks=False):
        dirs += len(child_dirs)
        files += len(child_files)
        for filename in child_files:
            try:
                total += (Path(base) / filename).stat().st_size
            except OSError:
                pass
    return total, files, dirs

root_entries = []
for path in sorted(root.iterdir(), key=lambda item: item.name.lower()):
    size, files, dirs = tree_size(path)
    root_entries.append({
        'path': path.name,
        'type': 'symlink' if path.is_symlink() else 'directory' if path.is_dir() else 'file',
        'bytes': size,
        'files': files,
        'dirs': dirs,
        'trackedFiles': sum(1 for item in tracked if item == path.name or item.startswith(path.name + '/')),
        'trackedIgnoredFiles': sum(1 for item in tracked_ignored if item == path.name or item.startswith(path.name + '/')),
        'untrackedFiles': sum(1 for item in untracked if item == path.name or item.startswith(path.name + '/')),
    })

patterns = [
    re.compile(r'^bin(?:-|$)', re.I), re.compile(r'^obj$', re.I), re.compile(r'^TestResults$', re.I),
    re.compile(r'^\.tmp-'), re.compile(r'^\.artifactslk'), re.compile(r'^\.phase.*test', re.I),
    re.compile(r'^\.artifacts$'), re.compile(r'^dist$', re.I), re.compile(r'^coverage$', re.I),
    re.compile(r'^test-results$', re.I), re.compile(r'^playwright-report$', re.I),
    re.compile(r'^node_modules$', re.I), re.compile(r'^__pycache__$'),
]
generated = []
for scan_root in ['backend', 'frontend', 'tools', '.artifacts', 'artifacts', 'logs']:
    start = root / scan_root
    if not start.exists():
        continue
    for base, child_dirs, _ in os.walk(start, topdown=True, followlinks=False):
        keep = []
        for dirname in child_dirs:
            path = Path(base) / dirname
            relative = path.relative_to(root).as_posix()
            recursive_backend = ('/' + relative + '/').count('/backend/') > 1
            if recursive_backend or any(pattern.search(dirname) for pattern in patterns):
                size, files, dirs = tree_size(path)
                generated.append({
                    'path': relative,
                    'bytes': size,
                    'files': files,
                    'dirs': dirs,
                    'reason': 'recursive-backend-output' if recursive_backend else 'generated-name-pattern',
                })
            else:
                keep.append(dirname)
        child_dirs[:] = keep

keep_names = {
    '.git', '.github', '.gitattributes', '.gitignore', '.dockerignore', '.husky', '.pi', '.agents', '.codex',
    'backend', 'frontend', 'contracts', 'docs', 'scripts', 'shipyard', 'tools', 'Dockerfile', 'package.json',
    'package-lock.json', 'global.json', 'dotnet-tools.json', 'vercel.json', 'commitlint.config.js', 'README.md',
    'CONTRIBUTING.md', 'HISTORY.md', 'LESSONS.md', 'MEMORY.md', 'AGENTS.md', '.claude', 'CLAUDE.md', 'skills-lock.json',
}
classes = {name: 'KEEP' for name in keep_names}
classes.update({
    '.artifacts': 'NEEDS_DECISION', 'artifacts': 'MOVE', '.planning': 'NEEDS_DECISION', '.docs': 'NEEDS_DECISION',
    '.dotnet-tools': 'DELETE_GENERATED', '.gitnexus': 'DELETE_GENERATED', 'logs': 'DELETE_GENERATED',
    'node_modules': 'DELETE_GENERATED', 'src': 'DELETE_GENERATED', '.vscode': 'NEEDS_DECISION',
    'Project_Tracking (1).xlsx': 'NEEDS_DECISION',
})
rationales = {
    'KEEP': 'source/config/process owner or explicitly retained local runtime asset',
    'MOVE': 'valid content but wrong or duplicate canonical owner',
    'UNTRACK': 'remain local but leave Git index',
    'DELETE_GENERATED': 'reproducible/local output; deletion deferred to Wave 3',
    'NEEDS_DECISION': 'owner policy or evidence/security review required',
}
classified = []
for entry in root_entries:
    action = classes.get(entry['path'], 'NEEDS_DECISION')
    classified.append({**entry, 'action': action, 'rationale': rationales[action]})

name_risk = re.compile(r'(^|/)(\.env(?:\.|$)|appsettings\.(Development|Production|Staging)\.json$|.*\.(pfx|p12|pem|key)$)', re.I)
detectors = [
    ('private-key-header', re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')),
    ('aws-access-key', re.compile(r'AKIA[0-9A-Z]{16}')),
    ('github-token', re.compile(r'gh[pousr]_[A-Za-z0-9_]{30,}')),
    ('jwt-secret-assignment', re.compile(r'(?i)(JwtSettings__SecretKey|SecretKey)\s*[=:]\s*["\']?[^\s"\']{12,}')),
    ('connection-password', re.compile(r'(?i)(connectionstrings|server=.*;).*password\s*=\s*[^;\s"\']+')),
    ('password-assignment', re.compile(r'(?i)\b(password|passwd|pwd)\b\s*[=:]\s*["\'][^"\']{6,}["\']')),
]
secret_findings = []
for relative in tracked:
    path = root / relative
    if name_risk.search(relative):
        secret_findings.append({'path': relative, 'line': None, 'detector': 'sensitive-filename', 'severity': 'review'})
    try:
        if not path.is_file() or path.stat().st_size > 2_000_000:
            continue
        data = path.read_bytes()
        if b'\0' in data[:4096]:
            continue
        text = data.decode('utf-8', errors='replace')
    except OSError:
        continue
    for line_no, line in enumerate(text.splitlines(), 1):
        for detector, pattern in detectors:
            if pattern.search(line):
                secret_findings.append({
                    'path': relative,
                    'line': line_no,
                    'detector': detector,
                    'severity': 'high' if detector in {'private-key-header', 'aws-access-key', 'github-token'} else 'review',
                })

evidence = scan_evidence_index(root)

ci_files = [
    'package.json', 'frontend/package.json', '.github/workflows/verify.yml', '.github/workflows/codeql.yml',
    '.github/dependabot.yml', 'Dockerfile', 'vercel.json', '.dockerignore', 'frontend/vite.config.ts',
    'frontend/playwright.config.ts',
]
tokens = ['backend/', 'frontend/', '.artifacts/', 'artifacts/', 'contracts/', 'scripts/', 'tools/', 'shipyard/', '.planning/', '.dotnet-tools/', 'docs/']
ci_dependencies = []
for relative in ci_files:
    path = root / relative
    if not path.exists():
        continue
    for line_no, line in enumerate(path.read_text('utf-8', errors='replace').splitlines(), 1):
        roots = [token for token in tokens if token in line]
        if roots:
            ci_dependencies.append({'file': relative, 'line': line_no, 'roots': roots})

worktree_text = git('worktree', 'list', '--porcelain').decode('utf-8', errors='replace')
worktrees = []
current = {}
for line in worktree_text.splitlines() + ['']:
    if not line:
        if current:
            worktrees.append(current)
            current = {}
    else:
        key, *rest = line.split(' ', 1)
        current[key] = rest[0] if rest else True

manifest = {
    'schemaVersion': 1,
    'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'branch': git('branch', '--show-current').decode().strip(),
    'head': git('rev-parse', 'HEAD').decode().strip(),
    'counts': {
        'tracked': len(tracked),
        'trackedIgnored': len(tracked_ignored),
        'untracked': len(untracked),
        'inheritedUntracked': sum(1 for item in untracked if not item.startswith('.planning/workstreams/standardization/repository-hygiene-layout-refactor/')),
        'taskUntracked': sum(1 for item in untracked if item.startswith('.planning/workstreams/standardization/repository-hygiene-layout-refactor/')),
        'ignoreRules': len(ignore_rules),
        'generatedRoots': len(generated),
        'secretRiskFindings': len(secret_findings),
        'evidenceReferences': len(evidence),
    },
    'rootClassification': classified,
    'worktrees': worktrees,
}

for filename, content in [
    ('manifest.json', manifest),
    ('ignore-rules.json', ignore_rules),
    ('generated-roots.json', sorted(generated, key=lambda item: item['bytes'], reverse=True)),
    ('secret-risk.json', secret_findings),
    ('evidence-lineage.json', evidence),
    ('ci-dependencies.json', ci_dependencies),
]:
    (out / filename).write_text(json.dumps(content, ensure_ascii=False, indent=2) + '\n', 'utf-8')
(out / 'tracked.txt').write_text('\n'.join(tracked) + '\n', 'utf-8')
(out / 'tracked-ignored.txt').write_text('\n'.join(tracked_ignored) + '\n', 'utf-8')
(out / 'untracked.txt').write_text('\n'.join(untracked) + '\n', 'utf-8')

print(json.dumps(manifest['counts'], indent=2))
