import hashlib
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.evidence_index_scan import scan_evidence_index


class EvidenceIndexScanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        subprocess.run(['git', 'init', '-q'], cwd=self.root, check=True)
        subprocess.run(['git', 'config', 'user.email', 'test@example.com'], cwd=self.root, check=True)
        subprocess.run(['git', 'config', 'user.name', 'Test'], cwd=self.root, check=True)
        (self.root / 'docs').mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def test_tracked_text_uses_committed_bytes(self):
        path = self.root / 'tools' / 'receipt.txt'
        path.parent.mkdir()
        path.write_bytes(b'line one\nline two\n')
        expected = hashlib.sha256(path.read_bytes()).hexdigest()
        (self.root / 'docs/EVIDENCE-INDEX.md').write_text(
            f'| Artifact | SHA-256 |\n|---|---|\n| `tools/receipt.txt` | `{expected}` |\n', encoding='utf-8')
        subprocess.run(['git', 'add', '.'], cwd=self.root, check=True)
        subprocess.run(['git', 'commit', '-qm', 'fixture'], cwd=self.root, check=True)
        path.write_bytes(b'line one\r\nline two\r\n')

        [row] = scan_evidence_index(self.root)
        self.assertTrue(row['tracked'])
        self.assertTrue(row['hashMatches'])

    def test_tracked_binary_uses_reviewed_working_bytes_when_index_and_file_change_together(self):
        path = self.root / 'tools' / 'fixture.xlsx'
        path.parent.mkdir()
        path.write_bytes(b'old workbook')
        old_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        index = self.root / 'docs/EVIDENCE-INDEX.md'
        index.write_text(
            f'| Artifact | SHA-256 |\n|---|---|\n| `tools/fixture.xlsx` | `{old_hash}` |\n', encoding='utf-8')
        subprocess.run(['git', 'add', '.'], cwd=self.root, check=True)
        subprocess.run(['git', 'commit', '-qm', 'fixture'], cwd=self.root, check=True)

        path.write_bytes(b'new deterministic workbook')
        new_hash = hashlib.sha256(path.read_bytes()).hexdigest()
        index.write_text(
            f'| Artifact | SHA-256 |\n|---|---|\n| `tools/fixture.xlsx` | `{new_hash}` |\n', encoding='utf-8')

        [row] = scan_evidence_index(self.root)
        self.assertTrue(row['tracked'])
        self.assertTrue(row['hashMatches'])

    def test_directory_pointer_and_relative_children_resolve_under_evidence_root(self):
        evidence = self.root / '.artifacts/run-1'
        evidence.mkdir(parents=True)
        child = evidence / 'summary.json'
        child.write_bytes(b'{}\n')
        expected = hashlib.sha256(child.read_bytes()).hexdigest()
        (self.root / 'docs/EVIDENCE-INDEX.md').write_text(
            'Owner. Evidence root `.artifacts/run-1/`.\n\n'
            f'| Artifact | SHA-256 |\n|---|---|\n| `summary.json` | `{expected}` |\n', encoding='utf-8')

        directory, file = scan_evidence_index(self.root)
        self.assertEqual((directory['kind'], directory['exists']), ('directory', True))
        self.assertEqual(file['path'], '.artifacts/run-1/summary.json')
        self.assertTrue(file['hashMatches'])

    def test_hash_is_taken_from_hash_column_not_inline_reviewer_reference(self):
        screenshot = self.root / '.artifacts/screenshot.png'
        screenshot.parent.mkdir()
        screenshot.write_bytes(b'png')
        screenshot_hash = hashlib.sha256(screenshot.read_bytes()).hexdigest()
        report = self.root / '.artifacts/report.json'
        report.write_bytes(b'{}')
        report_hash = hashlib.sha256(report.read_bytes()).hexdigest()
        (self.root / 'docs/EVIDENCE-INDEX.md').write_text(
            f'| `.artifacts/report.json` | `{report_hash}` | Screenshot `.artifacts/screenshot.png` '
            f'(SHA-256 `{screenshot_hash}`). |\n', encoding='utf-8')

        [row] = scan_evidence_index(self.root)
        self.assertEqual(row['path'], '.artifacts/report.json')
        self.assertTrue(row['hashMatches'])


if __name__ == '__main__':
    unittest.main()
