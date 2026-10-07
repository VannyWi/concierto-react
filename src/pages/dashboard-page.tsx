import { useEffect, useState, useTransition } from 'react'
import {
  LayoutDashboard,
  LogOut,
  FolderKanban,
  Building2,
  Menu,
  UserRound,
  UsersRound,
  Settings,
} from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { UserManagement } from '../features/users/user-management.tsx'
import { ProjectManagement } from '../features/projects/project-management.tsx'
import { ProjectDetailPage } from '../features/projects/project-detail-page.tsx'
import { ProjectDashboardChart } from '../features/projects/project-dashboard-chart.tsx'
import { CompanyManagement } from '../features/companies/company-management.tsx'
import { PasswordInput } from '../shared/components/password-input.tsx'
import { ApplicationBrand } from '../shared/components/application-brand.tsx'
import { ApplicationSettings } from '../features/settings/application-settings.tsx'
import './dashboard-page.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type Role = 'ADMIN' | 'GERENTE' | 'CONTADOR' | 'EJECUTIVO'

type AuthenticatedUser = {
  id: string
  username: string
  firstName: string
  lastName: string
  roleName: Role
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

type NavigationItem = {
  label: string
  description: string
  icon: typeof LayoutDashboard
}

type AccountForm = { username: string; currentPassword: string; newPassword: string; confirmPassword: string }

const DASHBOARD_BY_ROLE: Record<Role, { title: string; description: string; items: NavigationItem[] }> = {
  ADMIN: {
    title: 'Administracion general',
    description: 'Gestiona los accesos y la operacion global de la plataforma.',
    items: [
      { label: 'Dashboard', description: 'Vista general de la operacion.', icon: LayoutDashboard },
      { label: 'Usuarios', description: 'Altas, roles y estados de cuenta.', icon: UsersRound },
      { label: 'Proyectos', description: 'Registro comercial y presupuestos.', icon: FolderKanban },
      { label: 'Empresas', description: 'Catalogo de empresas y RUC.', icon: Building2 },
      { label: 'Configuración', description: 'Nombre y logo de la aplicación.', icon: Settings },
    ],
  },
  GERENTE: {
    title: 'Operacion de conciertos',
    description: 'Coordina la programacion y el seguimiento de cada evento.',
    items: [
      { label: 'Dashboard', description: 'Actividad pendiente y proximos eventos.', icon: LayoutDashboard },
      { label: 'Proyectos', description: 'Consulta de proyectos registrados.', icon: FolderKanban },
      { label: 'Empresas', description: 'Consulta de empresas registradas.', icon: Building2 },
    ],
  },
  CONTADOR: {
    title: 'Control financiero',
    description: 'Revisa los movimientos financieros de la operacion.',
    items: [
      { label: 'Dashboard', description: 'Balance general de los conciertos.', icon: LayoutDashboard },
      { label: 'Proyectos', description: 'Consulta de proyectos registrados.', icon: FolderKanban },
      { label: 'Empresas', description: 'Consulta de empresas registradas.', icon: Building2 },
    ],
  },
  EJECUTIVO: {
    title: 'Gestion comercial',
    description: 'Da seguimiento a ventas, clientes y actividades comerciales.',
    items: [
      { label: 'Dashboard', description: 'Prioridades comerciales del dia.', icon: LayoutDashboard },
      { label: 'Proyectos', description: 'Registra y actualiza tus proyectos.', icon: FolderKanban },
      { label: 'Empresas', description: 'Registra empresas para tus proyectos.', icon: Building2 },
    ],
  },
}

export function DashboardPage({ section = 'summary', projectId }: { section?: 'summary' | 'users' | 'projects' | 'companies' | 'project-detail' | 'account' | 'settings'; projectId?: string }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const navigate = useNavigate()

  useEffect(() => {
    let isCurrent = true

    async function loadSession() {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/me`, { credentials: 'include' })
        if (!response.ok) {
          return
        }

        const result = (await response.json()) as ApiResponse<AuthenticatedUser>
        if (result.success && result.data && isCurrent) {
          setUser(result.data)
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadSession()
    return () => {
      isCurrent = false
    }
  }, [])

  function handleLogout() {
    startTransition(async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('No fue posible cerrar la sesion.')
        }

        void Swal.fire({ icon: 'success', title: 'Sesion cerrada.', timer: 2200, showConfirmButton: false })
        navigate('/')
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'No fue posible cerrar la sesion.')
      }
    })
  }

  function selectDashboardItem(item: string) {
    setIsMobileMenuOpen(false)
    navigate(item === 'Usuarios' ? '/users' : item === 'Proyectos' ? '/projects' : item === 'Empresas' ? '/companies' : item === 'Configuración' ? '/settings' : '/dashboard')
  }

  if (isLoading) {
    return <main className="dashboard-loading">Cargando sesion...</main>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  const dashboard = DASHBOARD_BY_ROLE[user.roleName]
  const activeItem = section === 'users' ? 'Usuarios' : section === 'projects' || section === 'project-detail' ? 'Proyectos' : section === 'companies' ? 'Empresas' : section === 'settings' ? 'Configuración' : 'Dashboard'

  return (
    <main className="dashboard-page">
      <button className="dashboard-mobile-menu-toggle" type="button" onClick={() => setIsMobileMenuOpen((open) => !open)} aria-expanded={isMobileMenuOpen} aria-label="Abrir menú">
        <Menu aria-hidden="true" size={22} />
      </button>
      {isMobileMenuOpen ? <button className="dashboard-mobile-menu-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setIsMobileMenuOpen(false)} /> : null}
      <aside className={isMobileMenuOpen ? 'dashboard-sidebar is-mobile-open' : 'dashboard-sidebar'}>
        <ApplicationBrand apiUrl={API_URL} className="dashboard-brand" />

        <nav className="dashboard-navigation" aria-label="Modulos disponibles">
          {dashboard.items.map((item) => {
            const Icon = item.icon
            const isActive = item.label === activeItem

            return (
              <button
                className={isActive ? 'dashboard-navigation-item is-active' : 'dashboard-navigation-item'}
                key={item.label}
                type="button"
                  onClick={() => selectDashboardItem(item.label)}
              >
                <Icon aria-hidden="true" size={18} />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="dashboard-sidebar-footer">
          <div className="dashboard-sidebar-user">
            <span className="dashboard-user-avatar">
              <UserRound aria-hidden="true" size={18} />
            </span>
            <span className="dashboard-user-identity">
              <strong>{user.firstName.trim().split(/\s+/)[0]} {user.lastName.trim().split(/\s+/)[0]}</strong>
              <small>{user.roleName}</small>
            </span>
          </div>
          <button className="dashboard-account-update" type="button" onClick={() => navigate('/account')} disabled={isPending}>
            <Settings aria-hidden="true" size={17} />
            Actualizar cuenta
          </button>
          <button className="dashboard-logout" type="button" onClick={handleLogout} disabled={isPending}>
            <LogOut aria-hidden="true" size={18} />
            {isPending ? 'Cerrando...' : 'Cerrar sesion'}
          </button>
        </div>
      </aside>

      <section className="dashboard-content">
        {error ? (
          <p className="dashboard-error" role="alert">
            {error}
          </p>
        ) : null}

        {section === 'settings' && user.roleName === 'ADMIN' ? (
          <ApplicationSettings apiUrl={API_URL} />
        ) : section === 'account' ? (
          <AccountSettings user={user} onUpdated={setUser} />
        ) : activeItem === 'Usuarios' && user.roleName === 'ADMIN' ? (
          <UserManagement apiUrl={API_URL} />
        ) : section === 'project-detail' && projectId ? (
          <ProjectDetailPage apiUrl={API_URL} roleName={user.roleName} userId={user.id} projectId={projectId} />
        ) : activeItem === 'Proyectos' ? (
          <ProjectManagement apiUrl={API_URL} roleName={user.roleName} userId={user.id} />
        ) : activeItem === 'Empresas' ? (
          <CompanyManagement apiUrl={API_URL} roleName={user.roleName} />
        ) : (
          <section className="dashboard-modules" aria-labelledby="available-modules">
            <div>
              <p className="dashboard-kicker">{user.roleName}</p>
              <h2 id="available-modules">{dashboard.title}</h2>
              <p>{dashboard.description}</p>
            </div>

            <ProjectDashboardChart apiUrl={API_URL} />
          </section>
        )}
      </section>
    </main>
  )
}

function AccountSettings({ user, onUpdated }: { user: AuthenticatedUser; onUpdated: (user: AuthenticatedUser) => void }) {
  const [form, setForm] = useState<AccountForm>({ username: user.username, currentPassword: '', newPassword: '', confirmPassword: '' })
  const [isPending, startTransition] = useTransition()
  const navigate = useNavigate()

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.username.trim() || !form.currentPassword) {
      void Swal.fire({ icon: 'warning', title: 'Ingresa tu usuario y contraseña actual.' })
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      void Swal.fire({ icon: 'warning', title: 'Las nuevas contraseñas no coinciden.' })
      return
    }
    startTransition(async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/account`, {
          method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: form.username, currentPassword: form.currentPassword, newPassword: form.newPassword || null }),
        })
        const result = (await response.json()) as ApiResponse<AuthenticatedUser>
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'No fue posible actualizar la cuenta.')
        onUpdated(result.data)
        setForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' }))
        void Swal.fire({ icon: 'success', title: 'Cuenta actualizada.', timer: 1800, showConfirmButton: false })
      } catch (requestError) {
        void Swal.fire({ icon: 'error', title: requestError instanceof Error ? requestError.message : 'No fue posible actualizar la cuenta.' })
      }
    })
  }

  return <section className="dashboard-account-page" aria-labelledby="account-editor-title"><div><p className="dashboard-kicker">Perfil</p><h2 id="account-editor-title">Actualizar cuenta</h2><p>Confirma tu contraseña actual para guardar los cambios.</p></div><form className="dashboard-account-editor" onSubmit={submit} noValidate><label>Usuario<input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} autoComplete="username" required disabled={isPending} /></label><label>Contraseña actual<PasswordInput value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" required disabled={isPending} /></label><label>Nueva contraseña <small>(opcional)</small><PasswordInput value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" disabled={isPending} /></label><label>Confirmar nueva contraseña<PasswordInput value={form.confirmPassword} onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" disabled={isPending} /></label><div className="dashboard-account-actions"><button type="button" onClick={() => navigate('/dashboard')} disabled={isPending}>Volver</button><button type="submit" disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar cambios'}</button></div></form></section>
}
