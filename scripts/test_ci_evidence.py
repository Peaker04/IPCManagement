"""Behavioral CI evidence checks. No database or application process is started."""
import importlib.util
import tempfile
import unittest
from pathlib import Path


def load(name):
    path = Path(__file__).with_name(name + '.py')
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestResultsTests(unittest.TestCase):
    def setUp(self):
        self.owner = load('ci_test_results')
        self.assertIsNotNone(self.owner, 'TRX evidence validator must exist')
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name, 'results.trx')

    def write(self, results):
        rows = ''.join(f'<UnitTestResult testName="{name}" outcome="{outcome}" />'
                       for name, outcome in results)
        self.path.write_text('<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">'
                             '<Results>' + rows + '</Results></TestRun>', encoding='utf-8')

    def test_accepts_real_namespaced_passed_results(self):
        self.write([('Suite.fresh', 'Passed'), ('Suite.upgrade', 'Passed')])
        report = self.owner.validate(self.path, ['fresh', 'upgrade'])
        self.assertIn('Suite.upgrade', report)
        self.assertIn('Passed 2', report)

    def test_rejects_missing_case_even_when_another_passes(self):
        self.write([('Suite.upgrade_a', 'Passed')])
        with self.assertRaisesRegex(ValueError, 'upgrade_b'):
            self.owner.validate(self.path, ['upgrade_a', 'upgrade_b'])

    def test_rejects_substring_match_and_duplicate_case(self):
        for rows in [[('Suite.fresh_extra', 'Passed')],
                     [('Suite.fresh', 'Passed'), ('Other.fresh', 'Passed')]]:
            with self.subTest(rows=rows):
                self.write(rows)
                with self.assertRaises(ValueError):
                    self.owner.validate(self.path, ['fresh'])

    def test_rejects_failed_skipped_unknown_outcomes(self):
        for outcome in ['Failed', 'NotExecuted', 'Inconclusive', 'Timeout', 'Unknown']:
            with self.subTest(outcome=outcome):
                self.write([('Suite.fresh', outcome)])
                with self.assertRaises(ValueError):
                    self.owner.validate(self.path, ['fresh'])

    def test_rejects_missing_empty_and_malformed_trx(self):
        with self.assertRaises(ValueError):
            self.owner.validate(self.path, [])
        for content in ['', '<TestRun>', '<TestRun><Results/></TestRun>']:
            self.path.write_text(content, encoding='utf-8')
            with self.subTest(content=content), self.assertRaises(ValueError):
                self.owner.validate(self.path, [])


class SchemaParityTests(unittest.TestCase):
    def setUp(self):
        self.owner = load('ci_schema_parity')
        self.assertIsNotNone(self.owner, 'Schema evidence comparator must exist')

    def test_equal_shapes_ignore_row_order_only(self):
        self.assertEqual(self.owner.compare('TBL|a\nCOL|a|id|int|NO|\n',
                                            'COL|a|id|int|NO|\nTBL|a\n'), '')

    def test_both_or_one_empty_fail_closed(self):
        for model, migrated in [('', ''), ('TBL|a', ''), ('', 'TBL|a')]:
            with self.subTest(model=model, migrated=migrated), self.assertRaisesRegex(ValueError, 'empty'):
                self.owner.compare(model, migrated)

    def test_real_column_or_foreign_key_difference_is_reported(self):
        diff = self.owner.compare('TBL|a\nCOL|a|id|int|NO|\n',
                                  'TBL|a\nCOL|a|id|bigint|NO|\nFK|a|b|b|id\n')
        self.assertIn('-COL|a|id|int|NO|', diff)
        self.assertIn('+COL|a|id|bigint|NO|', diff)
        self.assertIn('+FK|a|b|b|id', diff)


if __name__ == '__main__':
    unittest.main()
