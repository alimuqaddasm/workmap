#!/usr/bin/env python3
"""Public repo check (plan P0.4): nothing private may sit in a public repo.

It blocks EX-44 paths, briefs, plans and job notes, and keys or tokens. The same file runs in two places:
  - on EX-44 as the git pre-push hook of each public working copy (it checks every commit being pushed),
  - on GitHub after the push, as `.github/publiccheck.py`, run by `.github/workflows/public-check.yml`.

  publiccheck.py scan [REF] [-C DIR]   check the files at REF (default HEAD) of the repo in DIR (default .)
  publiccheck.py history [REF]         check every commit reachable from REF (GitHub runs this)
  publiccheck.py hook                  pre-push hook mode: checks every commit the push sends
  publiccheck.py install DIR           put the pre-push hook into DIR's .git/hooks (touches no tracked file)
  publiccheck.py files DIR             write `.github/publiccheck.py` and the workflow into DIR's working tree
                                       (commit and push them on a branch yourself)

A finding shows file, line and rule name only, never the matched text, so a real key is never printed.
A plan or brief is blocked as a file (by its name); merely naming one in text is allowed.
The patterns are written so that this file never matches itself (for example `/srv[/]ws`).
Exit code: 0 clean, 1 something private found, 2 usage or git error.
"""
import os, re, shutil, subprocess, sys

# Content rules: (name, regex). Matched against every text file.
CONTENT = [
    ("ex44-path", r"/srv[/]ws\b"),
    ("home-path", r"/home[/]ali\b"),
    ("brief", r"state[/]briefs"),
    ("job-note", r"(?<![\w-])_jobs[/]"),
    ("github-token", r"github_pat_[A-Za-z0-9_]{22,}"),
    ("github-token", r"\bgh[pousr]_[A-Za-z0-9]{36,}"),
    ("anthropic-key", r"sk-ant-[A-Za-z0-9_-]{20,}"),
    ("openai-key", r"\bsk-(?:proj-)?[A-Za-z0-9]{32,}"),
    ("elevenlabs-key", r"\bsk_[a-f0-9]{40,}"),
    ("google-key", r"\bAIza[0-9A-Za-z_-]{35}"),
    ("aws-key", r"\bAKIA[0-9A-Z]{16}\b"),
    ("private-key", r"-{5}BEGIN [A-Z ]*PRIVATE KEY-{5}"),
]
# Path rules: a file whose path matches is blocked whatever it holds.
PATHS = [
    ("brief", r"(?:^|/)briefs/"),
    ("job-note", r"(?:^|/)_jobs[/]"),
    ("plan", r"(?:^|/)(?:PLAN|HANDOFF|BUILD-LOG|EX44-SYSTEM-DESIGN)\.md$"),
    ("key-file", r"(?:^|/)(?:\.env|id_rsa|id_ed25519|credentials\.json|token\.json)$|\.pem$"),
]
CONTENT = [(n, re.compile(p.encode())) for n, p in CONTENT]
PATHS = [(n, re.compile(p)) for n, p in PATHS]
ZERO = "0" * 40
HERE = os.path.abspath(__file__)
WORKFLOW = """name: public-check
on:
  push:
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: python3 .github/publiccheck.py history HEAD
"""
MAIN_TOOL = os.path.join("/srv", "ws", "_repo", "ex44-system", "tools", "publiccheck.py")  # split: never matches itself
HOOK = """#!/bin/sh
# Public repo check (ex44-system tools/publiccheck.py). Blocks a push that holds anything private.
T="{tool}"
[ -f "$T" ] || T="$(git rev-parse --show-toplevel)/.github/publiccheck.py"
[ -f "$T" ] || {{ echo "publiccheck: tool not found, push blocked"; exit 1; }}
exec python3 "$T" hook
"""

def git(repo, *a, data=False):
    r = subprocess.run(["git", "-c", "core.quotepath=false", *a], cwd=repo, capture_output=True)
    if r.returncode:
        print(f"publiccheck: git {' '.join(a[:2])} failed: {r.stderr.decode('utf-8', 'replace').strip()}")
        sys.exit(2)
    return r.stdout if data else r.stdout.decode("utf-8", "replace")


SEEN = {}  # blob id -> [(line, rule)], so each file version is read once


def scan_commits(repo, commits):
    out = []
    for c in commits:
        out += scan(repo, c)
    return out


def scan(repo, ref):
    """Return findings [(path, line, rule)] for the tree at ref."""
    out = []
    entries = git(repo, "ls-tree", "-r", "-z", ref, data=True).split(b"\0")
    blobs = []
    for e in entries:
        if not e:
            continue
        meta, path = e.split(b"\t", 1)
        mode, kind, sha = meta.split()
        if kind != b"blob":
            continue
        path = path.decode("utf-8", "replace")
        for name, rx in PATHS:
            if rx.search(path):
                out.append((path, 0, name))
        sha = sha.decode()
        if sha in SEEN:
            out += [(path, ln, n) for ln, n in SEEN[sha]]
        else:
            blobs.append((sha, path))
    if not blobs:
        return out
    p = subprocess.run(["git", "cat-file", "--batch"], cwd=repo, capture_output=True,
                       input="".join(s + "\n" for s, _ in blobs).encode())
    buf, i = p.stdout, 0
    for sha, path in blobs:
        nl = buf.index(b"\n", i)
        size = int(buf[i:nl].split()[2])
        body = buf[nl + 1: nl + 1 + size]
        i = nl + 1 + size + 1
        hits = SEEN[sha] = []
        if b"\0" in body[:8000]:
            continue  # binary
        for name, rx in CONTENT:
            for m in rx.finditer(body):
                hits.append((body.count(b"\n", 0, m.start()) + 1, name))
        out += [(path, ln, n) for ln, n in hits]
    return out


def report(findings, where):
    if not findings:
        print(f"publiccheck: clean ({where})")
        return 0
    print(f"publiccheck: BLOCKED, {len(findings)} private thing(s) in {where}:")
    for path, line, name in sorted(set(findings)):
        print(f"  {path}:{line}  {name}" if line else f"  {path}  {name} (file name)")
    print("Take them out of every commit listed (rewrite local commits not yet pushed) and push again.\nThe matched text is never shown.")
    return 1


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 2
    cmd, rest = argv[0], argv[1:]
    if cmd == "scan":
        repo = "."
        if "-C" in rest:
            k = rest.index("-C"); repo = rest[k + 1]; del rest[k:k + 2]
        ref = rest[0] if rest else "HEAD"
        return report(scan(repo, ref), ref)
    if cmd == "history":
        ref = rest[0] if rest else "HEAD"
        commits = git(".", "rev-list", ref).split()
        return report(scan_commits(".", commits), f"{len(commits)} commits of {ref}")
    if cmd == "hook":
        bad = 0
        for line in sys.stdin.read().splitlines():
            parts = line.split()
            if len(parts) != 4 or parts[1] == ZERO:
                continue  # a branch delete pushes nothing
            # every commit this push sends, not only the newest (a removed plant still sits in history)
            commits = git(".", "rev-list", parts[1], "--not", "--remotes").split() or [parts[1]]
            bad |= report(scan_commits(".", commits), f"{parts[0]}, {len(commits)} new commit(s)")
        return bad
    if cmd == "install" and rest:
        repo = os.path.abspath(rest[0])
        hooks = git(repo, "rev-parse", "--git-path", "hooks").strip()
        hooks = hooks if os.path.isabs(hooks) else os.path.join(repo, hooks)
        hook = os.path.join(hooks, "pre-push")
        if os.path.exists(hook) and "publiccheck" not in open(hook).read():
            print(f"publiccheck: {hook} already exists and is not ours; left alone.")
            return 2
        os.makedirs(hooks, exist_ok=True)
        with open(hook, "w") as f:
            f.write(HOOK.format(tool=MAIN_TOOL))
        os.chmod(hook, 0o755)
        print(f"publiccheck: pre-push hook installed in {repo}")
        return 0
    if cmd == "files" and rest:
        repo = os.path.abspath(rest[0])
        os.makedirs(os.path.join(repo, ".github", "workflows"), exist_ok=True)
        shutil.copyfile(HERE, os.path.join(repo, ".github", "publiccheck.py"))
        with open(os.path.join(repo, ".github", "workflows", "public-check.yml"), "w") as f:
            f.write(WORKFLOW)
        print(f"publiccheck: .github/publiccheck.py and .github/workflows/public-check.yml written in {repo}")
        return 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
