// ============================================================
// lint-staged configuration
// ============================================================

module.exports = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{json,css,md,yml,yaml}': [
    'prettier --write',
    'git add',
  ],
};
