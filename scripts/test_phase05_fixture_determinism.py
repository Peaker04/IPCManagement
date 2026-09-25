import hashlib
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'tools/e2e/Phase05WeeklyMenuFixtureTool/Phase05WeeklyMenuFixtureTool.csproj'
FILES = ('weekly-menu-golden-ANV.xlsx', 'weekly-menu-golden-DAV.xlsx')


class Phase05FixtureDeterminismTests(unittest.TestCase):
    def test_fixture_tool_generates_identical_workbooks_twice(self):
        with tempfile.TemporaryDirectory() as temp:
            first, second = Path(temp, 'first'), Path(temp, 'second')
            for output in (first, second):
                subprocess.run(
                    ['dotnet', 'run', '--project', str(PROJECT), '--', str(output), '2026-08-17'],
                    cwd=ROOT,
                    check=True,
                    capture_output=True,
                    text=True,
                )

            hashes = {}
            for name in FILES:
                first_bytes, second_bytes = (first / name).read_bytes(), (second / name).read_bytes()
                self.assertEqual(first_bytes, second_bytes, f'{name} changed between identical runs')
                hashes[name] = hashlib.sha256(first_bytes).hexdigest()
                with zipfile.ZipFile(first / name) as workbook:
                    workbook_xml = workbook.read('xl/workbook.xml').decode()
                    self.assertIn('name="25k"', workbook_xml)
                    self.assertIn('name="30k"', workbook_xml)
                    self.assertIn('name="34k"', workbook_xml)
                    sheet = workbook.read('xl/worksheets/sheet1.xml').decode()
                    self.assertIn('17/08/2026', sheet)
                    self.assertIn('MENU MẶN - CA SÁNG', sheet)

            self.assertNotEqual(hashes[FILES[0]], hashes[FILES[1]], 'ANV and DAV fixtures must remain distinct')


if __name__ == '__main__':
    unittest.main()
