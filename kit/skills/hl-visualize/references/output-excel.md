# Excel Output Reference

Generate `.xlsx` files using `openpyxl`. No Excel installation required.

## Install

```bash
pip install openpyxl
```

## Basic Workbook

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = Workbook()
ws = wb.active
ws.title = "Report"

# Write headers
headers = ["Name", "Value", "Status"]
for col, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col, value=header)
    cell.font = Font(bold=True)
    cell.fill = PatternFill("solid", fgColor="4472C4")
    cell.font = Font(bold=True, color="FFFFFF")

# Write data rows
data = [["Alpha", 42, "OK"], ["Beta", 17, "Warning"]]
for row_idx, row in enumerate(data, 2):
    for col_idx, value in enumerate(row, 1):
        ws.cell(row=row_idx, column=col_idx, value=value)

# Auto-fit column widths
for col in ws.columns:
    max_len = max(len(str(cell.value or "")) for cell in col)
    ws.column_dimensions[get_column_letter(col[0].column)].width = min(max_len + 2, 50)

wb.save("output.xlsx")
```

## Bar / Line Chart

```python
from openpyxl.chart import BarChart, Reference

chart = BarChart()
chart.type = "col"
chart.title = "Monthly Revenue"
chart.y_axis.title = "Amount"
chart.x_axis.title = "Month"

data_ref = Reference(ws, min_col=2, min_row=1, max_row=ws.max_row)
cats_ref = Reference(ws, min_col=1, min_row=2, max_row=ws.max_row)
chart.add_data(data_ref, titles_from_data=True)
chart.set_categories(cats_ref)
chart.shape = 4
ws.add_chart(chart, "E2")
```

## Pivot-Style Summary

```python
from collections import defaultdict

# Group and sum — then write as a summary sheet
summary = defaultdict(float)
for row in ws.iter_rows(min_row=2, values_only=True):
    category, amount = row[0], row[1]
    summary[category] += amount

ws_pivot = wb.create_sheet("Summary")
ws_pivot.append(["Category", "Total"])
for cat, total in sorted(summary.items()):
    ws_pivot.append([cat, total])
```

## Named Table (Excel Table with filtering)

```python
from openpyxl.worksheet.table import Table, TableStyleInfo

table = Table(
    displayName="DataTable",
    ref=f"A1:{get_column_letter(len(headers))}{len(data) + 1}"
)
table.tableStyleInfo = TableStyleInfo(
    name="TableStyleMedium9", showFirstColumn=False,
    showLastColumn=False, showRowStripes=True, showColumnStripes=False
)
ws.add_table(table)
```

## Formula Recalculation

`openpyxl` writes formulas as strings — Excel recalculates on open. For offline recalculation:

```bash
pip install formulas
```

```python
import formulas

xl_model = formulas.ExcelModel().loads("workbook.xlsx").finish()
xl_model.calculate()
xl_model.to_excel("recalculated.xlsx")
```

## Open After Save

```bash
# macOS
open output.xlsx

# Linux
xdg-open output.xlsx

# Windows
start output.xlsx
```
