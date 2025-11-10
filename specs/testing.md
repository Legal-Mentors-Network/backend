# Testing Guidelines

> **📖 For comprehensive testing documentation** including database setup, auto-copy architecture, port configuration, and troubleshooting, see [`/api/tests/README.md`](../tests/README.md).

## Core Principles

### Feature Tests
Feature tests must interact with a real database instance. No mocking of database connections or PocketBase client allowed in feature tests.

### Unit Tests
Unit tests focus on pure business logic functions. Since these functions have no external dependencies, mocking should not be necessary. Only unit test critical components.

## Test Structure

- `tests/unit/` - Pure function logic (e.g., matching algorithms, transformations)
- `tests/integration/` - Full API endpoints with real database using auto-copy test instance
