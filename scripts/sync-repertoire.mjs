import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const CONFIG_PATH = path.join(ROOT, 'repertoire.sources.json')
const OUTPUT_DIR = path.join(ROOT, 'public', 'repertoire')
const IMPORT_DIR = path.join(OUTPUT_DIR, 'imported')
const CATALOG_PATH = path.join(OUTPUT_DIR, 'catalog.json')
const TAB_PATTERN = /\.(gp|gp3|gp4|gp5|gpx|gp7)$/i
const MAX_FILE_BYTES = 8 * 1024 * 1024
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

function headers() {
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'GuitarrStudio-Repertoire-Sync',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function githubJson(url) {
  const response = await fetch(url, { headers: headers() })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} · ${url}`)
  return response.json()
}

function safeSegment(value) {
  return value.replace(/[^a-z0-9._-]+/gi, '-')
}

async function syncRepository(source) {
  if (!source.license || source.license.toLowerCase() === 'unknown') {
    throw new Error(`${source.repository}: falta una licencia o permiso verificable`)
  }

  const metadata = await githubJson(`https://api.github.com/repos/${source.repository}`)
  const branch = source.branch || metadata.default_branch
  const tree = await githubJson(
    `https://api.github.com/repos/${source.repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  )
  if (tree.truncated) throw new Error(`${source.repository}: GitHub truncó el árbol; usa rutas más específicas`)

  const candidates = tree.tree
    .filter((entry) => entry.type === 'blob' && TAB_PATTERN.test(entry.path))
    .filter((entry) => !entry.size || entry.size <= (source.maxFileBytes || MAX_FILE_BYTES))
    .filter((entry) => !source.pathPrefix || entry.path.startsWith(source.pathPrefix))
    .slice(0, source.maxFiles || 250)

  const songs = []
  for (const entry of candidates) {
    const rawUrl = `https://raw.githubusercontent.com/${source.repository}/${branch}/${entry.path.split('/').map(encodeURIComponent).join('/')}`
    const response = await fetch(rawUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!response.ok) throw new Error(`${source.repository}/${entry.path}: descarga ${response.status}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const extension = path.extname(entry.path).toLowerCase()
    const stem = safeSegment(path.basename(entry.path, extension))
    const repoDirectory = safeSegment(source.repository.replace('/', '--'))
    const targetDirectory = path.join(IMPORT_DIR, repoDirectory)
    const targetName = `${stem}-${sha256.slice(0, 10)}${extension}`
    await mkdir(targetDirectory, { recursive: true })
    await writeFile(path.join(targetDirectory, targetName), bytes)

    songs.push({
      id: sha256.slice(0, 16),
      title: path.basename(entry.path, extension).replace(/[_-]+/g, ' '),
      artist: source.artist || source.repository.split('/')[0],
      file: `/repertoire/imported/${repoDirectory}/${targetName}`,
      source: source.repository,
      sourcePath: entry.path,
      license: source.license,
      sha256,
      size: bytes.length,
    })
  }
  return songs
}

const config = JSON.parse(await readFile(CONFIG_PATH, 'utf8'))
const enabledSources = (config.repositories || []).filter((source) => source.enabled)
await mkdir(OUTPUT_DIR, { recursive: true })

const allSongs = []
const failures = []
for (const source of enabledSources) {
  try {
    const songs = await syncRepository(source)
    allSongs.push(...songs)
    process.stdout.write(`✓ ${source.repository}: ${songs.length} archivos\n`)
  } catch (error) {
    failures.push({ source: source.repository, error: error.message })
    process.stderr.write(`✗ ${source.repository}: ${error.message}\n`)
  }
}

const uniqueSongs = [...new Map(allSongs.map((song) => [song.sha256, song])).values()]
const catalog = {
  generatedAt: new Date().toISOString(),
  songs: uniqueSongs,
  sources: enabledSources.map(({ repository, license }) => ({ repository, license })),
  failures,
}
await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
process.stdout.write(`Catálogo actualizado: ${uniqueSongs.length} archivos únicos.\n`)

if (failures.length > 0) process.exitCode = 1
