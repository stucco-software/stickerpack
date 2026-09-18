import { execFile } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const { version } = pkg

const zip = async (name, cwd, args) => {
  await rm(`dist-extension/${name}`, { force: true })
  // -r recursive, -X drops macOS extended attributes that reviewers see as junk
  await run('zip', ['-r', '-X', '-q', `${process.cwd()}/dist-extension/${name}`, ...args], { cwd })
  const { stdout } = await run('du', ['-h', `dist-extension/${name}`])
  console.log(stdout.trim())
}

// Chrome and Firefox want manifest.json at the root of the zip, not in a folder.
await zip(`stickerpack-chrome-${version}.zip`, 'dist-extension/chrome', ['.'])
await zip(`stickerpack-firefox-${version}.zip`, 'dist-extension/firefox', ['.'])

// Mozilla requires the source when the submitted files come from a build tool. They
// rebuild it and diff, so this is the tracked tree exactly: no build output, no node_modules.
await run('git', ['archive', '--format=zip', '--output', `dist-extension/stickerpack-source-${version}.zip`, 'HEAD'])
const { stdout } = await run('du', ['-h', `dist-extension/stickerpack-source-${version}.zip`])
console.log(stdout.trim())
