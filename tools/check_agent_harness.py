#!/usr/bin/env python3
"""Dependency-free validation for the repository Agent Harness."""

import argparse
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path("docs/harness/manifest.json")
LINK_RE = re.compile(r"(?<!!)\[[^]]*]\(([^)]+)\)")


def metadata(text):
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end < 0:
        return {}
    result = {}
    for line in text[4:end].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            result[key.strip()] = value.strip()
    return result


def slug(text):
    text = re.sub(r"[`*_~]", "", text.strip().lower())
    text = re.sub(r"[^\w\- ]", "", text, flags=re.UNICODE)
    return re.sub(r"[ -]+", "-", text).strip("-")


def validate_links(root, relative_path):
    path = root / relative_path
    text = path.read_text(encoding="utf-8")
    errors = []
    for raw in LINK_RE.findall(text):
        raw = raw.strip()
        if raw.startswith("<"):
            closing = raw.find(">")
            target = raw[1:closing] if closing > 0 else raw
        else:
            target = raw.split(maxsplit=1)[0]
        if not target or target.startswith(("http://", "https://", "mailto:")):
            continue
        file_part, _, anchor = unquote(target).partition("#")
        destination = path if not file_part else (path.parent / file_part).resolve()
        if not destination.exists():
            errors.append(f"{relative_path}: missing link target {target}")
            continue
        if anchor and destination.is_file():
            headings = {
                slug(match.group(1))
                for match in re.finditer(
                    r"^#{1,6}\s+(.+?)\s*$",
                    destination.read_text(encoding="utf-8", errors="replace"),
                    re.MULTILINE,
                )
            }
            if anchor.lower() not in headings:
                errors.append(f"{relative_path}: missing anchor {target}")
    return errors


def validate(root, expected_sizes=None, expected_hashes=None):
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    errors = []
    for relative, expected in (expected_sizes or {}).items():
        path = root / relative
        actual = path.stat().st_size if path.exists() else None
        if actual != expected:
            errors.append(f"stale revision: {relative} expected size {expected}, found {actual}")
    for relative, expected in (expected_hashes or {}).items():
        path = root / relative
        actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
        if actual != expected.lower():
            errors.append(f"stale content: {relative} SHA-256 mismatch")
    owner_ids = set()
    files_to_check = []

    for owner in manifest["canonicalOwners"]:
        owner_id = owner["id"]
        if owner_id in owner_ids:
            errors.append(f"duplicate canonical owner id: {owner_id}")
        owner_ids.add(owner_id)
        path = root / owner["path"]
        if not path.is_file():
            errors.append(f"missing canonical file: {owner['path']}")
            continue
        meta = metadata(path.read_text(encoding="utf-8", errors="replace"))
        if owner.get("status") and meta.get("status") != owner["status"]:
            errors.append(f"{owner['path']}: expected status {owner['status']}")
        if path.suffix.lower() == ".md":
            files_to_check.append(Path(owner["path"]))

    memory = root / "MEMORY.md"
    if memory.stat().st_size > manifest["memoryMaxBytes"]:
        errors.append(f"MEMORY.md exceeds {manifest['memoryMaxBytes']} bytes")

    for pointer in manifest["activePointers"]:
        if not (root / pointer).is_file():
            errors.append(f"dangling active pointer: {pointer}")
    for pointer in manifest.get("requiredPointers", []):
        if not (root / pointer).is_file():
            errors.append(f"dangling required pointer: {pointer}")

    contract = root / "docs/domain/material-reconciliation.md"
    if contract.is_file():
        text = contract.read_text(encoding="utf-8")
        for required in manifest["requiredText"]:
            if required not in text:
                errors.append(f"MRX contract missing required text: {required}")

    names = []
    for skill in manifest["candidateSkills"]:
        path = root / skill["path"]
        if not path.is_file():
            errors.append(f"missing candidate skill: {skill['path']}")
            continue
        name = metadata(path.read_text(encoding="utf-8"),).get("name")
        names.append(name)
        if name != skill["name"]:
            errors.append(f"{skill['path']}: expected skill name {skill['name']}")
    if len(names) != len(set(names)):
        errors.append("duplicate candidate skill name")
    for runtime, registrations in manifest["resolvedSkillRegistrations"].items():
        duplicates = sorted({name for name in registrations if registrations.count(name) > 1})
        for name in duplicates:
            errors.append(f"duplicate resolved skill registration: {runtime}:{name}")

    settings = json.loads((root / ".pi/settings.json").read_text(encoding="utf-8"))
    for skill in manifest["candidateSkills"]:
        if skill["piSetting"] not in settings.get("skills", []):
            errors.append(f"Pi settings missing candidate skill: {skill['piSetting']}")

    allowed = {"documented", "configured", "live", "blocked", "needs-evidence"}
    for runtime, status in manifest["runtimeCapabilities"].items():
        if status not in allowed:
            errors.append(f"unsupported runtime capability status: {runtime}={status}")

    for relative_path in files_to_check + [Path(path) for path in manifest["linkRoots"]]:
        if (root / relative_path).is_file():
            errors.extend(validate_links(root, relative_path))
    return errors


def self_test():
    cases = []
    with tempfile.TemporaryDirectory(prefix="agent-harness-") as directory:
        root = Path(directory) / "repo"
        base_manifest = json.loads((ROOT / MANIFEST).read_text(encoding="utf-8"))
        shutil.copytree(ROOT / "docs", root / "docs")
        for relative in (Path("AGENTS.md"), Path("MEMORY.md"), Path(".pi/settings.json")):
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, destination)
        for item in base_manifest["candidateSkills"]:
            relative = Path(item["path"])
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, destination)
        for value in base_manifest["activePointers"] + base_manifest.get("requiredPointers", []):
            relative = Path(value)
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / relative, destination)
        base_errors = validate(root)
        assert not base_errors, "self-test fixture must start green:\n" + "\n".join(base_errors)

        mutations = {
            "missing-destination": lambda m: m["canonicalOwners"].append({"id": "missing", "path": "docs/missing.md", "status": "canonical"}),
            "dangling-checkpoint": lambda m: m["activePointers"].append(".planning/missing-CHECKLIST.md"),
            "duplicate-owner": lambda m: m["canonicalOwners"].append(dict(m["canonicalOwners"][0])),
            "duplicate-manifest-skill": lambda m: m["candidateSkills"].append(dict(m["candidateSkills"][0])),
            "duplicate-runtime-registration": lambda m: m["resolvedSkillRegistrations"]["pi"].append("harness-maintenance"),
            "unsupported-runtime": lambda m: m["runtimeCapabilities"].update({"codex": "assumed"}),
        }
        for name, mutate in mutations.items():
            manifest = json.loads(json.dumps(base_manifest))
            mutate(manifest)
            (root / MANIFEST).write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
            cases.append((name, bool(validate(root))))
        (root / MANIFEST).write_text(json.dumps(base_manifest, ensure_ascii=False, indent=2), encoding="utf-8")

        maintenance = root / "docs/harness/MAINTENANCE.md"
        original = maintenance.read_text(encoding="utf-8")
        maintenance.write_text(original + "\n[bad](missing.md)\n", encoding="utf-8")
        cases.append(("broken-link", bool(validate(root))))
        maintenance.write_text(original + "\n[bad](README.md#missing-anchor)\n", encoding="utf-8")
        cases.append(("bad-anchor", bool(validate(root))))
        maintenance.write_text(original, encoding="utf-8")
        memory = root / "MEMORY.md"
        actual_size = memory.stat().st_size
        cases.append(("stale-revision", bool(validate(root, {"MEMORY.md": actual_size + 1}))))
        original_memory = memory.read_bytes()
        expected_hash = hashlib.sha256(original_memory).hexdigest()
        memory.write_bytes(bytes([original_memory[0] ^ 1]) + original_memory[1:])
        cases.append(("same-size-stale-content", bool(validate(root, expected_hashes={"MEMORY.md": expected_hash}))))
        memory.write_bytes(original_memory)
        spaced = root / "docs/harness/folder/file name.md"
        spaced.parent.mkdir(parents=True, exist_ok=True)
        spaced.write_text("# Spaced path\n", encoding="utf-8")
        maintenance.write_text(original + "\n[space](<folder/file name.md>)\n", encoding="utf-8")
        cases.append(("space-link-valid", not validate(root)))

    failed = [name for name, caught in cases if not caught]
    if failed:
        print("SELF-TEST FAIL:", ", ".join(failed))
        return 1
    print("SELF-TEST PASS:", ", ".join(name for name, _ in cases))
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument(
        "--expect-size",
        action="append",
        default=[],
        metavar="PATH=BYTES",
        help="fail when a file changed size after a pre-write snapshot",
    )
    parser.add_argument(
        "--expect-sha256",
        action="append",
        default=[],
        metavar="PATH=HASH",
        help="fail when file content differs from a pre-write SHA-256 snapshot",
    )
    args = parser.parse_args()
    if args.self_test:
        raise SystemExit(self_test())
    expected_sizes = {}
    for item in args.expect_size:
        path, separator, size = item.rpartition("=")
        if not separator or not path or not size.isdigit():
            parser.error(f"invalid --expect-size: {item}")
        expected_sizes[path] = int(size)
    expected_hashes = {}
    for item in args.expect_sha256:
        path, separator, digest = item.rpartition("=")
        if not separator or not path or not re.fullmatch(r"[0-9a-fA-F]{64}", digest):
            parser.error(f"invalid --expect-sha256: {item}")
        expected_hashes[path] = digest.lower()
    errors = validate(ROOT, expected_sizes, expected_hashes)
    if errors:
        print("AGENT HARNESS FAIL")
        for error in errors:
            print("-", error)
        raise SystemExit(1)
    print("AGENT HARNESS PASS")


if __name__ == "__main__":
    main()
