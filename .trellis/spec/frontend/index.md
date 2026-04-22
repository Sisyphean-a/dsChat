# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains executable frontend conventions for this project.
Use these files as contracts, not as optional reference text.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Documented |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Documented |
| [Style Baseline](./style-baseline.md) | Visual tokens, spacing rhythm, and anti-drift review rules | Documented |
| [Provider Chat Contract](./provider-chat-contract.md) | Multi-provider settings, persistence, request payload, and stream parsing contract | Documented |
| [Hook Guidelines](./hook-guidelines.md) | Composable boundaries and orchestration rules | Documented |
| [State Management](./state-management.md) | Local state, global state, server state | Documented |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Documented |
| [Type Safety](./type-safety.md) | Type patterns, normalization, mutation boundaries | Documented |

---

## How to Fill These Guidelines

Before modifying frontend code:

1. Read the guides listed above that match your change scope.
2. If the change touches visual output, read `style-baseline.md` first.
3. If the change touches composable orchestration, read `hook-guidelines.md` first.
4. If contracts changed, update the corresponding spec in the same PR.
