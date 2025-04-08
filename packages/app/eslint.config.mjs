import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  antfu({}, {
    files: ['script/**/*.ts'],
    rules: {
      'no-console': 'off',
      'antfu/no-top-level-await': 'off',
    },
  }),
)
