# Putting the books in the project's Drive resources

## Drive layout (the user's)

```
Claude/                         1evzjJHM3qV-YcKqt7ifXjxb65YdnKRUw
  01 School/                    1mRSxXDmOyppjdzvF9U6u57IFRP7KPRAH
    Classroom & Activities/     1bwhIoRzOn8EO2HkRunfzyae5CUfWADh-   ← Islamic Education / Classroom Dashboard project
    Lesson Plans & Decks/       1lEh8D1iL5oFWtAt63jIn3nsoeHRzvig2
    Timetable/                  1YhSBt9zfek-ZWCVwOW84LRQsEkECspcn
    Instagram & Designs/        1XhnEHI4IDpit4hNPeQMb652fpVMd-lIp
  02 TikTok - Islamic History/  1EqzNhwKTgryY9XSOGQaH_hYms7UZL7s7
  03 Investing/  04 Workshops & Store/  05 Reports & Research/  06 Personal/
```

## Project → folder map

| project (names the user may use) | Drive folder | id |
|---|---|---|
| islamic-dashboard, Islamic Education Dashboard, Classroom Dashboard, لوحة التربية الإسلامية | Claude / 01 School / Classroom & Activities | `1bwhIoRzOn8EO2HkRunfzyae5CUfWADh-` |
| Timetable, الجدول | Claude / 01 School / Timetable | `1YhSBt9zfek-ZWCVwOW84LRQsEkECspcn` |
| Lesson plans, decks | Claude / 01 School / Lesson Plans & Decks | `1lEh8D1iL5oFWtAt63jIn3nsoeHRzvig2` |
| TikTok Islamic history | Claude / 02 TikTok - Islamic History | `1EqzNhwKTgryY9XSOGQaH_hYms7UZL7s7` |

Project not in the map: search for it
(`mimeType = 'application/vnd.google-apps.folder' and title contains '<name>' and trashed = false`).
One clear hit: use it. Several or none: show the candidates (or the folders under `01 School`) and ask which one.
Then tell the user the row to add to this table (a skill uploaded to chat can't edit itself).

## Steps

1. **Resources folder.** Search `parentId = '<project folder id>' and title = 'Resources' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`.
   Missing: create it with `create_file` (`title: "Resources"`, `parentId: <project folder id>`,
   `mimeType: "application/vnd.google-apps.folder"`). Tell the user you created it.
2. **Skip duplicates.** For each file, search `parentId = '<Resources id>' and title = '<drive_title>' and trashed = false`.
   Found: skip it and say so.
3. **Upload** each PDF with `create_file`:
   - `title`: the manifest's `drive_title`
   - `parentId`: the Resources folder id
   - `contentMimeType`: `application/pdf`
   - `disableConversionToGoogleType`: `true`
   - `base64Content`: the manifest's `drive_upload_ref` (`sha256:<hex>:<absolute path>`). This is a **file
     reference**: do not paste base64 yourself; the app reads the file when the call runs.
   Do one file per call, smallest first, so a failure on a big file doesn't lose the others.
4. **Verify.** `get_file_metadata` on the new id: `fileSize` must equal the manifest `size`. Mismatch: say so
   and don't claim success.
5. **If uploading isn't possible** (the file reference is refused, the Drive connector is not connected, or the
   environment can't read the path): don't retry in loops. Keep the PDFs where the user can download them
   (Claude Code: tell them the path and offer to send the files; chat/Cowork: save them to the outputs folder
   so they appear as downloads), list the exact Drive folder to drop them in, and say what failed.

## Naming

`drive_title` from the script: `<Kind> - <subject> - <grade> - T<term> - <year>.pdf`, e.g.
`Student Textbook - التربية الإسلامية - الخامس - T1 - uploaded 2026-09.pdf`,
`Semester Plan - التربية الإسلامية - الخامس - T1 - 2026-27.pdf`. Keep it: later runs find duplicates by title.
