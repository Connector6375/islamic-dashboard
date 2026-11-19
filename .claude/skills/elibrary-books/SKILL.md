---
name: elibrary-books
description: Get books from the Kuwait Ministry of Education e-library (المكتبة الالكترونية, elibrary.moe.edu.kw) and file them in a project's Google Drive resources. Finds and tells apart the student textbook (كتاب الطالب), teacher's guide (دليل المعلم) and semester plan / curriculum distribution plan (خطة توزيع المنهج) for a stage, grade, subject and term, downloads the PDFs and uploads them to the project's Drive Resources folder. Use whenever the user asks to get, download, fetch, find or update a textbook, teacher guide or semester plan from the e-library, mentions المكتبة الالكترونية or elibrary.moe.edu.kw, or asks for the books/plan of a grade or subject for a project.
---

# Kuwait MOE e-library → project Drive resources

Works the same in Claude Code, claude.ai chat and Cowork: everything is done with one standard-library
Python script (`scripts/elibrary.py`) plus the Google Drive connector.

## Workflow

1. **Pin down the request.** Needed: subject, grade (and stage), term (1, 2 or both), and **which project**
   the files belong to. Defaults: type التعليم العام, kinds = student textbook + teacher guide + semester plan,
   both terms. Ask only for what is missing (usually the project). If the user names one kind, fetch only it.
2. **Check the network.** `python3 scripts/elibrary.py check`. If it fails with a 403 / proxy error the sandbox
   does not allow the host: tell the user to allow `elibrary.moe.edu.kw` (Claude Code on the web: the
   environment's allowed hosts; claude.ai chat/Cowork: the code-execution network allowlist) and stop until it
   is allowed. Never disable TLS checks.
3. **Find.** `python3 scripts/elibrary.py find --stage الابتدائية --grade الخامس --subject "التربية الإسلامية" --term all`
   (names may be Arabic with or without diacritics, or numeric ids; `lookups` lists the options when a name is
   not recognised). Show the user what the library has, grouped by kind, and say which one you would take.
   See "How files are told apart" below.
4. **Fetch.** `python3 scripts/elibrary.py fetch ... --out <dir>` downloads the newest file of each wanted kind
   (per term) and writes `<dir>/manifest.json` with `drive_title`, `file`, `size`, `sha256` and
   `drive_upload_ref`. Use a fresh empty directory (in Claude Code: the scratchpad; in chat: the outputs folder).
   Report any `note` (e.g. "dated 2025-26 but the current year ends 2027") to the user: the library may not
   have this year's edition yet.
5. **Drive.** Follow `references/drive.md`: find the project's folder, make sure it has a `Resources` subfolder,
   skip files already there, upload each PDF, check the size, give the user the links.
6. **Report** in a short table: kind, term, edition/year, Drive link; plus anything skipped or stale.

## How files are told apart

The library has two shelves per selection: **student library** (`BooksFor` 1) and **teacher library** (2).
The script searches both and classifies by the Arabic title:

| kind | rule |
|---|---|
| `semester_plan` | title has «توزيع المنهج» |
| `teacher_guide` | title has «دليل المعلم» |
| `student_textbook` | student shelf, not a workbook; usually titled just with the subject («… القسم الأول و القسم الثاني») |
| `student_workbook` | student shelf and «نشاط» / «كراس» in the title |

- Titles mentioning «بطء تعلم / فصول خاصة» are **special-class variants**: skipped unless the user asks
  (`--include-special`).
- Several candidates of one kind: the newest upload wins. Years in titles are normalised: «2026/2025» means
  2025-26 (the library writes some RTL years reversed).
- A kind missing for a term (often the term-2 student book early in the year) is simply reported as not
  uploaded yet; do not substitute another file.
- Terms: the teacher guide is usually one file listed under both terms, the textbook is per term.

## Rules

- Download only; never log in, bypass access limits or re-share the files beyond the user's own Drive.
- Don't overwrite or delete anything in Drive: if a file with the same title exists, skip it and say so
  (replace only if the user asks).
- Files are for the teacher's own classroom use; mention nothing else about copyright unless asked.
- Large PDFs (50 MB+) are normal: never print their contents or base64 into the conversation.

## Files

- `scripts/elibrary.py`: `check`, `lookups`, `find`, `fetch`, `download` (run with `python3`, no installs).
- `references/drive.md`: the Drive steps and the project → folder map (update it when a new project appears).
- `references/api.md`: the library's endpoints, for when the script needs fixing.
