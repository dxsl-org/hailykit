# Extracting Content from Office Documents

Quick reference for reading content from Word, PDF, PowerPoint, and Excel files.

## Word (.docx) → Markdown

```bash
# Extract text (preserve tracked changes)
pandoc --track-changes=all file.docx -o output.md

# Accept all changes, plain markdown
pandoc file.docx -o output.md
```

## PDF → Text / Tables

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    text = "\n".join(p.extract_text() for p in pdf.pages)
    tables = [t for p in pdf.pages for t in p.extract_tables()]
```

```bash
# CLI (preserves layout)
pdftotext -layout input.pdf output.txt
```

## PowerPoint (.pptx) → Markdown

```bash
python -m markitdown file.pptx > output.md
```

## Excel (.xlsx) → Data

```python
import pandas as pd

df = pd.read_excel("file.xlsx")                           # first sheet
all_sheets = pd.read_excel("file.xlsx", sheet_name=None)  # all sheets as dict
df.to_csv("output.csv", index=False)
```

## Any Format → Markdown (native multimodal reading)

Read PDF/Office/image files directly using the Read tool — no external API required.

```
# PDF: use the pages parameter for large documents
Read(file_path="document.pdf", pages="1-10")

# Images: Read directly to extract visual content
Read(file_path="image.png")
```

Use `hc:docs extract <file>` to extract any document format to structured markdown.
