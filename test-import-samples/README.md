# Import Sample Pack (6 Question Types)

Files in this folder:
- sample_import_6types.txt
- sample_import_6types.docx
- sample_import_6types.pdf

All 3 files contain the same 6 questions:
1. True/False (multiple statements)
2. Single correct answer
3. Multiple correct answers
4. Drag-drop by position
5. Arrange words
6. Fill in the blank

## Quick import flow

1. Open Admin -> Câu hỏi -> Import tài liệu.
2. Select one of the files above.
3. Choose a target lesson (or auto mode), then preview.
4. Confirm import.
5. Reload page and verify data still exists.

## Expected parser result summary

- Total parsed: 6
- Valid importable: 6 (on empty destination)
- Invalid format: 0

### Expected type per question

- Cau 1: single
- Cau 2: multiple
- Cau 3: truefalse (3 statements)
- Cau 4: drag (position order from answer key)
- Cau 5: match (arrange words)
- Cau 6: fill

## Notes

- Star marker (*) is used on correct options and should be removed after save.
- Math characters are intentionally present: comma, apostrophe-safe text, equals, percent.
- PDF and DOCX files were validated for text extraction in this workspace toolchain.
