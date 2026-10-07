import { useEffect, useMemo, useState, useTransition } from 'react'
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table'
import { CalendarDays, Download, Eye, FolderKanban, Plus, RotateCcw, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import './project-management.css'

type ApiResponse<T> = { success: boolean; message: string; data?: T }
type Role = 'ADMIN' | 'GERENTE' | 'CONTADOR' | 'EJECUTIVO'

type Company = { id: string; name: string; ruc: string; active: boolean }
type CompanyPage = { content: Company[] }
type Project = {
  id: string
  createdById: string
  executiveName: string
  companyId: string
  companyName: string
  companyRuc: string
  projectName: string
  observations: string | null
  approved: 'PENDIENTE' | 'SI' | 'NO'
  status: 'VIGENTE' | 'EJECUTADO' | 'PERDIDO' | 'CANCELADO'
  totalBudget: number
  year: number
  eventDate: string
  tentativeBillingMonth: string
  finalBilling: number | null
  costsWithoutVat: number | null
  profitability: number | null
  executiveLocked: boolean
}
type ProjectPage = { content: Project[]; page: number; size: number; totalElements: number; totalPages: number }
type ProjectForm = {
  companyId: string
  projectName: string
  observations: string
  approved: 'PENDIENTE' | 'SI' | 'NO'
  status: 'VIGENTE' | 'EJECUTADO' | 'PERDIDO' | 'CANCELADO'
  totalBudget: string
  year: string
  eventDate: string
  tentativeBillingMonth: string
  finalBilling: string
  costsWithoutVat: string
}
type ProjectFilters = {
  search: string
  eventDate: string
  approved: '' | Project['approved']
  status: '' | Project['status']
}

const EMPTY_PAGE: ProjectPage = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
const EMPTY_FORM: ProjectForm = {
  companyId: '', projectName: '', observations: '', approved: 'PENDIENTE', status: 'VIGENTE', totalBudget: '',
  year: new Date().getFullYear().toString(), eventDate: '', tentativeBillingMonth: '', finalBilling: '', costsWithoutVat: '',
}
const EMPTY_FILTERS: ProjectFilters = { search: '', eventDate: '', approved: '', status: '' }
const CURRENT_YEAR = new Date().getFullYear()
const EXPORT_YEARS = Array.from({ length: 101 }, (_, index) => 2000 + index)
const PROJECT_TABLE_FEATURES = tableFeatures({})
const projectColumnHelper = createColumnHelper<typeof PROJECT_TABLE_FEATURES, Project>()

function approvalIndicator(approved: Project['approved']) {
  const label = approved === 'SI' ? 'Aprobado' : approved === 'NO' ? 'No aprobado' : 'Pendiente'
  const tone = approved === 'SI' ? 'approved' : approved === 'NO' ? 'rejected' : 'pending'
  return <span className={`project-indicator is-${tone}`}><span aria-hidden="true" />{label}</span>
}

function statusIndicator(status: Project['status']) {
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return <span className={`project-indicator is-${status.toLowerCase()}`}><span aria-hidden="true" />{label}</span>
}

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
  return body?.message ?? 'No fue posible completar la solicitud.'
}

function projectsUrl(apiUrl: string, filters: ProjectFilters, page: number) {
  const params = new URLSearchParams({ page: page.toString() })
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.eventDate) params.set('eventDate', filters.eventDate)
  if (filters.approved) params.set('approved', filters.approved)
  if (filters.status) params.set('status', filters.status)
  return `${apiUrl}/api/v1/projects?${params}`
}

export function ProjectManagement({ apiUrl, roleName, userId }: { apiUrl: string; roleName: Role; userId: string }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectPage, setProjectPage] = useState<ProjectPage>(EMPTY_PAGE)
  const [companies, setCompanies] = useState<Company[]>([])
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<ProjectFilters>(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<ProjectFilters>(EMPTY_FILTERS)
  const [editor, setEditor] = useState<Project | 'create' | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [companySearch, setCompanySearch] = useState('')
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [exportYear, setExportYear] = useState(CURRENT_YEAR.toString())
  const [isExporting, setIsExporting] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const canWrite = roleName === 'ADMIN' || roleName === 'EJECUTIVO'
  const isAdmin = roleName === 'ADMIN'
  const navigate = useNavigate()

  useEffect(() => {
    let isCurrent = true
    async function loadProjects() {
      setIsLoading(true)
      try {
        const projectResponse = await fetch(projectsUrl(apiUrl, appliedFilters, page), { credentials: 'include' })
        if (!projectResponse.ok) throw new Error(await responseMessage(projectResponse))
        const projectResult = (await projectResponse.json()) as ApiResponse<ProjectPage>
        if (!projectResult.success || !projectResult.data) throw new Error('No fue posible cargar los proyectos.')

        const companyResponse = await fetch(`${apiUrl}/api/v1/companies?active=true`, { credentials: 'include' })
        if (!companyResponse.ok) throw new Error(await responseMessage(companyResponse))
        const companyResult = (await companyResponse.json()) as ApiResponse<CompanyPage>
        if (!companyResult.success || !companyResult.data) throw new Error('No fue posible cargar las empresas.')

        if (isCurrent) {
          setProjects(projectResult.data.content)
          setProjectPage(projectResult.data)
          setCompanies(companyResult.data.content)
          setError('')
        }
      } catch (requestError) {
        if (isCurrent) setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los proyectos.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }
    void loadProjects()
    return () => { isCurrent = false }
  }, [apiUrl, appliedFilters, page])

  function closeEditor() {
    setEditor(null)
    setForm(EMPTY_FORM)
    setCompanySearch('')
    setIsCompanyMenuOpen(false)
  }

  function openCreate() {
    setForm(EMPTY_FORM)
    setEditor('create')
    setCompanySearch('')
    setIsCompanyMenuOpen(false)
  }

  function openDetail(project: Project) {
    navigate(`/projects/${project.id}`)
  }

  async function exportProjects() {
    setIsExporting(true)
    try {
      const response = await fetch(`${apiUrl}/api/v1/projects/export?year=${encodeURIComponent(exportYear)}`, { credentials: 'include' })
      if (!response.ok) throw new Error(await responseMessage(response))
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `proyectos-${exportYear}.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No fue posible descargar el Excel.'
      void Swal.fire({ icon: message === 'No hay proyectos para exportar.' ? 'info' : 'error', title: message })
    } finally {
      setIsExporting(false)
    }
  }

  function setField(field: keyof ProjectForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    const stateChanged = editor !== 'create' && (editor.approved !== form.approved || editor.status !== form.status)
    if (stateChanged) {
      void Swal.fire({
        title: '¿Confirmar cambio de estado?',
        text: 'Este cambio es definitivo y no podrá revertirse.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Confirmar cambio',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
      }).then((confirmation) => {
        if (confirmation.isConfirmed) saveProject()
      })
      return
    }
    saveProject()
  }

  function saveProject() {
    if (!editor) return
    startTransition(async () => {
      try {
        const isCreating = editor === 'create'
        const response = await fetch(isCreating ? `${apiUrl}/api/v1/projects` : `${apiUrl}/api/v1/projects/${editor.id}`, {
          method: isCreating ? 'POST' : 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: form.companyId,
            projectName: form.projectName,
            observations: form.observations || null,
            approved: editor === 'create' ? null : form.approved,
            status: form.status,
            totalBudget: Number(form.totalBudget),
            year: Number(form.year),
            eventDate: form.eventDate,
            tentativeBillingMonth: form.tentativeBillingMonth,
            finalBilling: form.finalBilling ? Number(form.finalBilling) : null,
            costsWithoutVat: form.costsWithoutVat ? Number(form.costsWithoutVat) : null,
          }),
        })
        if (!response.ok) throw new Error(await responseMessage(response))
        closeEditor()
        setPage(0)
        if (page === 0) {
          const refreshed = await fetch(projectsUrl(apiUrl, appliedFilters, 0), { credentials: 'include' })
          const result = (await refreshed.json()) as ApiResponse<ProjectPage>
          if (refreshed.ok && result.success && result.data) {
            setProjects(result.data.content)
            setProjectPage(result.data)
          }
        }
        void Swal.fire({ icon: 'success', title: isCreating ? 'Proyecto creado.' : 'Proyecto actualizado.', timer: 2000, showConfirmButton: false })
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : 'No fue posible guardar el proyecto.'
        setError(message)
        void Swal.fire({ icon: 'error', title: message })
      }
    })
  }

  const columns = useMemo(() => projectColumnHelper.columns([
    projectColumnHelper.accessor('executiveName', { header: 'Ejecutivo' }),
    projectColumnHelper.accessor('companyName', { header: 'Empresa' }),
    projectColumnHelper.accessor('projectName', { header: 'Proyecto' }),
    projectColumnHelper.accessor('approved', { header: 'Aprobado', cell: ({ row }) => approvalIndicator(row.original.approved) }),
    projectColumnHelper.accessor('status', { header: 'Estado', cell: ({ row }) => statusIndicator(row.original.status) }),
    projectColumnHelper.accessor('totalBudget', { header: 'PPTO sin IGV', cell: ({ row }) => row.original.totalBudget.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }) }),
    projectColumnHelper.accessor('eventDate', { header: 'Fecha evento' }),
    projectColumnHelper.accessor('tentativeBillingMonth', { header: 'Facturación' }),
    projectColumnHelper.accessor('finalBilling', { header: 'Final sin IGV', cell: ({ row }) => row.original.finalBilling?.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }) ?? '-' }),
    projectColumnHelper.accessor('profitability', { header: 'Rentabilidad', cell: ({ row }) => row.original.profitability === null ? '-' : `${row.original.profitability}%` }),
    projectColumnHelper.display({
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => <div className="projects-actions"><button className="projects-edit" type="button" onClick={() => openDetail(row.original)}><Eye aria-hidden="true" size={15} /> Ver detalle</button></div>,
    }),
  ]), [isAdmin, isPending, roleName, userId])
  const table = useTable({ features: PROJECT_TABLE_FEATURES, data: projects, columns })
  const canSaveEditor = editor === 'create' || (editor !== null && (isAdmin || (roleName === 'EJECUTIVO' && editor.createdById === userId)))

  return (
    <section className="projects-management" aria-labelledby="projects-title">
       <header className="projects-header">
        <div><p className="dashboard-kicker">Registro comercial</p><h2 id="projects-title">Proyectos</h2><p>Consulta los proyectos, presupuestos y facturación planificada.</p></div>
        <div className="projects-header-actions"><label className="projects-export-year">Año de exportación<select value={exportYear} onChange={(event) => setExportYear(event.target.value)} disabled={isExporting}>{EXPORT_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><button className="projects-export" type="button" onClick={() => { void exportProjects() }} disabled={isExporting}><Download aria-hidden="true" size={18} />{isExporting ? 'Descargando...' : 'Descargar Excel'}</button>{canWrite ? <button className="projects-create" type="button" onClick={openCreate} disabled={isLoading || isPending}><Plus aria-hidden="true" size={18} /> Nuevo proyecto</button> : null}</div>
       </header>
      <form className="projects-filters" onSubmit={(event) => { event.preventDefault(); setAppliedFilters({ ...filters }); setPage(0) }}>
        <label>Buscar<input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Ejecutivo, proyecto o empresa" /></label>
        <label>Fecha de evento<input type="date" value={filters.eventDate} onChange={(event) => setFilters((current) => ({ ...current, eventDate: event.target.value }))} /></label>
        <label>Aprobado<select value={filters.approved} onChange={(event) => setFilters((current) => ({ ...current, approved: event.target.value as ProjectFilters['approved'] }))}><option value="">Todos</option><option value="PENDIENTE">Pendiente</option><option value="SI">Sí</option><option value="NO">No</option></select></label>
        <label>Estado<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as ProjectFilters['status'] }))}><option value="">Todos</option><option value="VIGENTE">Vigente</option><option value="EJECUTADO">Ejecutado</option><option value="PERDIDO">Perdido</option><option value="CANCELADO">Cancelado</option></select></label>
        <div className="projects-filter-actions"><button className="projects-filter-submit" type="submit" disabled={isLoading || isPending}><Search aria-hidden="true" size={16} />Buscar</button><button className="projects-filter-reset" type="button" onClick={() => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); setPage(0) }} disabled={isLoading || isPending}><RotateCcw aria-hidden="true" size={16} />Limpiar</button></div>
      </form>
      {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
      <div className="projects-table-card">
        <div className="projects-table-heading"><FolderKanban aria-hidden="true" size={20} /><span>{isLoading ? 'Cargando proyectos...' : `${projectPage.totalElements} proyecto${projectPage.totalElements === 1 ? '' : 's'}`}</span></div>
        <div className="projects-table-scroll"><table><thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{header.isPlaceholder ? null : <table.FlexRender header={header} />}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getAllCells().map((cell) => <td key={cell.id}><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody></table>{!isLoading && projects.length === 0 ? <p className="projects-empty">No hay proyectos registrados.</p> : null}</div>
        {projectPage.totalElements > 0 ? <div className="projects-pagination"><span>Mostrando {page * projectPage.size + 1}-{Math.min((page + 1) * projectPage.size, projectPage.totalElements)} de {projectPage.totalElements}</span><div><button type="button" onClick={() => setPage(page - 1)} disabled={isLoading || page === 0}>Anterior</button><span>Página {page + 1} de {projectPage.totalPages}</span><button type="button" onClick={() => setPage(page + 1)} disabled={isLoading || page + 1 >= projectPage.totalPages}>Siguiente</button></div></div> : null}
      </div>
      {editor ? <div className="projects-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) closeEditor() }}><form className="projects-editor" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="project-editor-title"><div><p className="dashboard-kicker">{editor === 'create' ? 'Nuevo registro' : 'Detalle del evento'}</p><h3 id="project-editor-title">{editor === 'create' ? 'Registrar proyecto' : editor.projectName}</h3></div><fieldset className="projects-editor-fields" disabled={isPending || !canSaveEditor}><div className="projects-form-fields">
        <label className="projects-company-picker">Empresa<button className="projects-company-trigger" type="button" onClick={() => setIsCompanyMenuOpen((open) => !open)} aria-expanded={isCompanyMenuOpen}>{companies.find((company) => company.id === form.companyId)?.name ?? 'Selecciona una empresa'}</button>{isCompanyMenuOpen ? <div className="projects-company-menu"><div className="projects-company-search"><Search aria-hidden="true" size={17} /><input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Buscar empresa" autoFocus /></div><div className="projects-company-options">{companies.filter((company) => `${company.name} ${company.ruc}`.toLowerCase().includes(companySearch.trim().toLowerCase())).map((company) => <button key={company.id} type="button" onClick={() => { setField('companyId', company.id); setCompanySearch(''); setIsCompanyMenuOpen(false) }}><strong>{company.name}</strong><small>{company.ruc}</small></button>)}{companies.filter((company) => `${company.name} ${company.ruc}`.toLowerCase().includes(companySearch.trim().toLowerCase())).length === 0 ? <p>No hay empresas que coincidan.</p> : null}</div></div> : null}</label>
        <label>Proyecto<input value={form.projectName} onChange={(event) => setField('projectName', event.target.value)} required maxLength={150} /></label>
        {editor !== 'create' ? <><label>Aprobado<select value={form.approved} onChange={(event) => { const approved = event.target.value as ProjectForm['approved']; setForm((current) => ({ ...current, approved, status: approved === 'NO' ? 'PERDIDO' : 'VIGENTE' })) }}>{editor.approved === 'PENDIENTE' ? <><option value="PENDIENTE">Pendiente</option><option value="SI">Sí</option><option value="NO">No</option></> : <option value={editor.approved}>{editor.approved === 'SI' ? 'Sí' : 'No'}</option>}</select></label><label>Estado<select value={form.status} onChange={(event) => setField('status', event.target.value)}>{editor.status === 'VIGENTE' ? form.approved === 'NO' ? <option value="PERDIDO">Perdido</option> : <><option value="VIGENTE">Vigente</option>{editor.approved === 'SI' ? <option value="EJECUTADO">Ejecutado</option> : null}</> : <option value={editor.status}>{editor.status.charAt(0) + editor.status.slice(1).toLowerCase()}</option>}</select></label></> : null}
        <label>PPTO total sin IGV<input type="number" min="0" step="0.01" value={form.totalBudget} onChange={(event) => setField('totalBudget', event.target.value)} required /></label>
        <label>Año<input type="number" min="2000" max="2100" value={form.year} onChange={(event) => setField('year', event.target.value)} required /></label>
        <label>Fecha evento<span className="projects-date-field"><input type="date" value={form.eventDate} onChange={(event) => setField('eventDate', event.target.value)} required /><button type="button" aria-label="Abrir calendario" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement | null; input?.showPicker() }}><CalendarDays aria-hidden="true" size={18} /></button></span></label>
        <label>Facturación tentativa<span className="projects-date-field"><input type="month" value={form.tentativeBillingMonth} onChange={(event) => setField('tentativeBillingMonth', event.target.value)} required /><button type="button" aria-label="Abrir selector de facturación" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement | null; input?.showPicker() }}><CalendarDays aria-hidden="true" size={18} /></button></span></label>
        <label>Facturación final sin IGV<input type="number" min="0" step="0.01" value={form.finalBilling} onChange={(event) => setField('finalBilling', event.target.value)} /></label>
        <label className="projects-observations">Observaciones<textarea value={form.observations} onChange={(event) => setField('observations', event.target.value)} maxLength={2000} /></label>
      </div></fieldset><div className="projects-editor-actions"><button type="button" onClick={closeEditor} disabled={isPending}>Cerrar</button>{canSaveEditor ? <button type="submit" disabled={isPending}>{isPending ? 'Guardando...' : editor === 'create' ? 'Crear proyecto' : 'Guardar cambios'}</button> : null}</div></form></div> : null}
    </section>
  )
}
