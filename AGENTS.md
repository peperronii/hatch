# hatch.js

A vanilla JS library for template-based form processing using `<template>` elements with data binding.

## Architecture

- **`hatch(e, cfg)`** — Intercepts form submissions, optionally preprocesses data via `cfg.prep`, then routes to `hatchFromTemplate` for hash targets or performs standard submission.
- **`hatchFromTemplate(templateSelector, data)`** — Renders an HTML `<template>` element using a `FormData` object. Supports:
  - **`hh-for` attribute** — Iteration construct (similar to Vue's `v-for`), supporting `item : list` and `i..j` range syntax.
  - **Math expressions** — In-template expressions evaluated by `evaluateMathExpression` (tokenizer + shunting-yard parser supporting `+`, `-`, `*`, `/`, `%`, `^`, `()`, `[]` for array indexing).
- **`evaluateMathExpression(data, expression)`** — Standalone math expression evaluator used during template rendering.

- **`backup/`** — Contains old/previous implementation of the hatch idea (hatch.js and test.html).

## Status

Work in progress. Some features are partially implemented and contain known bugs.
