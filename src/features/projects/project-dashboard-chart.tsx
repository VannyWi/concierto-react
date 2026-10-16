import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import './project-dashboard-chart.css'

type ApiResponse<T> = { success: boolean; message: string; data?: T }
type Company = { id: string; name: string; ruc: string }
type CompanyPage = { content: Company[]; totalPages: number }
type Executive = { id: string; firstName: string; lastName: string; username: string }
type YearlyData = { year: number; executed: number; lost: number; cancelled: number }
type DashboardData = { pending: number; executed: number; lost: number; cancelled: number; yearly: YearlyData[] }

const EMPTY_DATA: DashboardData = { pending: 0, executed: 0, lost: 0, cancelled: 0, yearly: [] }
const MAX_RANGE_YEARS = 5
const SERIES = [
  { key: 'executed', name: 'Ejecutados', color: '#3975d9' },
  { key: 'lost', name: 'Perdidos', color: '#d38a22' },
  { key: 'cancelled', name: 'Cancelados', color: '#d44b60' },
] as const

export function ProjectDashboardChart({ apiUrl }: { apiUrl: string }) {
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [fromYear, setFromYear] = useState<number | null>(null)
  const [toYear, setToYear] = useState<number | null>(null)
  const [companyId, setCompanyId] = useState('')
  const [companySearch, setCompanySearch] = useState('')
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false)
  const companyPickerRef = useRef<HTMLLabelElement>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [executives, setExecutives] = useState<Executive[]>([])
  const [executiveId, setExecutiveId] = useState('')
  const [executiveSearch, setExecutiveSearch] = useState('')
  const [isExecutiveMenuOpen, setIsExecutiveMenuOpen] = useState(false)
  const executivePickerRef = useRef<HTMLLabelElement>(null)
  const [summaryYear, setSummaryYear] = useState<number | null>(null)
  const [summary, setSummary] = useState<DashboardData>(EMPTY_DATA)
  const [data, setData] = useState<DashboardData>(EMPTY_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    async function loadCompanies() {
      try {
        const response = await fetch(`${apiUrl}/api/v1/companies`, { credentials: 'include' })
        const result = (await response.json()) as ApiResponse<CompanyPage>
        if (!response.ok || !result.success || !result.data) throw new Error()
        const remainingPages = await Promise.all(Array.from({ length: Math.max(result.data.totalPages - 1, 0) }, async (_, index) => {
          const pageResponse = await fetch(`${apiUrl}/api/v1/companies?page=${index + 1}`, { credentials: 'include' })
          const pageResult = (await pageResponse.json()) as ApiResponse<CompanyPage>
          if (!pageResponse.ok || !pageResult.success || !pageResult.data) throw new Error()
          return pageResult.data.content
        }))
        if (isCurrent) setCompanies(result.data.content.concat(...remainingPages))
      } catch {
        if (isCurrent) setCompanies([])
      }
    }
    void loadCompanies()
    return () => { isCurrent = false }
  }, [apiUrl])

  useEffect(() => {
    let isCurrent = true
    void fetch(`${apiUrl}/api/v1/projects/executives`, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<Executive[]>
        if (!response.ok || !result.success || !result.data) throw new Error()
        if (isCurrent) setExecutives(result.data)
      })
      .catch(() => { if (isCurrent) setExecutives([]) })
    return () => { isCurrent = false }
  }, [apiUrl])

  useEffect(() => {
    function closeMenus(event: MouseEvent) {
      if (companyPickerRef.current && !companyPickerRef.current.contains(event.target as Node)) setIsCompanyMenuOpen(false)
      if (executivePickerRef.current && !executivePickerRef.current.contains(event.target as Node)) setIsExecutiveMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [])

  useEffect(() => {
    let isCurrent = true
    void fetch(`${apiUrl}/api/v1/projects/years`, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<number[]>
        if (!response.ok || !result.success || !result.data) throw new Error()
        if (!isCurrent) return
        setAvailableYears(result.data)
        const endYear = result.data.at(-1)
        const startYear = endYear === undefined ? undefined : result.data.find((year) => endYear - year < MAX_RANGE_YEARS)
        setFromYear(startYear ?? null)
        setToYear(endYear ?? null)
        setSummaryYear(endYear ?? null)
      })
      .catch(() => { if (isCurrent) setAvailableYears([]) })
    return () => { isCurrent = false }
  }, [apiUrl])

  useEffect(() => {
    if (summaryYear === null) {
      setSummary(EMPTY_DATA)
      return
    }
    let isCurrent = true
    void fetch(`${apiUrl}/api/v1/projects/dashboard?fromYear=${summaryYear}&toYear=${summaryYear}`, { credentials: 'include' })
      .then(async (response) => {
        const result = (await response.json()) as ApiResponse<DashboardData>
        if (!response.ok || !result.success || !result.data) throw new Error()
        if (isCurrent) setSummary(result.data)
      })
      .catch(() => { if (isCurrent) setSummary(EMPTY_DATA) })
    return () => { isCurrent = false }
  }, [apiUrl, summaryYear])

  useEffect(() => {
    if (fromYear === null || toYear === null) {
      setData(EMPTY_DATA)
      setIsLoading(false)
      return
    }
    let isCurrent = true
    const params = new URLSearchParams({ fromYear: fromYear.toString(), toYear: toYear.toString() })
    if (companyId) params.set('companyId', companyId)
    if (executiveId) params.set('executiveId', executiveId)
    setIsLoading(true)
    setError('')
    setData(EMPTY_DATA)

    void fetch(`${apiUrl}/api/v1/projects/dashboard?${params}`, { credentials: 'include' })
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
  }, [apiUrl, companyId, executiveId, fromYear, toYear])

  const summaryData = [
    { name: 'Pendientes', value: summary.pending, color: '#7653d4' },
    ...SERIES.map((item) => ({ ...item, value: summary[item.key] })),
  ]
  const yearly = fromYear !== null && toYear !== null && data.yearly.length === toYear - fromYear + 1
    ? data.yearly
    : fromYear !== null && toYear !== null
      ? Array.from({ length: toYear - fromYear + 1 }, (_, index) => ({ year: fromYear + index, executed: 0, lost: 0, cancelled: 0 }))
      : []
  const highestValue = Math.max(...yearly.flatMap((item) => SERIES.map((series) => item[series.key])), 1)
  const chartWidth = Math.max(640, yearly.length * 145)
  const chartHeight = 270
  const left = 42
  const right = 18
  const top = 16
  const bottom = 32
  const plotWidth = chartWidth - left - right
  const plotHeight = chartHeight - top - bottom
  const groupWidth = plotWidth / Math.max(yearly.length, 1)
  const barGap = 5
  const barWidth = Math.min(32, (groupWidth - 24) / SERIES.length)
  const selectedCompany = companies.find((company) => company.id === companyId)
  const matchingCompanies = companies.filter((company) => `${company.name} ${company.ruc}`.toLowerCase().includes(companySearch.trim().toLowerCase()))
  const selectedExecutive = executives.find((executive) => executive.id === executiveId)
  const matchingExecutives = executives.filter((executive) => `${executive.firstName} ${executive.lastName}`.toLowerCase().includes(executiveSearch.trim().toLowerCase()))

  function resetChartFilters() {
    const endYear = availableYears.at(-1)
    const startYear = endYear === undefined ? undefined : availableYears.find((year) => endYear - year < MAX_RANGE_YEARS)
    setFromYear(startYear ?? null)
    setToYear(endYear ?? null)
    setCompanyId('')
    setCompanySearch('')
    setIsCompanyMenuOpen(false)
    setExecutiveId('')
    setExecutiveSearch('')
    setIsExecutiveMenuOpen(false)
  }

  return <section className="project-dashboard-overview" aria-labelledby="events-chart-title">
    <div className="project-dashboard-summary-heading"><div><p className="dashboard-kicker">Resumen anual</p><h2>Estado de proyectos</h2></div><label>Año<select value={summaryYear ?? ''} onChange={(event) => setSummaryYear(Number(event.target.value))} disabled={availableYears.length === 0}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
    <div className="project-dashboard-metrics">
      {summaryData.map((item) => <div key={item.name} style={{ borderLeftColor: item.color }}><span>{item.name === 'Pendientes' ? 'Proyectos pendientes' : `Eventos ${item.name.toLowerCase()}`}</span><strong>{item.value}</strong></div>)}
    </div>
    <section className="project-dashboard-chart">
      <div className="project-dashboard-chart-heading">
        <div><p className="dashboard-kicker">Eventos</p><h2 id="events-chart-title">Eventos por año</h2></div>
        <div className="project-dashboard-range">
          <label>Desde<select value={fromYear ?? ''} onChange={(event) => { const next = Number(event.target.value); setFromYear(next); if (toYear === null || next > toYear) setToYear(next); else if (toYear - next >= MAX_RANGE_YEARS) setToYear(availableYears.filter((year) => year >= next && year - next < MAX_RANGE_YEARS).at(-1) ?? next) }} disabled={availableYears.length === 0}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label>Hasta<select value={toYear ?? ''} onChange={(event) => { const next = Number(event.target.value); setToYear(next); if (fromYear === null || next < fromYear) setFromYear(next); else if (next - fromYear >= MAX_RANGE_YEARS) setFromYear(availableYears.find((year) => year <= next && next - year < MAX_RANGE_YEARS) ?? next) }} disabled={availableYears.length === 0}>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
           <label ref={companyPickerRef} className="project-dashboard-company-picker">Empresa<button className="project-dashboard-company-trigger" type="button" onClick={() => setIsCompanyMenuOpen((open) => !open)} aria-expanded={isCompanyMenuOpen}>{selectedCompany ? `${selectedCompany.name} (${selectedCompany.ruc})` : 'Todas las empresas'}</button>{isCompanyMenuOpen ? <div className="project-dashboard-company-menu"><div className="project-dashboard-company-search"><Search aria-hidden="true" size={17} /><input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Buscar empresa" autoFocus /></div><div className="project-dashboard-company-options"><button type="button" onClick={() => { setCompanyId(''); setCompanySearch(''); setIsCompanyMenuOpen(false) }}>Todas las empresas</button>{matchingCompanies.map((company) => <button key={company.id} type="button" onClick={() => { setCompanyId(company.id); setCompanySearch(''); setIsCompanyMenuOpen(false) }}><strong>{company.name}</strong><small>{company.ruc}</small></button>)}{matchingCompanies.length === 0 ? <p>No hay empresas que coincidan.</p> : null}</div></div> : null}</label>
          <label ref={executivePickerRef} className="project-dashboard-company-picker">Ejecutivo<button className="project-dashboard-company-trigger" type="button" onClick={() => setIsExecutiveMenuOpen((open) => !open)} aria-expanded={isExecutiveMenuOpen}>{selectedExecutive ? `${selectedExecutive.firstName} ${selectedExecutive.lastName}` : 'Todos los ejecutivos'}</button>{isExecutiveMenuOpen ? <div className="project-dashboard-company-menu"><div className="project-dashboard-company-search"><Search aria-hidden="true" size={17} /><input value={executiveSearch} onChange={(event) => setExecutiveSearch(event.target.value)} placeholder="Buscar ejecutivo" autoFocus /></div><div className="project-dashboard-company-options"><button type="button" onClick={() => { setExecutiveId(''); setExecutiveSearch(''); setIsExecutiveMenuOpen(false) }}>Todos los ejecutivos</button>{matchingExecutives.map((executive) => <button key={executive.id} type="button" onClick={() => { setExecutiveId(executive.id); setExecutiveSearch(''); setIsExecutiveMenuOpen(false) }}><strong>{executive.firstName} {executive.lastName}</strong></button>)}{matchingExecutives.length === 0 ? <p>No hay ejecutivos que coincidan.</p> : null}</div></div> : null}</label>
          <button className="project-dashboard-filter-reset" type="button" onClick={resetChartFilters}>Limpiar filtros</button>
        </div>
      </div>
      {error ? <p className="dashboard-error" role="alert">{error}</p> : null}
      <div className="project-dashboard-chart-canvas" aria-label={`Resultados anuales de eventos desde ${fromYear ?? ''} hasta ${toYear ?? ''}`}>
        {isLoading ? <p>Cargando eventos...</p> : <>
          <div className="project-dashboard-legend">{SERIES.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.name}</span>)}</div>
          <div className="project-dashboard-plot-scroll">
            <svg className="project-dashboard-bar-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`Gráfico de barras de proyectos por año desde ${fromYear ?? ''} hasta ${toYear ?? ''}`}>
              <title>Proyectos ejecutados, perdidos y cancelados por año</title>
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => <g key={ratio}><line x1={left} x2={chartWidth - right} y1={top + plotHeight * ratio} y2={top + plotHeight * ratio} /><text className="project-dashboard-axis-label" x={left - 8} y={top + plotHeight * ratio + 4}>{Math.round(highestValue * (1 - ratio))}</text></g>)}
              {yearly.map((year, yearIndex) => {
                const barsWidth = SERIES.length * barWidth + (SERIES.length - 1) * barGap
                const groupX = left + yearIndex * groupWidth + (groupWidth - barsWidth) / 2
                return <g key={year.year}>
                  {SERIES.map((series, seriesIndex) => {
                    const value = year[series.key]
                    const height = value / highestValue * plotHeight
                    const x = groupX + seriesIndex * (barWidth + barGap)
                    const y = top + plotHeight - height
                    return <g key={series.key}>
                      <rect x={x} y={y} width={barWidth} height={height} fill={series.color} rx="2" tabIndex={0}><title>{`${year.year}: ${value} ${series.name.toLowerCase()}`}</title></rect>
                      {height >= 16 ? <text className="project-dashboard-bar-value" x={x + barWidth / 2} y={y + height / 2 + 4}>{value}</text> : null}
                    </g>
                  })}
                  <text className="project-dashboard-year-label" x={left + yearIndex * groupWidth + groupWidth / 2} y={chartHeight - 10}>{year.year}</text>
                </g>
              })}
            </svg>
          </div>
        </>}
      </div>
    </section>
  </section>
}
