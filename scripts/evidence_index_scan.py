from __future__ import annotations

import hashlib
import re
import subprocess
from pathlib import Path

HASH = re.compile(r"^[0-9A-Fa-f]{64}$")
ROOTS = ('.artifacts/', '.planning/', 'artifacts/', 'tools/', 'frontend/docs/')


def _git(root: Path, *args: str) -> bytes | None:
    result = subprocess.run(['git', *args], cwd=root, capture_output=True)
    return result.stdout if result.returncode == 0 else None


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def scan_evidence_index(root: Path, index_path: str = 'docs/EVIDENCE-INDEX.md') -> list[dict]:
    text = (root / index_path).read_text('utf-8')
    tracked = set((_git(root, 'ls-files', '-z') or b'').decode('utf-8', errors='replace').split('\0'))
    rows: list[dict] = []
    evidence_root: str | None = None

    for line_no, line in enumerate(text.splitlines(), 1):
        root_match = re.search(r'Evidence root `([^`]+/)`', line)
        if root_match:
            evidence_root = root_match.group(1)
            path = root / evidence_root
            rows.append({'path': evidence_root, 'line': line_no, 'kind': 'directory', 'exists': path.is_dir(),
                         'tracked': False, 'expectedSha256': None, 'actualSha256': None, 'hashMatches': None})

        if not line.lstrip().startswith('|'):
            continue
        cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
        if len(cells) < 2:
            continue
        path_tokens = re.findall(r'`([^`]+)`', cells[0])
        hash_tokens = re.findall(r'`([^`]+)`', cells[1])
        if not path_tokens or not hash_tokens or not HASH.fullmatch(hash_tokens[0]):
            continue

        value = path_tokens[0]
        external = len(value) > 2 and value[1] == ':'
        if not external and not value.startswith(ROOTS):
            if not evidence_root:
                continue
            value = evidence_root + value
        path = Path(value) if external else root / value
        expected = hash_tokens[0].upper()
        relative = None if external else value
        is_tracked = relative in tracked if relative else False
        changed = is_tracked and _git(root, 'diff', '--quiet', '--', relative) is None
        data = ((path.read_bytes() if path.is_file() else None) if changed
                else _git(root, 'show', f'HEAD:{relative}') if is_tracked
                else path.read_bytes() if path.is_file() else None)
        actual = _sha256(data) if data is not None else None
        rows.append({'path': value, 'line': line_no, 'kind': 'file', 'exists': data is not None,
                     'tracked': is_tracked, 'expectedSha256': expected, 'actualSha256': actual,
                     'hashMatches': actual == expected if actual else None})
    return rows
