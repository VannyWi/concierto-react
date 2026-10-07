import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { Ban, ChevronLeft, ChevronRight, CircleCheck, Pencil, Plus, RotateCcw, Search, UsersRound } from 'lucide-react'
import Swal from 'sweetalert2'
import { PasswordInput } from '../../shared/components/password-input.tsx'
import './user-management.css'

type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

type User = {
  id: string
  username: string
  firstName: string
  lastName: string
  roleName: string
  active: boolean
}

type Role = {
  id: string
  roleName: string
}

type UserForm = {
  username: string
  firstName: string
  lastName: string
  password: string
  roleId: string
  active: boolean
}

type UserFilters = {
  firstName: string
  lastName: string
  roleId: string
  active: '' | 'true' | 'false'
}

type UserPage = {
  content: User[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type Pagination = {
  page: number
}

type Editor = { mode: 'create' } | { mode: 'edit'; user: User } | null

const EMPTY_FORM: UserForm = { username: '', firstName: '', lastName: '', password: '', roleId: '', active: true }
const EMPTY_FILTERS: UserFilters = { firstName: '', lastName: '', roleId: '', active: '' }
const EMPTY_PAGE: UserPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
const DEFAULT_PAGINATION: Pagination = { page: 0 }
const USER_TABLE_FEATURES = tableFeatures({})
const userColumnHelper = createColumnHelper<typeof USER_TABLE_FEATURES, User>()

async function getResponseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
  return body?.message ?? 'No fue posible completar la solicitud.'
}

function usersUrl(apiUrl: string, filters: UserFilters, pagination: Pagination) {
  const params = new URLSearchParams()
  if (filters.firstName.trim()) params.set('firstName', filters.firstName.trim())
  if (filters.lastName.trim()) params.set('lastName', filters.lastName.trim())
  if (filters.roleId) params.set('roleId', filters.roleId)
  if (filters.active) params.set('active', filters.active)
  params.set('page', pagination.page.toString())
  const query = params.toString()
  return `${apiUrl}/api/v1/users${query ? `?${query}` : ''}`
}

export function UserManagement({ apiUrl }: { apiUrl: string }) {
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [editor, setEditor] = useState<Editor>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<UserFilters>(EMPTY_FILTERS)
  const [userPage, setUserPage] = useState<UserPage>(EMPTY_PAGE)
  const [pagination, setPagination] = useState<Pagination>(DEFAULT_PAGINATION)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let isCurrent = true

    async function loadUsers() {
      setIsLoading(true)
      try {
        const [usersResponse, rolesResponse] = await Promise.all([
          fetch(usersUrl(apiUrl, appliedFilters, pagination), { credentials: 'include' }),
          fetch(`${apiUrl}/api/v1/roles`, { credentials: 'include' }),
        ])
        if (!usersResponse.ok) {
          throw new Error(await getResponseMessage(usersResponse))
        }
        if (!rolesResponse.ok) {
          throw new Error(await getResponseMessage(rolesResponse))
        }

        const usersResult = (await usersResponse.json()) as ApiResponse<UserPage>
        const rolesResult = (await rolesResponse.json()) as ApiResponse<Role[]>
        const pageData = usersResult.data
        const rolesData = rolesResult.data
        if (!usersResult.success || !pageData || !rolesResult.success || !rolesData) {
          throw new Error('No fue posible cargar los usuarios.')
        }

        if (isCurrent) {
          if (pageData.totalPages > 0 && pageData.page >= pageData.totalPages) {
            setPagination((current) => ({ ...current, page: pageData.totalPages - 1 }))
            return
          }
          setUsers(pageData.content)
          setUserPage(pageData)
          setRoles(rolesData)
        }
      } catch (requestError) {
        if (isCurrent) {
          const message = requestError instanceof Error ? requestError.message : 'No fue posible cargar los usuarios.'
          setError(message)
          void Swal.fire({ icon: 'error', title: message })
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()
    return () => {
      isCurrent = false
    }
  }, [apiUrl, appliedFilters, pagination, refreshVersion])

  useEffect(() => {
    if (!editor) {
      return
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) {
        closeEditor()
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [editor, isPending])

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditor({ mode: 'create' })
  }

  const openEdit = useCallback((user: User) => {
    setForm({
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      password: '',
      roleId: roles.find((role) => role.roleName === user.roleName)?.id ?? '',
      active: user.active,
    })
    setEditor({ mode: 'edit', user })
  }, [roles])

  const toggleUserStatus = useCallback((user: User) => {
    startTransition(async () => {
      setError('')
      try {
        const response = await fetch(`${apiUrl}/api/v1/users/${user.id}/status`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !user.active }),
        })
        if (!response.ok) {
          throw new Error(await getResponseMessage(response))
        }

        const result = (await response.json()) as ApiResponse<User>
        if (!result.success || !result.data) {
          throw new Error(result.message)
        }
        setRefreshVersion((current) => current + 1)
        void Swal.fire({
          icon: 'success',
          title: user.active ? 'Usuario inactivado.' : 'Usuario activado.',
          timer: 2200,
          showConfirmButton: false,
        })
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'No fue posible actualizar el estado.'
        setError(message)
        void Swal.fire({ icon: 'error', title: message })
      }
    })
  }, [apiUrl])

  const requestStatusChange = useCallback(async (user: User) => {
    const result = await Swal.fire({
      title: user.active ? 'Inactivar usuario?' : 'Activar usuario?',
      text: user.active
        ? `${user.firstName} ${user.lastName} perdera el acceso y su sesion actual se cerrara.`
        : `${user.firstName} ${user.lastName} podra iniciar sesion nuevamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: user.active ? 'Inactivar' : 'Activar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    })

    if (result.isConfirmed) {
      toggleUserStatus(user)
    }
  }, [toggleUserStatus])

  function closeEditor() {
    setEditor(null)
    setForm(EMPTY_FORM)
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAppliedFilters({ ...filters })
    setPagination((current) => ({ ...current, page: 0 }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
    setPagination((current) => ({ ...current, page: 0 }))
  }

  function changePage(page: number) {
    setPagination((current) => ({ ...current, page }))
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) {
      return
    }
    const editingUser = editor.mode === 'edit' ? editor.user : null

    startTransition(async () => {
      setError('')
      try {
        const selectedRole = roles.find((role) => role.id === form.roleId)
        if (!selectedRole) {
          throw new Error('Selecciona un rol valido.')
        }

        const isCreating = editingUser === null
        const endpoint = editingUser ? `${apiUrl}/api/v1/users/${editingUser.id}` : `${apiUrl}/api/v1/users`
        const response = await fetch(
          endpoint,
          {
            method: isCreating ? 'POST' : 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              isCreating
                ? {
                    username: form.username,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    password: form.password,
                    role: selectedRole.roleName,
                  }
                : {
                    username: form.username,
                    firstName: form.firstName,
                    lastName: form.lastName,
                    password: form.password || null,
                    roleId: selectedRole.id,
                    active: form.active,
                  },
            ),
          },
        )
        if (!response.ok) {
          throw new Error(await getResponseMessage(response))
        }

        const result = (await response.json()) as ApiResponse<User>
        if (!result.success || !result.data) {
          throw new Error(result.message)
        }
        setRefreshVersion((current) => current + 1)
        void Swal.fire({
          icon: 'success',
          title: isCreating ? 'Usuario creado.' : 'Usuario actualizado.',
          timer: 2200,
          showConfirmButton: false,
        })
        closeEditor()
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'No fue posible guardar el usuario.'
        setError(message)
        void Swal.fire({ icon: 'error', title: message })
      }
    })
  }

  const columns = useMemo(() => userColumnHelper.columns([
    userColumnHelper.accessor('username', {
      header: 'Usuario',
      cell: ({ row }) => <strong>{row.original.username}</strong>,
    }),
    userColumnHelper.accessor('firstName', {
      header: 'Nombre',
    }),
    userColumnHelper.accessor('lastName', {
      header: 'Apellido',
    }),
    userColumnHelper.accessor('roleName', {
      header: 'Rol',
      cell: ({ row }) => <span className={`users-role-badge is-${row.original.roleName.toLowerCase()}`}>{row.original.roleName}</span>,
    }),
    userColumnHelper.accessor('active', {
      header: 'Estado',
      cell: ({ row }) => (
        <span className={row.original.active ? 'users-status-badge is-active' : 'users-status-badge is-inactive'}>
          {row.original.active ? 'Activo' : 'Inactivo'}
        </span>
      ),
    }),
    userColumnHelper.display({
      id: 'actions',
      header: () => <span className="users-actions-heading">Acciones</span>,
      cell: ({ row }) => (
        <div className="users-row-actions">
          <button type="button" onClick={() => openEdit(row.original)} disabled={isPending}>
            <Pencil aria-hidden="true" size={15} />
            Editar
          </button>
          <button
            className={row.original.active ? 'users-status-switch is-active' : 'users-status-switch'}
            type="button"
            onClick={() => requestStatusChange(row.original)}
            disabled={isPending}
            role="switch"
            aria-checked={row.original.active}
            aria-label={row.original.active ? `Inactivar a ${row.original.username}` : `Activar a ${row.original.username}`}
            title={row.original.active ? 'Inactivar usuario' : 'Activar usuario'}
          >
            <span className="users-status-switch-thumb">
              {row.original.active ? <CircleCheck aria-hidden="true" size={13} /> : <Ban aria-hidden="true" size={13} />}
            </span>
          </button>
        </div>
      ),
    }),
  ]), [isPending, openEdit, requestStatusChange])

  const table = useTable({
    features: USER_TABLE_FEATURES,
    data: users,
    columns,
  })

  return (
    <section className="users-management" aria-labelledby="users-title">
      <header className="users-management-header">
        <div>
          <p className="dashboard-kicker">Administracion</p>
          <h2 id="users-title">Usuarios</h2>
          <p>Gestiona las cuentas, los roles y el estado de acceso.</p>
        </div>
        <button className="users-create-button" type="button" onClick={openCreate} disabled={isLoading || isPending}>
          <Plus aria-hidden="true" size={18} />
          Nuevo usuario
        </button>
      </header>

      <form className="users-filters" onSubmit={applyFilters}>
        <label>
          Nombre
          <input
            value={filters.firstName}
            onChange={(event) => setFilters((current) => ({ ...current, firstName: event.target.value }))}
            placeholder="Buscar por nombre"
          />
        </label>
        <label>
          Apellido
          <input
            value={filters.lastName}
            onChange={(event) => setFilters((current) => ({ ...current, lastName: event.target.value }))}
            placeholder="Buscar por apellido"
          />
        </label>
        <label>
          Rol
          <select
            value={filters.roleId}
            onChange={(event) => setFilters((current) => ({ ...current, roleId: event.target.value }))}
          >
            <option value="">Todos los roles</option>
            {roles.map((role) => <option key={role.id} value={role.id}>{role.roleName}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select
            value={filters.active}
            onChange={(event) => setFilters((current) => ({ ...current, active: event.target.value as UserFilters['active'] }))}
          >
            <option value="">Todos los estados</option>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </label>
        <div className="users-filter-actions">
          <button className="users-filter-submit" type="submit" disabled={isLoading || isPending}>
            <Search aria-hidden="true" size={16} />
            Buscar
          </button>
          <button className="users-filter-reset" type="button" onClick={clearFilters} disabled={isLoading || isPending}>
            <RotateCcw aria-hidden="true" size={16} />
            Limpiar
          </button>
        </div>
      </form>

      {error ? <p className="dashboard-error" role="alert">{error}</p> : null}

      {editor ? (
        <div
          className="users-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isPending) {
              closeEditor()
            }
          }}
        >
          <form
            className="users-editor is-create"
            onSubmit={submitForm}
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-editor-title"
          >
            <div className="users-editor-heading">
              <div>
                <p className="dashboard-kicker">{editor.mode === 'create' ? 'Nuevo registro' : 'Editar registro'}</p>
                <h3 id="users-editor-title">{editor.mode === 'create' ? 'Crear usuario' : `Editar ${editor.user.username}`}</h3>
              </div>
            </div>
            <div className="users-form-fields">
              <label>
                Usuario
                <input
                  autoComplete="username"
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  maxLength={100}
                  required
                  disabled={isPending}
                />
              </label>
              <label>
                Nombre
                <input
                  autoComplete="given-name"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  maxLength={100}
                  required
                  disabled={isPending}
                />
              </label>
              <label>
                Apellido
                <input
                  autoComplete="family-name"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  maxLength={100}
                  required
                  disabled={isPending}
                />
              </label>
              <label>
                {editor.mode === 'create' ? 'Contraseña' : 'Nueva contraseña (opcional)'}
                <PasswordInput
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required={editor.mode === 'create'}
                  disabled={isPending}
                />
              </label>
              <label>
                Rol
                <select
                  value={form.roleId}
                  onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
                  required
                  disabled={isPending}
                >
                  <option value="" disabled>Selecciona un rol</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.roleName}</option>)}
                </select>
              </label>
            </div>
            <div className="users-editor-actions">
              <button className="users-cancel-button" type="button" onClick={closeEditor} disabled={isPending}>Cancelar</button>
              <button className="users-save-button" type="submit" disabled={isPending}>
                {isPending ? 'Guardando...' : editor.mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="users-table-card">
        <div className="users-table-heading">
          <UsersRound aria-hidden="true" size={20} />
          <span>{isLoading ? 'Cargando usuarios...' : `${userPage.totalElements} usuario${userPage.totalElements === 1 ? '' : 's'}`}</span>
        </div>
        <div className="users-table-scroll">
          <table>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id}><table.FlexRender cell={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && table.getRowModel().rows.length === 0 ? <p className="users-empty">No hay usuarios registrados.</p> : null}
        </div>
        {userPage.totalElements > 0 ? (
          <div className="users-pagination">
            <span>
              Mostrando {pagination.page * userPage.size + 1}-{Math.min((pagination.page + 1) * userPage.size, userPage.totalElements)} de {userPage.totalElements}
            </span>
            <div className="users-pagination-controls">
              <button
                type="button"
                onClick={() => changePage(pagination.page - 1)}
                disabled={isLoading || isPending || pagination.page === 0}
              >
                <ChevronLeft aria-hidden="true" size={16} />
                Anterior
              </button>
              <span>Página {pagination.page + 1} de {userPage.totalPages}</span>
              <button
                type="button"
                onClick={() => changePage(pagination.page + 1)}
                disabled={isLoading || isPending || pagination.page + 1 >= userPage.totalPages}
              >
                Siguiente
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
