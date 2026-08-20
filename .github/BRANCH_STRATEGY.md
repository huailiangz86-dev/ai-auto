# ============================================================
# AI auto - Git Branch Strategy
# ============================================================
#
# Branch Structure:
#
#   main              ← Production (protected, requires PR + review)
#   └── develop       ← Development integration branch (protected)
#       ├── feature/STORY-AI-001-xxx   ← Feature development
#       ├── fix/STORY-AI-007-xxx     ← Bug fixes
#       ├── refactor/xxx             ← Refactoring
#       └── docs/xxx                 ← Documentation
#
# Workflow:
#
#   1. Create feature branch from develop:
#      git checkout develop
#      git pull origin develop
#      git checkout -b feature/STORY-AI-001-xxx
#
#   2. Develop and commit (follow commit convention):
#      git add .
#      git commit -m "feat(campaign): add natural language campaign creation"
#
#   3. Push and create PR to develop:
#      git push -u origin feature/STORY-AI-001-xxx
#      # Create PR via GitHub UI
#
#   4. After PR approved and merged:
#      git checkout develop
#      git pull origin develop
#      git branch -d feature/STORY-AI-001-xxx
#
# Branch Naming:
#
#   feature/STORY-XXX-<short-description>
#   fix/STORY-XXX-<short-description>
#   refactor/<scope>-<short-description>
#   docs/<short-description>
#
# Rules:
#
#   - NEVER commit directly to main or develop
#   - All PRs require at least 1 review approval
#   - Squash merge to develop (clean history)
#   - Delete branch after merge
#   - Rebase over develop (not merge develop into feature)
#   - Keep commits atomic and well-described
#
# Release Process:
#
#   1. Create release branch from develop:
#      git checkout -b release/v1.0.0
#
#   2. Update version, changelog, final testing
#
#   3. Merge to main (create version tag):
#      git checkout main
#      git merge --no-ff release/v1.0.0
#      git tag -a v1.0.0 -m "Release v1.0.0"
#      git push origin main --tags
#
#   4. Merge back to develop:
#      git checkout develop
#      git merge --no-ff release/v1.0.0
#      git push origin develop
#
#   5. Delete release branch:
#      git branch -d release/v1.0.0
#
# ============================================================
