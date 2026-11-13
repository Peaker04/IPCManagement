"""Fail-closed TRX evidence reporting for integration and selected migration cases."""
import argparse
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def validate(path, expected):
    try:
        root = ET.parse(path).getroot()
    except (OSError, ET.ParseError) as error:
        raise ValueError(f'Cannot read TRX {path}: {error}') from error
    results = [(row.get('testName', ''), row.get('outcome', 'Unknown'))
               for row in root.iter()
               if row.tag.rsplit('}', 1)[-1] == 'UnitTestResult']
    if not results:
        raise ValueError(f'No tests executed in {path}')
    for name in expected:
        matches = [row for row in results if row[0].rsplit('.', 1)[-1] == name]
        if len(matches) != 1:
            raise ValueError(f'Required case {name}: expected exactly one result, found {len(matches)}')
    rejected = [(name, outcome) for name, outcome in results if outcome != 'Passed']
    if rejected:
        raise ValueError('Tests did not pass: ' + '; '.join(f'{name}: {outcome}' for name, outcome in rejected))
    return f'### {Path(path).name}\n\nPassed {len(results)} / Failed 0\n\n' + '\n'.join(
        f'- {outcome} - {name}' for name, outcome in results) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--trx', required=True, type=Path)
    parser.add_argument('--expected', action='append', default=[])
    args = parser.parse_args()
    try:
        report, code = validate(args.trx, args.expected), 0
    except ValueError as error:
        report, code = f'### {args.trx.name}\n\nERROR: {error}\n', 1
    print(report)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as handle:
            handle.write(report + '\n')
    return code


if __name__ == '__main__':
    sys.exit(main())
