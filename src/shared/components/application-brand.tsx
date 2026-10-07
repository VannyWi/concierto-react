import { useEffect, useState } from 'react'
import { Music2 } from 'lucide-react'
import './application-brand.css'

type ApiResponse<T> = { success: boolean; data?: T }
type ApplicationSettings = { applicationName: string; hasLogo: boolean }

export function ApplicationBrand({ apiUrl, className }: { apiUrl: string; className: string }) {
  const [settings, setSettings] = useState<ApplicationSettings>({ applicationName: 'Conciertos', hasLogo: false })
  const [version, setVersion] = useState(Date.now())

  useEffect(() => {
    let isCurrent = true
    async function load() {
      const response = await fetch(`${apiUrl}/api/v1/public/settings`, { cache: 'no-store' })
      const result = (await response.json().catch(() => null)) as ApiResponse<ApplicationSettings> | null
      if (isCurrent && response.ok && result?.success && result.data) {
        setSettings(result.data)
        setVersion(Date.now())
      }
    }
    void load()
    window.addEventListener('application-settings-updated', load)
    return () => {
      isCurrent = false
      window.removeEventListener('application-settings-updated', load)
    }
  }, [apiUrl])

  useEffect(() => {
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

  return <div className={className}>{settings.hasLogo ? <img className="application-brand-logo" src={`${apiUrl}/api/v1/public/settings/logo?v=${version}`} alt="" /> : <Music2 aria-hidden="true" size={23} />}<span>{settings.applicationName}</span></div>
}
