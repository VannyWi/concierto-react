import { useEffect, useState, useTransition } from 'react'
import { Ban, Building2, CircleCheck, Pencil, Plus, RotateCcw, Search } from 'lucide-react'
import Swal from 'sweetalert2'
import '../projects/project-management.css'
import './company-management.css'

type Company = { id: string; name: string; ruc: string; active: boolean }
type CompanyPage = { content: Company[]; page: number; size: number; totalElements: number; totalPages: number }
type ApiResponse<T> = { success: boolean; message: string; data?: T }
type Role = 'ADMIN' | 'GERENTE' | 'CONTADOR' | 'EJECUTIVO'
type Editor = 'create' | Company | null
const EMPTY_PAGE: CompanyPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
const EMPTY_FORM = { name: '', ruc: '' }

export function CompanyManagement({ apiUrl, roleName }: { apiUrl: string; roleName: Role }) {
  const [companyPage, setCompanyPage] = useState<CompanyPage>(EMPTY_PAGE)
  const [editor, setEditor] = useState<Editor>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filters, setFilters] = useState({ name: '', ruc: '', active: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [page, setPage] = useState(0)
  const [isPending, startTransition] = useTransition()
  const canWrite = roleName === 'ADMIN' || roleName === 'EJECUTIVO'

  async function load() {
    const params = new URLSearchParams({ page: page.toString() })
    if (appliedFilters.name) params.set('name', appliedFilters.name)
    if (appliedFilters.ruc) params.set('ruc', appliedFilters.ruc)
    if (appliedFilters.active) params.set('active', appliedFilters.active)
    const response = await fetch(`${apiUrl}/api/v1/companies?${params}`, { credentials: 'include' })
    const result = (await response.json()) as ApiResponse<CompanyPage>
    if (response.ok && result.data) setCompanyPage(result.data)
  }

  useEffect(() => { void load() }, [apiUrl, appliedFilters, page])

  function openCreate() { setForm(EMPTY_FORM); setEditor('create') }
  function openEdit(company: Company) { setForm({ name: company.name, ruc: company.ruc }); setEditor(company) }
  function closeEditor() { setEditor(null); setForm(EMPTY_FORM) }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    if (!form.name.trim()) {
      void Swal.fire({ icon: 'warning', title: 'Ingresa el nombre de la empresa.' })
      return
    }
    if (!/^\d{11}$/.test(form.ruc)) {
      void Swal.fire({ icon: 'warning', title: 'El RUC debe tener exactamente 11 dígitos.' })
      return
    }
    startTransition(async () => {
      const response = await fetch(editor === 'create' ? `${apiUrl}/api/v1/companies` : `${apiUrl}/api/v1/companies/${editor.id}`, {
        method: editor === 'create' ? 'POST' : 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const result = (await response.json()) as ApiResponse<Company>
      if (!response.ok) { void Swal.fire({ icon: 'error', title: result.message }); return }
      closeEditor(); setPage(0); await load()
      void Swal.fire({ icon: 'success', title: editor === 'create' ? 'Empresa registrada.' : 'Empresa actualizada.', timer: 1800, showConfirmButton: false })
    })
  }

  function updateStatus(company: Company) {
    startTransition(async () => {
      const response = await fetch(`${apiUrl}/api/v1/companies/${company.id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !company.active }) })
      const result = (await response.json()) as ApiResponse<Company>
      if (!response.ok) { void Swal.fire({ icon: 'error', title: result.message }); return }
      await load()
    })
  }

  async function requestStatusChange(company: Company) {
    const confirmation = await Swal.fire({
      title: company.active ? '¿Inactivar empresa?' : '¿Activar empresa?',
      text: company.active
        ? `${company.name} no podrá usarse para crear proyectos nuevos.`
        : `${company.name} podrá usarse para crear proyectos nuevos.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: company.active ? 'Inactivar' : 'Activar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    })
    if (confirmation.isConfirmed) updateStatus(company)
  }

  return <section className="projects-management"><header className="projects-header"><div><p className="dashboard-kicker">Catálogo comercial</p><h2>Empresas</h2><p>Registra las empresas disponibles para los proyectos.</p></div>{canWrite ? <button className="projects-create" type="button" onClick={openCreate}><Plus size={17} /> Nueva empresa</button> : null}</header>
    <form className="company-filters" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filters }); setPage(0) }}><label>Nombre<input value={filters.name} onChange={(event) => setFilters({ ...filters, name: event.target.value })} placeholder="Buscar por nombre" /></label><label>RUC<input value={filters.ruc} onChange={(event) => setFilters({ ...filters, ruc: event.target.value })} placeholder="Buscar por RUC" /></label><label>Estado<select value={filters.active} onChange={(event) => setFilters({ ...filters, active: event.target.value })}><option value="">Todos los estados</option><option value="true">Activo</option><option value="false">Inactivo</option></select></label><div className="company-filter-actions"><button className="company-filter-submit" type="submit"><Search aria-hidden="true" size={16} />Buscar</button><button className="company-filter-reset" type="button" onClick={() => { setFilters({ name: '', ruc: '', active: '' }); setAppliedFilters({ name: '', ruc: '', active: '' }); setPage(0) }}><RotateCcw aria-hidden="true" size={16} />Limpiar</button></div></form>
    <div className="projects-table-card"><div className="projects-table-heading"><Building2 size={20} /><span>{companyPage.totalElements} empresa{companyPage.totalElements === 1 ? '' : 's'}</span></div><div className="projects-table-scroll company-table-scroll"><table><thead><tr><th>Empresa</th><th>RUC</th><th>Estado</th>{canWrite ? <th>Acciones</th> : null}</tr></thead><tbody>{companyPage.content.map((company) => <tr key={company.id}><td>{company.name}</td><td>{company.ruc}</td><td><span className={company.active ? 'company-status-indicator is-active' : 'company-status-indicator is-inactive'}><span aria-hidden="true" />{company.active ? 'Activo' : 'Inactivo'}</span></td>{canWrite ? <td><div className="projects-actions"><button className="projects-edit" type="button" onClick={() => openEdit(company)}><Pencil size={15} /> Editar</button><button className={company.active ? 'company-status-switch is-active' : 'company-status-switch'} type="button" role="switch" aria-checked={company.active} aria-label={company.active ? `Inactivar ${company.name}` : `Activar ${company.name}`} onClick={() => { void requestStatusChange(company) }}><span>{company.active ? <CircleCheck size={13} /> : <Ban size={13} />}</span></button></div></td> : null}</tr>)}</tbody></table></div>{companyPage.totalElements > 0 ? <div className="projects-pagination company-pagination"><span>Página {page + 1} de {companyPage.totalPages}</span><div><button type="button" onClick={() => setPage(page - 1)} disabled={page === 0}>Anterior</button><button type="button" onClick={() => setPage(page + 1)} disabled={page + 1 >= companyPage.totalPages}>Siguiente</button></div></div> : null}</div>
    {editor ? <div className="projects-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) closeEditor() }}><form className="projects-editor" onSubmit={submit} noValidate><div><p className="dashboard-kicker">Empresa</p><h3>{editor === 'create' ? 'Registrar empresa' : 'Editar empresa'}</h3></div><div className="projects-form-fields"><label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength={150} disabled={isPending} /></label><label>RUC<input value={form.ruc} onChange={(event) => setForm({ ...form, ruc: event.target.value.replace(/\D/g, '') })} maxLength={11} disabled={isPending} /></label></div><div className="projects-editor-actions"><button type="button" onClick={closeEditor} disabled={isPending}>Cancelar</button><button type="submit" disabled={isPending}>{editor === 'create' ? 'Registrar empresa' : 'Guardar cambios'}</button></div></form></div> : null}
  </section>
}
