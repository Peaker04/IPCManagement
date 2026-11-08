#!/usr/bin/env python3
"""Safely prune unreferenced, reproducible IPCManagement artifacts."""

import argparse
import os
import re
import shutil
import stat
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / ".artifacts"
REFERENCE_ROOTS = [ROOT / "MEMORY.md", ROOT / ".planning", ROOT / "docs"]
HIGH_CHURN_ROOTS = {"shipyard-live", "information-simplification", "goal-ui-ux", "runtime", "phase28-ui-audit"}
ARTIFACT_RE = re.compile(r"\.artifacts/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*")


def reference_files():
    for root in REFERENCE_ROOTS:
        if root.is_file():
            yield root
        elif root.is_dir():
            yield from (path for path in root.rglob("*") if path.is_file())


def referenced_paths():
    result = set()
    for path in reference_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        result.update(ARTIFACT_RE.findall(text))
    return result


def tracked_paths():
    output = subprocess.check_output(
        ["git", "ls-files", ".artifacts"], cwd=ROOT, text=True, encoding="utf-8"
    )
    return set(output.splitlines())


def relative(path):
    return path.relative_to(ROOT).as_posix()


def protected(path, references, tracked):
    candidate = relative(path)
    return any(item == candidate or item.startswith(candidate + "/") for item in references | tracked)


def candidates(references, tracked, minimum_age_days):
    cutoff = time.time() - minimum_age_days * 86400
    found = []
    for path in ARTIFACTS.iterdir() if ARTIFACTS.exists() else []:
        if path.name in HIGH_CHURN_ROOTS and path.is_dir():
            children = path.iterdir()
        else:
            children = [path]
        for child in children:
            if protected(child, references, tracked):
                continue
            newest = max((item.stat().st_mtime for item in child.rglob("*") if item.is_file()), default=child.stat().st_mtime) if child.is_dir() else child.stat().st_mtime
            if newest <= cutoff:
                found.append(child)
    unique = []
    for path in sorted(set(found), key=lambda item: len(item.parts)):
        if not any(parent in unique for parent in path.parents):
            unique.append(path)
    return unique


def size(path):
    return sum(item.stat().st_size for item in path.rglob("*") if item.is_file()) if path.is_dir() else path.stat().st_size


def remove(path):
    target = str(path.resolve())
    if os.name == "nt":
        target = "\\\\?\\" + target
    if path.is_dir():
        def make_writable(function, name, _error):
            os.chmod(name, stat.S_IWRITE)
            function(name)
        shutil.rmtree(target, onexc=make_writable)
    elif path.exists():
        os.unlink(target)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="delete listed candidates")
    parser.add_argument("--minimum-age-days", type=int, default=7)
    args = parser.parse_args()
    if args.minimum_age_days < 0:
        parser.error("--minimum-age-days must be non-negative")

    paths = candidates(referenced_paths(), tracked_paths(), args.minimum_age_days)
    rows = [(size(path), path) for path in paths]
    total = sum(value for value, _ in rows)
    print(f"mode={'APPLY' if args.apply else 'DRY-RUN'} candidates={len(rows)} size_mib={total / 1024 / 1024:.2f}")
    for value, path in sorted(rows, reverse=True):
        print(f"{value / 1024 / 1024:10.2f} MiB  {relative(path)}")
    if args.apply:
        for _, path in rows:
            remove(path)
        print("artifact cleanup complete")
    elif rows:
        print("No files removed. Re-run with --apply after reviewing the list.")


if __name__ == "__main__":
    main()
