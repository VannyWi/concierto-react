import { Route, Routes, useParams } from 'react-router-dom'
import { DashboardPage } from '../pages/dashboard-page.tsx'
import { LoginPage } from '../pages/login-page.tsx'

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/account" element={<DashboardPage section="account" />} />
      <Route path="/settings" element={<DashboardPage section="settings" />} />
      <Route path="/users" element={<DashboardPage section="users" />} />
      <Route path="/projects" element={<DashboardPage section="projects" />} />
      <Route path="/projects/:projectId" element={<ProjectDetailRoute />} />
      <Route path="/companies" element={<DashboardPage section="companies" />} />
    </Routes>
  )
}

function ProjectDetailRoute() {
  const { projectId } = useParams()
  return <DashboardPage section="project-detail" projectId={projectId} />
}
