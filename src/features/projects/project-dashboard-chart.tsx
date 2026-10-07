import { useEffect, useState } from 'react'
import './project-dashboard-chart.css'

type ApiResponse<T> = { success: boolean; message: string; data?: T }
type DashboardData = { pending: number; executed: number; lost: number; cancelled: number }

const EMPTY_DATA: DashboardData = { pending: 0, executed: 0, lost: 0, cancelled: 0 }
const YEARS = Array.from({ length: 101 }, (_, index) => 2100 - index)

export function ProjectDashboardChart({ apiUrl }: { apiUrl: string }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setError('')

    void fetch(`${apiUrl}/api/v1/projects/dashboard?year=${year}`, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<DashboardData>
        if (!response.ok || !result.success || !result.data) throw new Error(result.message || 'No fue posible cargar los eventos.')
        if (isCurrent) setData(result.data)
      })
      .catch((requestError) => {
        if (isCurrent) setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los eventos.')
      })
      .finally(() => { if (isCurrent) setIsLoading(false) })

    return () => { isCurrent = false }
  }, [apiUrl, year])

  const chartData = [
    { name: 'Ejecutados', value: data.executed, color: '#16865b' },
    { name: 'Perdidos', value: data.lost, color: '#c78314' },
    { name: 'Cancelados', value: data.cancelled, color: '#c53c4e' },
  ]
  const highestValue = Math.max(...chartData.map((item) => item.value), 1)
  const summaryData = [{ name: 'Pendientes', value: data.pending, color: '#7653d4' }, ...chartData]

  return <section className="project-dashboard-overview" aria-labelledby="events-chart-title">
    <div className="project-dashboard-metrics">{summaryData.map((item) => <div key={item.name} style={{ borderLeftColor: item.color }}><span>{item.name === 'Pendientes' ? 'Proyectos pendientes' : `Eventos ${item.name.toLowerCase()}`}</span><strong>{item.value}</strong></div>)}</div>
    <section className="project-dashboard-chart">
    <div className="project-dashboard-chart-heading">
      <div><p className="dashboard-kicker">Eventos</p><h2 id="events-chart-title">Resultado de eventos</h2><p>Eventos ejecutados, perdidos y cancelados.</p></div>
      <label>Año<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{YEARS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
    </div>
    {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
    <div className="project-dashboard-chart-canvas" aria-label={`Resultados de eventos del año ${year}`}>
      {isLoading ? <p>Cargando eventos...</p> : <div className="project-dashboard-bars">{chartData.map((item) => <div key={item.name} className="project-dashboard-bar"><strong>{item.value}</strong><div><span style={{ height: `${(item.value / highestValue) * 100}%`, background: item.color }} /></div><small>{item.name}</small></div>)}</div>}
    </div>
    </section>
  </section>
}
