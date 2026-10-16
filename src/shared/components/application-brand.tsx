import { useEffect, useRef, useState } from 'react'
import { Music2 } from 'lucide-react'
import './application-brand.css'

type ApiResponse<T> = { success: boolean; data?: T }
type ApplicationSettings = { applicationName: string; hasLogo: boolean }
type StoredBrand = { settings: ApplicationSettings; version: number }

function storageKey(apiUrl: string) { return `application-brand:${apiUrl}` }

function storedBrand(apiUrl: string): StoredBrand | null {
  try {
    const value = localStorage.getItem(storageKey(apiUrl))
    if (!value) return null
    const brand = JSON.parse(value) as StoredBrand
    return typeof brand.settings?.applicationName === 'string' && typeof brand.settings?.hasLogo === 'boolean' && typeof brand.version === 'number' ? brand : null
  } catch {
    return null
  }
}

export function ApplicationBrand({ apiUrl, className }: { apiUrl: string; className: string }) {
  const initialBrand = storedBrand(apiUrl)
  const [settings, setSettings] = useState<ApplicationSettings | null>(initialBrand?.settings ?? null)
  const [version, setVersion] = useState(initialBrand?.version ?? Date.now())
  const requestVersion = useRef(0)

  function applyBrand(nextSettings: ApplicationSettings, nextVersion = Date.now()) {
    setSettings(nextSettings)
    setVersion(nextVersion)
    try { localStorage.setItem(storageKey(apiUrl), JSON.stringify({ settings: nextSettings, version: nextVersion })) } catch { /* Storage may be unavailable. */ }
  }

  useEffect(() => {
    let isCurrent = true
    async function load() {
      const currentRequest = ++requestVersion.current
      const response = await fetch(`${apiUrl}/api/v1/public/settings`, { cache: 'no-store' })
      const result = (await response.json().catch(() => null)) as ApiResponse<ApplicationSettings> | null
      if (isCurrent && currentRequest === requestVersion.current && response.ok && result?.success && result.data) {
        applyBrand(result.data)
      }
    }
    void load()
    function applyUpdate(event: Event) {
      const update = (event as CustomEvent<{ settings: ApplicationSettings; version: number }>).detail
      if (update) {
        requestVersion.current += 1
        applyBrand(update.settings, update.version)
        return
      }
      void load()
    }
    window.addEventListener('application-settings-updated', applyUpdate)
    return () => {
      isCurrent = false
      window.removeEventListener('application-settings-updated', applyUpdate)
    }
  }, [apiUrl])

  useEffect(() => {
    if (!settings) {
      document.title = 'Aplicación'
      return
    }
    document.title = settings.applicationName
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!favicon) return
    if (settings.hasLogo) {
      favicon.href = `${apiUrl}/api/v1/public/settings/logo?v=${version}`
      favicon.removeAttribute('type')
    } else {
      favicon.href = '/favicon.svg'
      favicon.type = 'image/svg+xml'
    }
  }, [apiUrl, settings, version])

  if (!settings) return <div className={className} aria-busy="true" />
  return <div className={className}>{settings.hasLogo ? <img className="application-brand-logo" src={`${apiUrl}/api/v1/public/settings/logo?v=${version}`} alt="" /> : <Music2 aria-hidden="true" size={23} />}<span>{settings.applicationName}</span></div>
}
