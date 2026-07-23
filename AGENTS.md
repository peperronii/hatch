# hatch.js

Vanilla JS library for template-based form processing using `<template>` elements with data binding.

## Architecture

### Entry Points

- **`hatch(e, cfg)`** — Intercepts form submissions. Prevents default, runs optional `cfg.prep` data transform, routes to `fromTemplate` for `#hash` targets. Standard submission path incomplete.
- **`hatch.fromTemplate(template, data)`** — Renders `<template>` content. Clones template, recursively processes children with `hh-for` and `hh:*` bindings.

### Template Processing

- **`processChild(child, des, data, context)`** — Clones node into destination. Processes `hh:*` attributes (data binding). Extracts bound expression but resolves it is unfinished (see below).
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

### Incomplete Features

- **`hatch()` standard submission path** — Non-hash target forms reach line 24 and do nothing.
- **`processChild` attribute binding** — Expression is parsed from `hh:*` and `attrVal` is resolved, but no attribute is set on the clone node (TODOs at lines 307, 314).
- **`fromTemplate` return value** — Returns `undefined` (no `return` statement).

### Backup (`backup/`)

Previous iteration. HTMX-style AJAX library:
- `hatch(src, url, des?, opts?)` — Fetches HTML, replaces destination, OOB swaps via `id` matching
- Features: debounce, timeout, AbortController, onerror/onload/onfinish callbacks, form validation, GET/POST serialization
- `backup/test.html` — Full test suite with mock `fetch`

## Status

Work in progress. Expression evaluator and tokenizer fully functional. Template renderer structurally complete but attribute binding and standard form submission are unfinished.
