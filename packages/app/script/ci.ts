import fs from 'node:fs/promises'
import process from 'node:process'

if (process.env.CI) {
  const content = Object.entries(process.env)
    .filter(([k]) => k.startsWith('NITRO'))
    .map(([k, v]) => `${k}="${v}"`)
    .concat(['NITRO_TEST=true', `GITHUB_TOKEN=${process.env.GITHUB_TOKEN!}`])
    .join('\n')
  await fs.writeFile('.dev.vars', content)
}
