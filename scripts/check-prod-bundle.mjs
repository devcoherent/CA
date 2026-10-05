// Fails if demo-mode code or fake demo data ended up in a build.
//   node scripts/check-prod-bundle.mjs            → checks dist/ (production build) has NO demo traces
//   node scripts/check-prod-bundle.mjs dist-demo --expect-demo
//                                                 → self-test: a demo build MUST contain them,
//                                                   proving this check would catch a leak
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist'
const expectDemo = process.argv.includes('--expect-demo')

// Strings that only exist in src/demo/* (markers, fake people, fake email domain, demo UI).
const MARKERS = [
  'coherent-demo-mode-data',
  'Demo mode can never run in a production build',
  'coherent.demo.db',
  'Reset demo data',
  '@example.com',
  'Maya Chen',
  'Leo Martins',
  'Nina Okafor',
  'Riley Park',
  'Freshleaf Studio',
]

if (!fs.existsSync(dir)) {
  console.error(`✗ ${dir}/ not found. Run the build first.`)
  process.exit(1)
}

const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|mjs|css|html|json|map|txt)$/.test(e.name)) files.push(p)
  }
}
walk(dir)

const hits = []
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  for (const m of MARKERS) if (text.includes(m)) hits.push(`${f}: "${m}"`)
}

if (expectDemo) {
  if (hits.length === 0) {
    console.error(`✗ Self-test failed: the demo build in ${dir}/ contains none of the markers, so the production check would not catch a leak.`)
    process.exit(1)
  }
  console.log(`✓ Self-test: demo build contains demo markers (${hits.length} hits), so the check works.`)
  process.exit(0)
}

if (hits.length) {
  console.error(`✗ Demo code or fake data found in the production bundle (${dir}/):\n  ${hits.join('\n  ')}`)
  process.exit(1)
}
console.log(`✓ No demo code or fake data in ${dir}/ (${files.length} files checked).`)
