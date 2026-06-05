---
name: tech-tool-design
description: Tool design for agent systems — consolidation principle, four-question description framework, error message design, concise vs. detailed response formats.
---

# Tool Design

Design tools that agents use reliably and efficiently.

## Consolidation Principle

Fewer, well-documented tools outperform many narrow tools. Target: 10–20 tools maximum.

**Evidence from tool-count reduction (17 → 2 tools):**

| Metric | 17 Tools | 2 Tools | Delta |
|--------|----------|---------|-------|
| Task time | 274.8s | 77.4s | 3.5× faster |
| Success rate | 80% | 100% | +20% |
| Token usage | 102k | 61k | 37% fewer |

Good documentation replaces tool sophistication. An agent calling the right general tool with good instructions beats an agent navigating 17 narrow tools.

## When Consolidation Works

**Prerequisites:** high-quality documentation, capable model, well-defined problem domain

**Avoid consolidating when:** the system is messy and undocumented, the domain is highly specialized, or safety constraints require strict isolation between operations.

## Four-Question Description Framework

Every tool description must answer:
1. **What** does the tool do?
2. **When** should it be used vs. alternatives?
3. **What inputs** does it accept, and what format?
4. **What** does it return, including error cases?

### Good Example

```json
{
  "name": "get_customer",
  "description": "Retrieve a customer profile by ID. Use for order processing and support flows — not for bulk exports. Returns the customer object, or 404 if the ID does not exist.",
  "parameters": {
    "customer_id": {"type": "string", "pattern": "^CUST-[0-9]{6}$", "description": "Six-digit customer ID with CUST- prefix"},
    "format": {"enum": ["concise", "detailed"], "description": "concise returns name+email; detailed returns full profile"}
  }
}
```

### Poor Example

```json
{"name": "search", "description": "Search for things", "parameters": {"q": {}}}
```

The poor example answers none of the four questions. An agent must guess when to use it, what to pass, and what to expect back.

## Error Message Design

Errors should tell the agent what went wrong and how to fix it:

```python
def format_error(code, message, resolution, retryable):
    return {
        "error": {
            "code": code,
            "message": message,
            "resolution": resolution,
            "retryable": retryable
        }
    }

# Good: "Use YYYY-MM-DD format, e.g., '2024-01-05'"
# Poor: "Invalid date"
```

## Response Formats

Offer concise and detailed variants to let the agent control token usage:

```python
def get_customer(id, format="concise"):
    customer = db.fetch(id)
    if format == "concise":
        return {"id": customer.id, "name": customer.name}
    return customer.full_profile()
```

Default to `concise`. The agent requests `detailed` only when the full data is needed.

## Guidelines

1. Target 10–20 tools; consolidate aggressively before adding new ones
2. Answer all four questions in every description
3. Use full, descriptive parameter names — never single letters
4. Design errors to enable recovery, not just report failure
5. Offer concise/detailed format options on data-retrieval tools
6. Test each tool with an agent before deploying to catch description gaps
7. Start minimal; add capability only when an agent demonstrably needs it

## Related

- `tech-fundamentals.md` — tool definitions in the context anatomy
- `tech-multi-agent.md` — tool design for multi-agent coordination
