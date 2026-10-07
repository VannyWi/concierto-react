import { useEffect, useState, useTransition } from 'react'
import { ImageUp } from 'lucide-react'
import Swal from 'sweetalert2'
import './application-settings.css'

type ApiResponse<T> = { success: boolean; message: string; data?: T }
type Settings = { applicationName: string; hasLogo: boolean }

export function ApplicationSettings({ apiUrl }: { apiUrl: string }) {
  const [applicationName, setApplicationName] = useState('')
  const [logo, setLogo] = useState<File | null>(null)
  const [hasLogo, setHasLogo] = useState(false)
  const [logoVersion, setLogoVersion] = useState(Date.now())
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let isCurrent = true
    void fetch(`${apiUrl}/api/v1/public/settings`, { cache: 'no-store' }).then(async (response) => {
      const result = (await response.json()) as ApiResponse<Settings>
      if (isCurrent && response.ok && result.success && result.data) {
        setApplicationName(result.data.applicationName)
        setHasLogo(result.data.hasLogo)
      }
    }).finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [apiUrl])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData()
    data.append('applicationName', applicationName)
    if (logo) data.append('logo', logo)
    startTransition(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/settings`, { method: 'PUT', credentials: 'include', body: data })
        const result = (await response.json()) as ApiResponse<Settings>
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'No fue posible actualizar la configuración.')
        setApplicationName(result.data.applicationName)
        setHasLogo(result.data.hasLogo)
        setLogo(null)
        setLogoVersion(Date.now())
        window.dispatchEvent(new Event('application-settings-updated'))
        void Swal.fire({ icon: 'success', title: 'Configuración actualizada.', timer: 1800, showConfirmButton: false })
      } catch (requestError) {
        void Swal.fire({ icon: 'error', title: requestError instanceof Error ? requestError.message : 'No fue posible actualizar la configuración.' })
      }
    })
  }

  return <section className="application-settings" aria-labelledby="application-settings-title"><div><p className="dashboard-kicker">Administrador</p><h2 id="application-settings-title">Marca de la aplicación</h2><p>Personaliza el nombre y logo que ven los usuarios al ingresar.</p></div><form onSubmit={submit}><label>Nombre de la aplicación<input value={applicationName} onChange={(event) => setApplicationName(event.target.value)} maxLength={100} required disabled={isLoading || isPending} /></label><label>Logo <small>PNG, JPEG o WebP. Máximo 2 MB.</small><span className="application-settings-file"><ImageUp aria-hidden="true" size={18} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0] ?? null)} disabled={isLoading || isPending} /></span></label>{hasLogo ? <img className="application-settings-preview" src={`${apiUrl}/api/v1/public/settings/logo?v=${logoVersion}`} alt="Logo actual" /> : null}<button type="submit" disabled={isLoading || isPending}>{isPending ? 'Guardando...' : 'Guardar configuración'}</button></form></section>
}
