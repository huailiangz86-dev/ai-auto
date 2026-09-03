# Code Quality Workflow

Apply the following skills when their trigger conditions are met:

## Security Review

- For requests that explicitly ask for a security review, secure-by-default implementation, or security best-practices guidance in Python, JavaScript, TypeScript, or Go, use the `security-best-practices` skill before proposing or applying changes.
- Do not invoke this skill for general debugging or ordinary code review unless the request has a security focus.

## GitHub Actions Failures

- When a GitHub pull request check running in GitHub Actions fails, use the `gh-fix-ci` skill to inspect the failing check and its logs, summarize the likely cause, and propose a fix plan.
- Require explicit user approval before modifying code. Do not use this skill for non-GitHub Actions providers or for ordinary development work without a failing CI check.
