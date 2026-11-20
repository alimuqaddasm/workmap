#!/usr/bin/env python3
"""Lesson-name check (EX-44 plan P7.1, council C2 point 4): page code should never read lesson names itself.

WARN ONLY (Ali, 2026-11-20): it never fails a run or blocks a push. New parsing shows as a warning
(on GitHub, a warning on the run, which stays green).

Lesson labels (B1 S1, L3, U15.10, H07, F2) are turned into units only by the shared badge code
(kit/badge.js), from layers.json. This check warns about any page code that picks a label apart or builds
one by hand: a regex with a lesson letter next to a digit, a class of lesson letters, or a label
glued together from a letter and a number.

  namecheck.py scan [DIR]       list every finding and compare with the baseline (warns if over it)
  namecheck.py baseline [DIR]   write the baseline from today's code (only when a chunk removes findings
                                or a page is adopted; never to let new parsing in)

The baseline (.github/namecheck-baseline.json) holds today's count per file, so old code is quiet and
any NEW parsing warns. P7.2 to P7.4 bring the counts down to 0. A line that only looks like a name
but is not one can carry the comment `namecheck: ok (why)`.
Runs on GitHub after every push (.github/workflows/name-check.yml) and by hand on EX-44.
Exit code: always 0 (clean or warned), 2 only for a usage error.
"""
import json, os, re, sys

L = "SLBUHF"  # sabaq, lesson, bab, atlas unit, hub draft, fasl
RULES = [
    # /^S\d+$/, / B\d+.*$/, /\bU(\d+)\.(\d+)/ : a lesson letter right before a digit pattern
    ("name-regex", re.compile(r"(?<![A-Za-z\\])[" + L + r"]\(?(?:\\d|\[0-9\])")),
    # /^S0/, /^U/, /^B\d+ / : a regex that starts on a lesson letter
    ("name-regex", re.compile(r"/\^[" + L + r"](?![a-z])")),
    # /\b([sblf])0+(\d)/ : a character class made of lesson letters
    ("name-regex", re.compile(r"\[[" + L + L.lower() + r"]{2,}\]")),
    # `B${b.n} S${H.h}` : a label built in a template
    ("name-build", re.compile(r"(?<![A-Za-z0-9_$\\])[" + L + r"]\$\{")),
    # 'S' + d.n, "B" + bab : a label glued from a letter and a value
    ("name-build", re.compile(r"""['"][""" + L + r"""] ?['"]\s*\+""")),
]
SKIP_DIRS = {".git", "node_modules", "kit"}
EXTS = (".js", ".mjs", ".html", ".htm")
BASE = os.path.join(".github", "namecheck-baseline.json")
OK = "namecheck: ok"


def page_files(top):
    for d, dirs, files in os.walk(top):
        dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS)
        for f in sorted(files):
            if f.endswith(EXTS) and not f.endswith(".min.js"):
                yield os.path.relpath(os.path.join(d, f), top)


def scan(top):
    found = {}
    for rel in page_files(top):
        with open(os.path.join(top, rel), encoding="utf-8", errors="replace") as fh:
            for n, line in enumerate(fh, 1):
                if OK in line:
                    continue
                for name, rx in RULES:
                    if rx.search(line):
                        found.setdefault(rel, []).append((n, name))
                        break
    return found


def main(argv):
    if not argv or argv[0] not in ("scan", "baseline"):
        print(__doc__); return 2
    top = argv[1] if len(argv) > 1 else "."
    found = scan(top)
    counts = {f: len(v) for f, v in found.items()}
    path = os.path.join(top, BASE)
    if argv[0] == "baseline":
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            json.dump({"help": "namecheck.py baseline: lesson-name parsing left in old page code, per file. Only goes down.",
                       "counts": dict(sorted(counts.items()))}, fh, indent=1)
            fh.write("\n")
        print(f"baseline written: {sum(counts.values())} findings in {len(counts)} files")
        return 0
    base = {}
    if os.path.exists(path):
        base = json.load(open(path)).get("counts", {})
    bad = 0
    for f in sorted(set(counts) | set(base)):
        have, allowed = counts.get(f, 0), base.get(f, 0)
        mark = "OVER" if have > allowed else "ok"
        if have or allowed:
            print(f"{mark:4} {f}: {have} (baseline {allowed})")
        if have > allowed:
            bad += 1
            for n, name in found[f]:
                print(f"       line {n}: {name}")
                if os.environ.get("GITHUB_ACTIONS") == "true":
                    print(f"::warning file={f},line={n}::reads a lesson name itself ({name}); ask kit/badge.js instead")
    total, allowed = sum(counts.values()), sum(base.values())
    if bad:
        print(f"WARN: {bad} file(s) parse lesson names beyond the baseline (nothing blocked). Ask kit/badge.js for the unit instead.")
        return 0
    print(f"PASS: {total} old findings, baseline {allowed}; nothing new.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
