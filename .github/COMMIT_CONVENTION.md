# ============================================================
# AI auto - Git Commit Message Convention
# ============================================================
#
# Format: <type>(<scope>): <subject>
#
# Types:
#   feat    - New feature
#   fix     - Bug fix
#   docs    - Documentation only
#   style   - Formatting, no code change
#   refactor - Code restructure, no behavior change
#   test    - Adding/updating tests
#   chore   - Build, CI, dependency updates
#   perf    - Performance improvement
#   ci      - CI configuration
#   revert  - Revert previous commit
#
# Examples:
#   feat(auth): add SMS login with verification code
#   fix(commission): correct T+3 settlement calculation
#   docs(prd): update functional requirements
#   refactor(attribution): simplify lock period logic
#
# Subject:
#   - Use imperative mood ("add" not "added")
#   - No period at end
#   - Max 72 characters
#   - Describe WHAT changed, not HOW
#
# Scope (optional):
#   Use affected module: auth, merchant, agent, campaign,
#   commission, content, customer, admin, ai, infra
#
# Breaking changes:
#   feat(auth)!: change token expiry from 1h to 15m
#   Or add BREAKING CHANGE: in footer
#
# Body (optional):
#   Explain WHY the change was made, not HOW.
#   Wrap at 72 characters.
#
# Footer (optional):
#   Reference issues: Closes #123
#   Breaking changes: BREAKING CHANGE: ...
#
# ============================================================
