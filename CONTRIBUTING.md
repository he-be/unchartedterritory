# Contributing to Uncharted Territory

## Development Workflow

This project follows a standard GitHub flow with proper CI/CD integration.

### Branch Strategy

1. **Main Branch**: `main`
   - Protected branch
   - Only accepts PRs that pass all checks
   - Automatically deploys to production when merged

2. **Feature Branches**: `feature/feature-name` or `bugfix/issue-description`
   - Create from latest `main`
   - All development work happens here
   - Must pass CI checks before merging

### Development Process

1. **Create Feature Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following project conventions
   - Add/update tests for your changes
   - Ensure all existing tests pass

3. **Local Testing** (Required before pushing)
   ```bash
   npm run lint        # Check code style
   npm run typecheck   # Check TypeScript types
   npm test            # Run all tests
   npm run test:coverage # Ensure coverage requirements
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "descriptive commit message"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create PR via GitHub UI
   ```

6. **PR Review Process**
   - CI/CD automatically runs all checks
   - Coverage report is generated and commented on PR
   - All checks must pass (✅) before merge
   - Code review by team members

7. **Merge and Deploy**
   - After approval and passing checks, merge to `main`
   - Automatic deployment to Cloudflare Workers
   - Delete feature branch after merge

### CI/CD Pipeline

#### On Pull Request
- ✅ ESLint (code style)
- ✅ TypeScript (type checking)
- ✅ Unit tests (all 36+ tests)
- ✅ Coverage report (≥50% required)
- ✅ Build verification
- 📊 Coverage report commented on PR

#### On Main Branch Push
- All PR checks +
- 🚀 Deploy to Cloudflare Workers (backend)
- 🚀 Deploy to Cloudflare Workers (frontend)

### Quality Requirements

- **Test Coverage**: Minimum 50% (currently 67%+)
- **All Tests Pass**: No skipped tests allowed
- **ESLint**: No linting errors
- **TypeScript**: No type errors
- **Build**: Must build successfully

### Pre-commit Hooks

The project uses Husky for pre-commit hooks that automatically run:
- `npm run lint`
- `npm run typecheck` 
- `npm test`

This ensures you can't commit broken code.

### Testing Guidelines

- Write tests for all new features
- Update existing tests when modifying functionality
- Aim for high test coverage
- Use descriptive test names
- Test both success and error cases

### Example PR Flow

```bash
# 1. Start new feature
git checkout -b feature/new-ship-types

# 2. Make changes and test locally
npm test
npm run lint
npm run typecheck

# 3. Commit and push
git add .
git commit -m "Add new ship types with enhanced capabilities"
git push origin feature/new-ship-types

# 4. Create PR via GitHub
# 5. Wait for CI checks ✅
# 6. Request review
# 7. Merge after approval
# 8. Automatic deployment 🚀
```

This workflow ensures:
- ✅ Code quality through automated checks
- ✅ No broken code in main branch
- ✅ Automatic deployment of tested code
- ✅ Clear development process
- ✅ Team collaboration through PRs