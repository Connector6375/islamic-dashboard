# elibrary.moe.edu.kw: what the script talks to

The site's pages (`/TeachersLibrary`, `/StudentsLibrary`) are search forms that call a small JSON API
(read from `/app/app_teacherslibrary.js`). No login is needed for these calls.

| call | purpose |
|---|---|
| `GET /api/LibraryLookups/EducationTypes` | `{"data":[{"value":8,"text":"التعليم العام"}, …]}` |
| `GET /api/LibraryLookups/EducationStages/{typeId}` | stages (الابتدائية = 24 under type 8) |
| `GET /api/LibraryLookups/EducationGrades/{stageId}` | grades (الخامس = 59 under stage 24) |
| `GET /api/LibraryLookups/EducationSubjects/{gradeId}` | subjects (التربية الإسلامية = 285 for grade 59) |
| `POST /api/librarysearch` | body below; returns `{books, videos, examFiles}` |
| `GET /api/File/preview/book/{bookFileID}` | the PDF itself |

Search body: `{"BooksFor":1|2,"MoeYear":2023,"EducationTypeID":8,"EducationStageID":24,"EducationGradeID":59,"EducationSubjectID":285,"Term":1|2}`

- `BooksFor`: **1 = student library**, **2 = teacher library** (the page used at `/TeachersLibrary` sends 2).
- `MoeYear` is a constant 2023 in the site's own code; it does not filter by school year.
- A book row: `bookFileID`, `fileDescription` (the Arabic title, what the script classifies on), `term`,
  `createdDate`, `downloadCount`, `uploadedFileName`, `flipBookUrl`.
- Other lists on the site (`/documents`, `/MoePublications`, `/SupervisoryJobNotes`) are separate pages and are
  not covered by this skill.

If the script stops working: re-read `/app/app_teacherslibrary.js` and `/app/app_studentslibrary.js` (if present)
for changed endpoints or field names, and fix `scripts/elibrary.py`.
