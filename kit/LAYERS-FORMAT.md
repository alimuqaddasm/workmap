# layers.json format (v1)

Written by `layers.py` on EX-44 (plan P6.3) into the private ex44-state repo. Read by the shared badge
code `badge.js` (plan P7.1) in the three pages. Field names were set by P7.1 on 2026-11-20, before
P6.3 had written any; P6.3 writes exactly these names, or changes this file and `badge.js` together.

```json
{
  "version": 1,
  "made": "2026-11-20T10:55:00Z",
  "courses": {
    "ZM": {
      "units": {
        "ZM-B01-001": {
          "kinds": {
            "handout":       {"branch": ["job/zm-b1"], "main": true, "preview": "2026-11-18", "approved": null},
            "teacher copy":  {"branch": [], "main": true, "preview": null, "approved": null}
          }
        }
      },
      "aliases": {"B1 S1": "ZM-B01-001", "B1 L1": "ZM-B01-001", "B1 H01": "ZM-B01-001", "U15.1": "ZM-B01-001"}
    }
  }
}
```

- `made`: when layers.py ran, UTC, ISO 8601. The pages show it as the one "as of" stamp. Older than 6 hours shows as old.
- `courses.<code>`: the course code the pages already use (ZM, TH, ...).
- `units.<id>`: the fixed unit id from `state/units/<code>.json` (P6.1). Never says S or L.
- `kinds.<kind>`: the kind names of units.json (handout, teacher copy, master copy, deck, reader, ...).
  - `branch`: list of branches holding work on it not yet in main (empty list when none).
  - `main`: true when it is in main.
  - `preview`: the date Ali said "show mentor" (or asked for its PDFs), else null.
  - `approved`: the date Ali said "approved", else null.
- `aliases`: every label a page may hold, mapped to a unit id (or a list of ids when one atlas label
  feeds several units). Labels are written as `B<n> S<n>`, `B<n> L<n>`, `B<n> H<nn>`, `U<b>.<f>`.
  badge.js ignores case, spaces and leading zeros, and also accepts the label with the course code in front
  (`ZM B1 S1`) and the unit id itself.

A lesson's badge is its highest layer: Approved, then Preview, then In main, then Draft (on a branch).
The mentor view (the default) shows only Approved and Preview.

## S4 marks (2026-11-22, Ali's view only)
Per kind, written only when true: `held` (a held job's branch has it), `pdf` (a PDF sits beside its source),
`drive` (the Drive ledger knows a file of this kind). `badge.js` `marks()` / `marksHtml()` return them only when
the view is `all`; the mentor view shows none. The "as of" stamp turns amber after 2 hours.
