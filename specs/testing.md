# Testing Guidelines

## Core Principles

### Feature Tests
Feature tests must interact with a real database instance. No mocking of database connections or PocketBase client allowed in feature tests.

### Unit Tests
Unit tests focus on pure business logic functions. Since these functions have no external dependencies, mocking should not be necessary.

## Test Structure

- `tests/unit/` - Pure function logic (e.g., matching algorithms, transformations)
- `tests/integration/` - Full API endpoints with real database (deferred until DB setup complete)
