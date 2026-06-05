# PDF Output Reference

Two workflows: **generate** a PDF from content, or **fill** an existing PDF form.

---

## Generate PDF from Content

### Path 1 — HTML → PDF (recommended, zero extra deps if weasyprint available)

```bash
pip install weasyprint
```

```python
from weasyprint import HTML

HTML(string=html_content).write_pdf("output.pdf")
# or from a file:
HTML(filename="report.html").write_pdf("output.pdf")
```

`hl-visualize --html` already produces a self-contained HTML file — pipe it directly:

```python
HTML(filename=".agents/visuals/report.html").write_pdf(".agents/visuals/report.pdf")
```

### Path 2 — wkhtmltopdf CLI (no Python dep, widely available)

```bash
wkhtmltopdf input.html output.pdf

# with options
wkhtmltopdf --page-size A4 --margin-top 20mm --margin-bottom 20mm \
  input.html output.pdf
```

### Path 3 — reportlab (programmatic, no HTML needed)

```bash
pip install reportlab
```

```python
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

doc = SimpleDocTemplate("output.pdf", pagesize=A4)
styles = getSampleStyleSheet()
elements = []

elements.append(Paragraph("Report Title", styles["Title"]))
elements.append(Paragraph("Section body text...", styles["Normal"]))

table_data = [["Name", "Value"], ["Alpha", "42"], ["Beta", "17"]]
table = Table(table_data)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F2F2")]),
]))
elements.append(table)

doc.build(elements)
```

---

## Fill PDF Form Fields

Requires `pdftk` CLI (free, available on Linux/macOS/Windows via package manager).

```bash
# Install
brew install pdftk-java          # macOS
sudo apt install pdftk           # Linux
# Windows: download from pdflabs.com/tools/pdftk-the-pdf-toolkit/
```

### Step 1 — Detect form fields

```bash
pdftk form.pdf dump_data_fields
```

Output shows all field names and types:
```
FieldType: Text
FieldName: first_name
FieldValue:
---
FieldType: Text
FieldName: last_name
```

### Step 2 — Create FDF data file

```python
def create_fdf(fields: dict[str, str]) -> str:
    """Generate FDF format for pdftk fill_form."""
    entries = "\n".join(
        f"<< /T ({k}) /V ({v}) >>" for k, v in fields.items()
    )
    return f"%FDF-1.2\n1 0 obj\n<< /FDF << /Fields [{entries}] >> >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"

fdf_content = create_fdf({
    "first_name": "John",
    "last_name": "Doe",
    "date": "2026-06-02",
})

with open("data.fdf", "w") as f:
    f.write(fdf_content)
```

Or from JSON input:
```python
import json

with open("data.json") as f:
    fields = json.load(f)  # {"first_name": "John", ...}

fdf_content = create_fdf(fields)
```

### Step 3 — Fill and flatten

```bash
# Fill (keeps fields editable)
pdftk form.pdf fill_form data.fdf output filled.pdf

# Fill and flatten (fields become static text, form locked)
pdftk form.pdf fill_form data.fdf output filled.pdf flatten
```

---

## Open After Save

```bash
open output.pdf       # macOS
xdg-open output.pdf   # Linux
start output.pdf      # Windows
```
