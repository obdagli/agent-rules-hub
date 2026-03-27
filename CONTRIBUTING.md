# Contributing to Agent Rules Hub

Thank you for your interest in contributing to Agent Rules Hub! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to make AI coding tools easier to manage.

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in [GitHub Issues](../../issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce (for bugs)
   - Expected vs. actual behavior
   - Your environment (OS, Node version, CLI versions)

### Submitting Changes

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**
4. **Run tests**: `npm test`
5. **Commit with clear messages**: Follow conventional commits style
6. **Push to your fork**
7. **Open a Pull Request**

### Pull Request Guidelines

- Keep PRs focused on a single change
- Update documentation if you change behavior
- Add tests for new functionality
- Ensure all tests pass before requesting review
- Link related issues in your PR description

## Development Setup

```bash
# Clone your fork
git clone https://github.com/obdagli/agent-rules-hub.git
cd agent-rules-hub

# Install dependencies (minimal - mainly for testing)
npm install

# Run tests
npm test

# Start the dashboard locally
npm run dashboard
```

## Project Structure

```
agent-rules-hub/
├── dashboard/           # Web dashboard (server.mjs + static/)
├── lib/                 # Core logic modules
│   ├── hub-config.mjs   # Configuration and paths
│   ├── instructions.mjs # Instruction rendering
│   ├── state.mjs        # Dashboard state builder
│   └── opencode-config.mjs
├── scripts/             # Shell and JS scripts
├── shared/              # Source instruction files
│   ├── baseline-policy.md
│   └── overlays/
├── tests/               # Test files
└── docs/                # Documentation
```

## Coding Standards

### JavaScript/Node.js

- Use ES modules (ESM) - `.mjs` extension
- Use `async/await` over raw promises
- Prefer `const` over `let`; avoid `var`
- Handle errors gracefully with try/catch

### Shell Scripts

- Use `#!/usr/bin/env bash`
- Enable strict mode: `set -euo pipefail`
- Quote variables to prevent word splitting
- Check for required commands early

### Documentation

- Keep README.md user-focused
- Use ARCHITECTURE.md for technical details
- Update inline comments when code changes

## Adding Support for a New CLI

1. Create overlay file: `shared/overlays/newcli.md`
2. Add profile to `CLI_PROFILES` in `lib/hub-config.mjs`
3. Add evaluation logic in `evaluateProfileStatus()` in `lib/state.mjs`
4. Update bootstrap/runtime wiring if the CLI needs a managed home-path or config integration
5. Add tests in `tests/`
6. Update documentation

## Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/dashboard-state.test.mjs
```

Tests use Node.js built-in test runner (`node --test`).

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md` (if present)
3. Create git tag: `git tag v1.x.x`
4. Push tag: `git push origin v1.x.x`
5. Create GitHub release with release notes

## Questions?

Open a [Discussion](../../discussions) for general questions, or an [Issue](../../issues) for bugs and feature requests.
