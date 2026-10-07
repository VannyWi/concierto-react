import { useEffect, useState, useTransition } from 'react'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import './project-management.css'

type Role = 'ADMIN' | 'GERENTE' | 'CONTADOR' | 'EJECUTIVO'
type ApiResponse<T> = { success: boolean; message: string; data?: T }
type Company = { id: string; name: string; ruc: string }
type Project = { id: string; createdById: string; companyId: string; companyName: string; companyRuc: string; projectName: string; observations: string | null; approved: 'PENDIENTE' | 'SI' | 'NO'; status: 'VIGENTE' | 'EJECUTADO' | 'PERDIDO' | 'CANCELADO'; totalBudget: number; year: number; eventDate: string; tentativeBillingMonth: string; finalBilling: number | null }
type ProjectForm = { companyId: string; projectName: string; observations: string; approved: Project['approved']; status: Project['status']; totalBudget: string; year: string; eventDate: string; tentativeBillingMonth: string; finalBilling: string }
type HistoryEntry = { id: string; changedBy: string; previousApproval: string; newApproval: string; previousStatus: string; newStatus: string; changedAt: string }

function formFromProject(project: Project): ProjectForm {
  return { companyId: project.companyId, projectName: project.projectName, observations: project.observations ?? '', approved: project.approved, status: project.status, totalBudget: project.totalBudget.toString(), year: project.year.toString(), eventDate: project.eventDate, tentativeBillingMonth: project.tentativeBillingMonth, finalBilling: project.finalBilling?.toString() ?? '' }
}

function approvalIndicator(approved: Project['approved']) {
  const label = approved === 'SI' ? 'Aprobado' : approved === 'NO' ? 'No aprobado' : 'Pendiente'
  return <span className={`project-indicator is-${approved === 'SI' ? 'approved' : approved === 'NO' ? 'rejected' : 'pending'}`}><span aria-hidden="true" />{label}</span>
}

function statusIndicator(status: Project['status']) {
  return <span className={`project-indicator is-${status.toLowerCase()}`}><span aria-hidden="true" />{status.charAt(0) + status.slice(1).toLowerCase()}</span>
}

function approvalLabel(value: string) {
  if (!value) return ''
  return value === 'SI' ? 'Sí' : value === 'NO' ? 'No' : 'Pendiente'
}

function statusLabel(value: string) {
  if (!value) return ''
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function historyAction(entry: HistoryEntry) {
  const approvalChanged = entry.previousApproval !== entry.newApproval
  const statusChanged = entry.previousStatus !== entry.newStatus

  if (approvalChanged && entry.newApproval === 'SI') return 'Aprobó el proyecto.'
  if (approvalChanged && entry.newApproval === 'NO' && statusChanged) return `No aprobó el proyecto y lo marcó como ${statusLabel(entry.newStatus).toLowerCase()}.`
  if (statusChanged && entry.newStatus === 'EJECUTADO') return 'Marcó el proyecto como ejecutado.'
  if (approvalChanged) return `Cambió la aprobación de ${approvalLabel(entry.previousApproval)} a ${approvalLabel(entry.newApproval)}.`
  if (statusChanged) return `Cambió el estado de ${statusLabel(entry.previousStatus)} a ${statusLabel(entry.newStatus)}.`
  return 'Actualizó el estado del proyecto.'
}

async function message(response: Response) {
  const result = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
  return result?.message ?? 'No fue posible completar la solicitud.'
}

export function ProjectDetailPage({ apiUrl, roleName, userId, projectId }: { apiUrl: string; roleName: Role; userId: string; projectId: string }) {
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [form, setForm] = useState<ProjectForm | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingObservation, setIsEditingObservation] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  async function refreshHistory() {
    const response = await fetch(`${apiUrl}/api/v1/projects/${projectId}/history?refresh=${Date.now()}`, { credentials: 'include', cache: 'no-store' })
    if (!response.ok) throw new Error(await message(response))
    const result = (await response.json()) as ApiResponse<HistoryEntry[]>
    if (!result.success) throw new Error(result.message)
    setHistory(result.data ?? [])
  }

  async function load() {
    setIsLoading(true)
    try {
      const [projectResponse, companyResponse, historyResponse] = await Promise.all([
        fetch(`${apiUrl}/api/v1/projects/${projectId}`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/v1/companies?active=true`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/v1/projects/${projectId}/history?refresh=${Date.now()}`, { credentials: 'include', cache: 'no-store' }),
      ])
      if (!projectResponse.ok) throw new Error(await message(projectResponse))
      if (!companyResponse.ok) throw new Error(await message(companyResponse))
      if (!historyResponse.ok) throw new Error(await message(historyResponse))
      const projectResult = (await projectResponse.json()) as ApiResponse<Project>
      const companyResult = (await companyResponse.json()) as ApiResponse<{ content: Company[] }>
      const historyResult = (await historyResponse.json()) as ApiResponse<HistoryEntry[]>
      if (!projectResult.data || !companyResult.data) throw new Error('No fue posible cargar el detalle del proyecto.')
      setProject(projectResult.data)
      setForm(formFromProject(projectResult.data))
      setCompanies(companyResult.data.content)
      setHistory(historyResult.data ?? [])
      setIsRejecting(false)
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar el detalle del proyecto.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void load() }, [apiUrl, projectId])

  function setField(field: keyof ProjectForm, value: string) {
    setForm((current) => current ? { ...current, [field]: value } : current)
  }

  function save(formToSave: ProjectForm) {
    if (!project) return
    startTransition(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/projects/${project.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formToSave, observations: formToSave.observations || null, totalBudget: Number(formToSave.totalBudget), year: Number(formToSave.year), finalBilling: formToSave.finalBilling ? Number(formToSave.finalBilling) : null, costsWithoutVat: null }),
        })
        if (!response.ok) throw new Error(await message(response))
        const result = (await response.json()) as ApiResponse<Project>
        if (!result.success || !result.data) throw new Error(result.message || 'No fue posible guardar el proyecto.')
        setProject(result.data)
        setForm(formFromProject(result.data))
        setIsEditing(false)
        setIsEditingObservation(false)
        try {
          await refreshHistory()
          setError('')
        } catch (historyError) {
          setError(historyError instanceof Error ? `El proyecto fue actualizado, pero no se pudo refrescar la bitácora: ${historyError.message}` : 'El proyecto fue actualizado, pero no se pudo refrescar la bitácora.')
        }
        void Swal.fire({ icon: 'success', title: 'Proyecto actualizado.', timer: 1800, showConfirmButton: false })
      } catch (requestError) {
        void Swal.fire({ icon: 'error', title: requestError instanceof Error ? requestError.message : 'No fue posible guardar el proyecto.' })
      }
    })
  }

  async function requestStateChange(approved: Project['approved'], status: Project['status']) {
    if (!form) return
    const isApproval = form.approved === 'PENDIENTE' && approved === 'SI'
    const confirmation = await Swal.fire(isApproval
      ? { title: '¿Confirma que el proyecto sí fue aprobado?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar', reverseButtons: true }
      : { title: '¿Confirmar cambio de estado?', text: 'Este cambio es definitivo y no podrá revertirse.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Confirmar cambio', cancelButtonText: 'Cancelar', reverseButtons: true })
    if (confirmation.isConfirmed) save({ ...form, approved, status })
  }

  async function beginRejection() {
    const confirmation = await Swal.fire({ title: '¿Confirma que el proyecto no fue aprobado?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar', reverseButtons: true })
    if (confirmation.isConfirmed) setIsRejecting(true)
  }

  if (isLoading) return <section className="projects-management"><p>Cargando detalle del proyecto...</p></section>
  if (!project || !form) return <section className="projects-management"><button className="projects-back" type="button" onClick={() => navigate('/projects')}><ArrowLeft size={17} /> Volver a proyectos</button><p className="dashboard-error" role="alert">{error || 'Proyecto no encontrado.'}</p></section>

  const canEdit = roleName === 'ADMIN' || (roleName === 'EJECUTIVO' && project.createdById === userId)
  const hasSelectedCompany = companies.some((company) => company.id === form.companyId)
  const workflowApproval = isRejecting ? 'NO' : project.approved
  const cancelEdit = () => { setForm(formFromProject(project)); setIsEditing(false) }
  const cancelObservationEdit = () => { setForm(formFromProject(project)); setIsEditingObservation(false) }

  return (
    <section className="projects-management">
      <header className="projects-detail-header">
        <div>
          <button className="projects-back" type="button" onClick={() => navigate('/projects')}><ArrowLeft size={17} /> Volver a proyectos</button>
          <p className="dashboard-kicker">Detalle del evento</p>
          <h2>{project.projectName}</h2>
          <p>{canEdit ? 'Consulta la información y edítala solo cuando lo necesites.' : 'Consulta la información y la bitácora del evento.'}</p>
        </div>
      </header>
      {error ? <p className="dashboard-error" role="alert">{error}</p> : null}

      <section className="project-workflow" aria-label="Flujo del proyecto">
        <article className="project-workflow-step">
          <span className="project-workflow-number">1</span>
          <div>
            <strong>Aprobación</strong>
            <p>¿El proyecto fue aprobado?</p>
            {approvalIndicator(workflowApproval)}
          </div>
          {canEdit && project.approved === 'PENDIENTE' && !isRejecting ? <div className="project-workflow-actions">
            <button className="projects-edit project-approve" type="button" onClick={() => { void requestStateChange('SI', 'VIGENTE') }} disabled={isPending}>Sí</button>
            <button className="projects-edit project-reject" type="button" onClick={() => { void beginRejection() }} disabled={isPending}>No</button>
          </div> : null}
        </article>
        <article className={workflowApproval === 'PENDIENTE' ? 'project-workflow-step is-locked' : 'project-workflow-step'}>
          <span className="project-workflow-number">2</span>
          <div>
            <strong>Estado del evento</strong>
            {workflowApproval === 'PENDIENTE' ? <p>Disponible después de decidir la aprobación.</p> : isRejecting ? <p>Selecciona el estado final del proyecto.</p> : statusIndicator(project.status)}
          </div>
          {canEdit && isRejecting ? <div className="project-workflow-actions">
            <button className="projects-edit project-reject" type="button" onClick={() => { void requestStateChange('NO', 'PERDIDO') }} disabled={isPending}>Perdido</button>
            <button className="projects-edit project-reject" type="button" onClick={() => { void requestStateChange('NO', 'CANCELADO') }} disabled={isPending}>Cancelado</button>
          </div> : null}
          {canEdit && project.approved === 'SI' && project.status === 'VIGENTE' ? <div className="project-workflow-actions">
            <button className="projects-edit project-complete" type="button" onClick={() => { void requestStateChange('SI', 'EJECUTADO') }} disabled={isPending}>Marcar ejecutado</button>
          </div> : null}
        </article>
      </section>

      <section className="projects-detail-card">
        <div className="project-detail-card-heading">
          <h3>Información del evento</h3>
          {canEdit ? <button className="projects-edit" type="button" onClick={() => { setForm(formFromProject(project)); setIsEditing(true) }} disabled={isEditing || isPending}>Editar información</button> : null}
        </div>
        <dl className="project-detail-data">
          <div><dt>Empresa</dt><dd>{project.companyName}<small>{project.companyRuc}</small></dd></div>
          <div><dt>PPTO total sin IGV</dt><dd>{project.totalBudget.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</dd></div>
          <div><dt>Año</dt><dd>{project.year}</dd></div>
          <div><dt>Fecha del evento</dt><dd>{project.eventDate}</dd></div>
          <div><dt>Facturación tentativa</dt><dd>{project.tentativeBillingMonth}</dd></div>
          <div><dt>Facturación final sin IGV</dt><dd>{project.finalBilling?.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }) ?? '-'}</dd></div>
        </dl>
      </section>

      <section className="project-observations">
        <div className="project-detail-card-heading">
          <div><h3>Observaciones</h3><p>Notas internas sobre el evento.</p></div>
          {canEdit && !isEditingObservation ? <button className="projects-edit" type="button" onClick={() => setIsEditingObservation(true)} disabled={isPending}>Editar observaciones</button> : null}
        </div>
        {isEditingObservation ? <form onSubmit={(event) => { event.preventDefault(); save(form) }}><textarea value={form.observations} onChange={(event) => setField('observations', event.target.value)} maxLength={2000} aria-label="Observaciones" /><div className="projects-editor-actions"><button type="button" onClick={cancelObservationEdit} disabled={isPending}>Cancelar</button><button type="submit" disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar observaciones'}</button></div></form> : <p className={project.observations ? 'project-observation-text' : 'project-observation-empty'}>{project.observations || 'No hay observaciones registradas.'}</p>}
      </section>

      <section className="projects-history" aria-labelledby="project-history-title">
        <header className="projects-history-heading"><div><h3 id="project-history-title">Bitácora</h3><p>Movimientos de aprobación y estado.</p></div>{history.length > 0 ? <span>{history.length} {history.length === 1 ? 'movimiento' : 'movimientos'}</span> : null}</header>
        {history.length === 0 ? <p className="projects-history-empty">Aún no hay movimientos de estado.</p> : <ol>{history.map((entry) => <li key={entry.id}><span className="projects-history-marker" aria-hidden="true" /><div><p>{historyAction(entry)}</p><footer><span>{entry.changedBy}</span><time dateTime={entry.changedAt}>{new Date(entry.changedAt).toLocaleString('es-PE')}</time></footer></div></li>)}</ol>}
      </section>
      {isEditing ? <div className="projects-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) cancelEdit() }}><form className="projects-editor project-detail-editor" onSubmit={(event) => { event.preventDefault(); save(form) }} role="dialog" aria-modal="true" aria-labelledby="project-detail-editor-title"><div><p className="dashboard-kicker">Detalle del evento</p><h3 id="project-detail-editor-title">Editar información</h3></div><fieldset className="projects-editor-fields" disabled={isPending}><div className="projects-form-fields">
        <label>Empresa<select value={form.companyId} onChange={(event) => setField('companyId', event.target.value)} required><option value="">Selecciona una empresa</option>{!hasSelectedCompany ? <option value={project.companyId}>{project.companyName} - {project.companyRuc}</option> : null}{companies.map((company) => <option key={company.id} value={company.id}>{company.name} - {company.ruc}</option>)}</select></label>
        <label>Proyecto<input value={form.projectName} onChange={(event) => setField('projectName', event.target.value)} required maxLength={150} /></label>
        <label>PPTO total sin IGV<input type="number" min="0" step="0.01" value={form.totalBudget} onChange={(event) => setField('totalBudget', event.target.value)} required /></label>
        <label>Año<input type="number" min="2000" max="2100" value={form.year} onChange={(event) => setField('year', event.target.value)} required /></label>
        <label>Fecha evento<span className="projects-date-field"><input type="date" value={form.eventDate} onChange={(event) => setField('eventDate', event.target.value)} required /><button type="button" aria-label="Abrir calendario" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement | null; input?.showPicker() }}><CalendarDays aria-hidden="true" size={18} /></button></span></label>
        <label>Facturación tentativa<span className="projects-date-field"><input type="month" value={form.tentativeBillingMonth} onChange={(event) => setField('tentativeBillingMonth', event.target.value)} required /><button type="button" aria-label="Abrir selector de facturación" onClick={(event) => { const input = event.currentTarget.previousElementSibling as HTMLInputElement | null; input?.showPicker() }}><CalendarDays aria-hidden="true" size={18} /></button></span></label>
        <label>Facturación final sin IGV<input type="number" min="0" step="0.01" value={form.finalBilling} onChange={(event) => setField('finalBilling', event.target.value)} /></label>
      </div></fieldset><div className="projects-editor-actions"><button type="button" onClick={cancelEdit} disabled={isPending}>Cancelar</button><button type="submit" disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar cambios'}</button></div></form></div> : null}
    </section>
  )
}
