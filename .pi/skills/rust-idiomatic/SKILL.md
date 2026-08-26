---
name: rust-idiomatic
description: Write, review, and refactor Rust code using concise idiomatic control flow, iterators, error handling, imports, conversions, documentation, and tests. Use for changes to Rust source, Cargo projects, Rust CLI or async I/O code, and Rust code reviews where minimal targeted changes and standard Rust conventions are required.
---

# Idiomatic Rust Patterns

Implement exactly the requested behavior and specified edge cases. Reuse existing
project patterns and dependencies; avoid speculative features, abstractions, and
unrelated refactors.

## Write concise control flow

- Propagate convertible errors with `?`; do not spell out `match` or
  `map_err(Error::from)`.
- Use `if let` for one relevant pattern and `while let` for repeated matching.
- Prefer iterator chains and combinators such as `filter_map`, `flatten`, and
  `fold` when they are clearer than a manual loop and avoid needless
  intermediate collections.
- Prefer destructuring, struct update syntax (`..value`), and `From`/`Into`.
- Use `AsRef`/`AsMut` bounds when callers genuinely benefit from accepting
  multiple borrowed input forms; do not add generic flexibility speculatively.

```rust
let file = File::open("data.txt")?;

if let Some(value) = option {
    use_value(value);
}

while let Some(item) = iterator.next() {
    process(item);
}

let results: Vec<_> = items
    .iter()
    .filter(|item| item.is_valid())
    .map(|item| item.process())
    .collect();
```

Do not force a chain when a loop is more readable, needs early exits, or carries
complex mutable state.

## Handle errors

- Use `?` when `From` or a `#[from]` variant already converts the error.
- Use `map_err` only for a genuinely custom transformation or added context.
- Prefer `thiserror` for typed library/domain errors and `anyhow` for
  application-level context when the project already uses them.
- Use `ok_or`, `ok_or_else`, `and_then`, and `or_else` when they make a flow
  shorter and clearer.

```rust
let file = File::open("data.txt")
    .map_err(|error| NoteError::IoWithContext(error, "failed to open config"))?;
```

## Follow project and language conventions

- Use `snake_case` for functions and variables and `UpperCamelCase` for types.
- Group imports from the same crate and import types used in signatures:

```rust
use mdnotes_lib::{
    repository::{fs::FileSystemRepository, NoteRepository},
    NoteError, Result,
};
```

- Derive `Debug`, `Clone`, and `PartialEq` only where useful.
- Use `async`/`.await` for I/O in an existing async path; do not introduce an
  async runtime solely to satisfy this preference.
- Document public APIs with `///`, including useful examples and relevant
  `# Errors` and `# Panics` sections.

## Test the behavior

Write the smallest failing test first, then implement the change. Put unit tests
in `#[cfg(test)]` modules. Reuse existing `tempfile` filesystem-test and
`assert_cmd` CLI-test patterns; do not add either dependency unless the task
needs it.

## Verify every Rust change

Run from the relevant Cargo workspace root:

```bash
cargo fmt
cargo clippy
cargo test
```

Use `cargo test --all` when the repository's workspace or acceptance criteria
require it. Fix all Clippy warnings and errors, rerun formatting after fixes,
and report any check that cannot run.