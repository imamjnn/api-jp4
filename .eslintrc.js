module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'prettier'],
  plugins: ['import', 'prettier'],
  parserOptions: {
    ecmaVersion: 13,
    sourceType: 'module',
  },
  rules: {
    // eslint
    'comma-dangle': 'off',
    'no-empty-function': 'off',
    'eslint-comments/no-unused-disable': 'off',

    // disabled eslint rules
    'no-void': 'off',
    'no-unused-vars': 'off',

    'prettier/prettier': 2,

    // eslint-plugin-import
    'import/first': 2,
    'import/newline-after-import': 2,
    'import/no-cycle': [2, {maxDepth: 1}],
    'import/no-duplicates': 2,
    'import/no-unresolved': 1,
  },
};
