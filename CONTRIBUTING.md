# Contributing to Stellar Footprint Service

Thank you for your interest in contributing to the Stellar Footprint Service! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style and Standards](#code-style-and-standards)
- [Testing](#testing)
- [Dependency Management](#dependency-management)
- [Pull Request Process](#pull-request-process)
- [Commit Guidelines](#commit-guidelines)
- [Branch Naming](#branch-naming)
- [Reporting Issues](#reporting-issues)
- [Documentation](#documentation)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please be respectful and constructive in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/Stellar-Footprint-Service.git
   cd Stellar-Footprint-Service
   ```
3. **Set up the development environment** (see below)
4. **Create a feature branch** for your changes
5. **Make your changes** following the guidelines
6. **Test your changes** thoroughly
7. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 20.x
- npm (comes with Node.js)
- Git

### Installation

1. **Install dependencies:**
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   npm ci
   ```

2. **Set up environment variables:**
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project:**
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   npm run build
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the TypeScript project
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run solhint` - Lint Solidity files (if applicable)

## Project Structure

```
├── src/
│   ├── index.ts              # Application entry point
│   ├── api/
│   │   ├── controllers.ts    # API controllers
│   │   └── routes.ts         # API routes
│   ├── config/
│   │   └── stellar.ts        # Stellar network configuration
│   ├── middleware/
│   │   ├── metrics.ts        # Prometheus metrics middleware
│   │   └── timeout.ts        # Request timeout middleware
│   └── services/
│       ├── footprintParser.ts # Footprint parsing logic
│       ├── optimizer.ts       # Optimization algorithms
│       └── simulator.ts       # Transaction simulation
├── monitoring/
│   ├── grafana/              # Grafana dashboards and configuration
│   ├── prometheus.yml        # Prometheus configuration
│   └── IMPLEMENTATION_SUMMARY.md
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI pipeline
├── docker-compose.prod.yml   # Production Docker setup
├── Dockerfile                # Container definition
├── healthcheck.js            # Health check script
└── package.json              # Dependencies and scripts
```

## Development Workflow

1. **Choose an issue** from the [issue tracker](https://github.com/Dafuriousis/Stellar-Footprint-Service/issues)
2. **Create a branch** following the [branch naming conventions](#branch-naming)
3. **Implement your changes** with proper tests
4. **Run the test suite** and ensure all tests pass
5. **Run linting and formatting** checks
6. **Commit your changes** following [commit guidelines](#commit-guidelines)
7. **Push your branch** and create a pull request
8. **Address review feedback** if any
9. **Merge** once approved

## Code Style and Standards

This project uses several tools to maintain code quality:

### ESLint
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- Configured in `eslint.config.mjs`
- Run `npm run lint` to check for issues
- Run `npm run lint:fix` to auto-fix issues
- Only `console.warn` and `console.error` are allowed (not `console.log`)

### Prettier
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- Configured in `prettier.config.cjs`
- Run `npm run format` to format code
- Run `npm run format:check` to check formatting

### TypeScript
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- Strict type checking enabled
- Configuration in `tsconfig.json`
- All new code must be properly typed

### Pre-commit Hooks
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- Husky is used to run pre-commit checks
- Commits will be rejected if linting fails
- Branch names are validated automatically

## Testing

### Running Tests
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
```bash
npm test
```

### Test Coverage
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- Aim for high test coverage
- Include unit tests for all new functions
- Include integration tests for API endpoints
- Test both success and error scenarios

### Testing Guidelines
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- Write tests before implementing features (TDD when possible)
- Use descriptive test names
- Test edge cases and error conditions
- Mock external dependencies appropriately

## Dependency Management

This project uses exact versions for all dependencies to ensure reproducible builds.

### Updating Dependencies

1. **Check for updates:**
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   npm outdated
   ```

2. **Update package.json** with new exact versions:
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```json
   {
     "dependency": "1.2.3"
   }
   ```

3. **Update lockfile:**
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   npm install
   ```

4. **Test thoroughly** that everything still works

5. **Commit both** `package.json` and `package-lock.json`

### Adding Dependencies

1. **Install the package:**
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   npm install --save exact-package@1.2.3
   ```

2. **Verify the exact version** is in `package.json`

3. **Test the integration**

## Pull Request Process

1. **Ensure your branch** is up to date with `main`
2. **Run all checks** locally:
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
   ```bash
   npm run lint
   npm run format:check
   npm run build
   npm test
   ```

3. **Create a pull request** with:
   - Clear title describing the change
   - Detailed description of what was changed and why
   - Reference to any related issues
   - Screenshots/videos if UI changes

4. **Address review comments** promptly

5. **Squash commits** if requested before merging

### PR Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No linting errors
- [ ] Dependencies are properly managed
- [ ] Breaking changes are documented

## Commit Guidelines

This project follows conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(api): add batch simulation endpoint
fix(metrics): correct cache hit counter
docs(readme): update installation instructions
refactor(optimizer): simplify algorithm complexity
test(simulator): add edge case coverage
chore(deps): update TypeScript to 5.3.2
```

### Commit Messages

- Use present tense ("add" not "added")
- Keep the subject line under 50 characters
- Use the body for detailed explanations if needed
- Reference issues with `#123`

## Branch Naming

Branch names must follow this pattern:

- `main`, `develop`, `live` (protected branches)
- Prefixed branches: `feature/`, `fix/`, `refactor/`, `hotfix/`, `release/`, `conflict/`, `chore/`

Examples:
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======

>>>>>>> theirs
=======

>>>>>>> theirs
- `feature/add-batch-simulation`
- `fix/memory-leak-issue`
- `chore/update-dependencies`
- `refactor/simplify-optimizer`

Branch names are validated by pre-commit hooks.

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

- **Clear title** describing the issue
- **Steps to reproduce** the problem
- **Expected behavior** vs actual behavior
- **Environment details** (Node version, OS, etc.)
- **Error messages** and stack traces
- **Screenshots** if applicable

### Feature Requests

For new features, please:

- **Describe the problem** you're trying to solve
- **Explain your proposed solution**
- **Consider alternative approaches**
- **Discuss potential impacts**

## Documentation

### Code Documentation

- Use JSDoc comments for functions and classes
- Keep comments up to date with code changes
- Explain complex algorithms and business logic

### README Updates

- Update README.md for significant changes
- Include examples for new features
- Keep installation and usage instructions current

### API Documentation

- Document all API endpoints in README.md
- Include request/response examples
- Specify error codes and messages

---

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
Thank you for contributing to Stellar Footprint Service! Your efforts help make this tool better for the entire Stellar community. 🚀
=======
Thank you for contributing to Stellar Footprint Service! Your efforts help make this tool better for the entire Stellar community. 🚀
>>>>>>> theirs
=======
Thank you for contributing to Stellar Footprint Service! Your efforts help make this tool better for the entire Stellar community. 🚀
>>>>>>> theirs
=======
Thank you for contributing to Stellar Footprint Service! Your efforts help make this tool better for the entire Stellar community. 🚀
>>>>>>> theirs
=======
Thank you for contributing to Stellar Footprint Service! Your efforts help make this tool better for the entire Stellar community. 🚀
>>>>>>> theirs
