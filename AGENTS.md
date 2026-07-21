# hatch.js

Vanilla JS library for template-based form processing using `<template>` elements with data binding.

## Architecture

### Entry Points

- **`hatch(e, cfg)`** — Intercepts form submissions. Prevents default, runs optional `cfg.prep` data transform, routes to `fromTemplate` for `#hash` targets. Standard submission path incomplete.
- **`hatch.fromTemplate(template, data)`** — Renders `<template>` content. Clones template, recursively processes children with `hh-for` and `hh:*` bindings.

### Template Processing

- **`processChild(child, des, data, context)`** — Clones node into destination. Processes `hh:*` attributes (data binding). Unfinished — attribute value resolution incomplete, several syntax bugs.
- **`processChildren(src, des, data, context)`** — Recursively walks child nodes. Handles `hh-for` iteration:
  - `key:list` — iterates FormData entries, sets `key` in context
  - `key:start..end` — numeric range, evaluates start/end via `evaluateExpression`
  - Descends into each cloned child

### Expression Tokenizer

- **`hatch.readToken(t)`** — Stateful token reader. State object `{ pos, src, token }`. Token types: `number`, `operator`, `group`, `identifier`, `EOF`, `unknown`.
- **`hatch.peekToken(t)`** — Non-destructive read (copies state).

### Expression Evaluator

- **`hatch.evaluateExpression(src, data, context)`** — Shunting-yard parser. Supports `+`, `-`, `*`, `/` (floor), `%`, `^`, `()`, `[]` indexing, identifiers (resolves to `context[id]` or `data.getAll(id).length`). Returns number or `{ error }`.

### Test Files

- **`hatch_test.js`** — Standalone duplicate of `evaluateExpression` (not using `hatch.` prefix). Separate test runner in `test.html` with FormData fixtures covering arithmetic, precedence, parentheses, exponentiation, modulo, floor division, identifiers, array indexing, compound expressions, whitespace, error cases, and context values.

### Known Bugs (hatch.js)

| Line | Bug |
|------|-----|
| 49, 78 | `src.slice` should be `t.src.slice` (wrong scope) |
| 277 | Missing `)` in `startsWith("hh:")` |
| 281 | `removeAttribute` missing `()` call |
| 292 | `JSON.Stringify` should be `JSON.stringify` |
| 317 | Missing `+` in `" : " JSON.stringify` |
| 353, 364 | `str` should be `expr` |
| 375 | `!err` (always truthy, is function) should be `!error` |
| 394, 402 | `unloopedClone` should be `unloopedChild` |

Plus multiple incomplete TBD sections in `processChild`.

### Backup (`backup/`)

Previous iteration. HTMX-style AJAX library:
- `hatch(src, url, des?, opts?)` — Fetches HTML, replaces destination, OOB swaps via `id` matching
- Features: debounce, timeout, AbortController, onerror/onload/onfinish callbacks, form validation, GET/POST serialization
- `backup/test.html` — Full test suite with mock `fetch`

## Status

Work in progress. Expression evaluator functional. Template renderer drafted but contains syntax bugs and incomplete features.
