import { useEffect, useMemo, useState } from 'react'
import { ALL_SONGS } from '../demoSongs'

const TAB_EXTENSIONS = ['.gp', '.gp3', '.gp4', '.gp5', '.gpx', '.gp7']

interface RepositoryFile {
  name: string
  path: string
  size: number
  repository: string
  downloadUrl: string
}

interface AdminDashboardProps {
  onLoadSong: (file: RepositoryFile) => Promise<void>
}

function isTab(path: string) {
  return TAB_EXTENSIONS.some((extension) => path.toLowerCase().endsWith(extension))
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function AdminDashboard({ onLoadSong }: AdminDashboardProps) {
  const [repository, setRepository] = useState('')
  const [token, setToken] = useState('')
  const [files, setFiles] = useState<RepositoryFile[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Listo para escanear una fuente autorizada.')
  const [scanning, setScanning] = useState(false)
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [savedRepositories, setSavedRepositories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('guitar-admin-repositories') ?? '[]') }
    catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('guitar-admin-repositories', JSON.stringify(savedRepositories))
  }, [savedRepositories])

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return normalized
      ? files.filter((file) => `${file.name} ${file.path}`.toLowerCase().includes(normalized))
      : files
  }, [files, query])

  const scanRepository = async (repo = repository) => {
    const normalizedRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '')
    if (!/^[\w.-]+\/[\w.-]+$/.test(normalizedRepo)) {
      setStatus('Usa el formato organización/repositorio.')
      return
    }

    setScanning(true)
    setStatus(`Consultando ${normalizedRepo}…`)
    try {
      const headers = githubHeaders(token.trim())
      const repoResponse = await fetch(`https://api.github.com/repos/${normalizedRepo}`, { headers })
      if (!repoResponse.ok) throw new Error(`GitHub respondió ${repoResponse.status}`)
      const metadata = await repoResponse.json() as { default_branch: string }

      const treeResponse = await fetch(
        `https://api.github.com/repos/${normalizedRepo}/git/trees/${encodeURIComponent(metadata.default_branch)}?recursive=1`,
        { headers }
      )
      if (!treeResponse.ok) throw new Error(`No se pudo leer el árbol (${treeResponse.status})`)
      const tree = await treeResponse.json() as { truncated?: boolean; tree: Array<{ path: string; type: string; size?: number }> }
      const found = tree.tree
        .filter((entry) => entry.type === 'blob' && isTab(entry.path))
        .map((entry) => ({
          name: entry.path.split('/').at(-1) ?? entry.path,
          path: entry.path,
          size: entry.size ?? 0,
          repository: normalizedRepo,
          downloadUrl: `https://raw.githubusercontent.com/${normalizedRepo}/${metadata.default_branch}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
        }))

      setFiles(found)
      setRepository(normalizedRepo)
      setSavedRepositories((current) => current.includes(normalizedRepo) ? current : [...current, normalizedRepo])
      setStatus(`${found.length} tablaturas encontradas${tree.truncated ? ' (el árbol fue truncado por GitHub)' : ''}.`)
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`)
    } finally {
      setScanning(false)
    }
  }

  const load = async (file: RepositoryFile) => {
    setLoadingPath(file.path)
    setStatus(`Descargando ${file.name}…`)
    try {
      await onLoadSong(file)
      setStatus(`${file.name} quedó listo para tocar.`)
    } catch (err) {
      setStatus(`No se pudo importar: ${(err as Error).message}`)
    } finally {
      setLoadingPath(null)
    }
  }

  return (
    <main className="admin-dashboard">
      <section className="admin-hero">
        <div>
          <span className="admin-kicker">CONTROL CENTER</span>
          <h1>Repertorio y automatizaciones</h1>
          <p>Escanea repositorios permitidos, prueba tablaturas y alimenta el catálogo sin cargar el móvil del jugador.</p>
        </div>
        <div className="admin-stat-grid">
          <article><strong>{ALL_SONGS.length}</strong><span>piezas locales</span></article>
          <article><strong>{files.length}</strong><span>hallazgos</span></article>
          <article><strong>{savedRepositories.length}</strong><span>fuentes</span></article>
        </div>
      </section>

      <div className="admin-grid">
        <section className="admin-card admin-scanner">
          <header><div><span>01</span><h2>Explorador de repositorios</h2></div><i className={scanning ? 'is-live' : ''} /></header>
          <label>Organización / repositorio</label>
          <div className="admin-input-row">
            <input value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="organización/repositorio" />
            <button onClick={() => scanRepository()} disabled={scanning}>{scanning ? 'Escaneando…' : 'Escanear'}</button>
          </div>
          <label>Token GitHub opcional <small>(sólo memoria de esta pestaña)</small></label>
          <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Aumenta el límite de la API; nunca se guarda" />
          <p className="admin-status">{status}</p>

          {savedRepositories.length > 0 && (
            <div className="admin-sources">
              {savedRepositories.map((repo) => (
                <button key={repo} onClick={() => { setRepository(repo); scanRepository(repo) }}>{repo}</button>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card admin-automation">
          <header><div><span>02</span><h2>Automatización programada</h2></div><i className="is-live" /></header>
          <div className="automation-step"><b>DIARIO</b><span>GitHub Action escanea las fuentes autorizadas</span></div>
          <div className="automation-step"><b>FILTRO</b><span>Conserva GP3/4/5, GPX y GP7; elimina duplicados</span></div>
          <div className="automation-step"><b>CATÁLOGO</b><span>Genera JSON para revisión antes de publicar</span></div>
          <code>npm run repertoire:sync</code>
          <small>Las fuentes deben declarar licencia o permiso. No se recopilan tabs comerciales sin autorización.</small>
        </section>
      </div>

      <section className="admin-card admin-results">
        <header>
          <div><span>03</span><h2>Archivos encontrados</h2></div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por canción o ruta…" />
        </header>
        {visibleFiles.length === 0 ? (
          <div className="admin-empty">Escanea una fuente para previsualizar su repertorio.</div>
        ) : (
          <div className="admin-file-list">
            {visibleFiles.slice(0, 250).map((file) => (
              <article key={`${file.repository}:${file.path}`}>
                <div><strong>{file.name.replace(/\.[^.]+$/, '')}</strong><span>{file.repository} / {file.path}</span></div>
                <small>{file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : '—'}</small>
                <button onClick={() => load(file)} disabled={loadingPath === file.path}>
                  {loadingPath === file.path ? 'Importando…' : 'Probar en juego'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export type { RepositoryFile }
