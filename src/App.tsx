import React, { useEffect, Suspense, lazy } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { Login } from './pages/Login'
import { Spinner } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'

const AppShell = lazy(() => import('./layouts/AppShell').then(m => ({ default: m.AppShell })))

// Route-based code splitting for fast instant startup and smooth transitions
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })))
const Products = lazy(() => import('./pages/Products').then(m => ({ default: m.Products })))
const Releases = lazy(() => import('./pages/Releases').then(m => ({ default: m.Releases })))
const Tasks = lazy(() => import('./pages/Tasks').then(m => ({ default: m.Tasks })))
const UAT = lazy(() => import('./pages/UAT').then(m => ({ default: m.UAT })))
const Interfaces = lazy(() => import('./pages/Interfaces').then(m => ({ default: m.Interfaces })))
const Apis = lazy(() => import('./pages/Apis').then(m => ({ default: m.Apis })))
const Secrets = lazy(() => import('./pages/Secrets').then(m => ({ default: m.Secrets })))
const HR = lazy(() => import('./pages/HR').then(m => ({ default: m.HR })))
const Schedule = lazy(() => import('./pages/Schedule').then(m => ({ default: m.Schedule })))
const Documents = lazy(() => import('./pages/Documents').then(m => ({ default: m.Documents })))
const Audit = lazy(() => import('./pages/Audit').then(m => ({ default: m.Audit })))
const Plugins = lazy(() => import('./pages/Plugins').then(m => ({ default: m.Plugins })))
const Access = lazy(() => import('./pages/Access').then(m => ({ default: m.Access })))
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })))
const ProductWorkspace = lazy(() => import('./pages/ProductWorkspace').then(m => ({ default: m.ProductWorkspace })))

function PageLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] h-full gap-3">
      <Spinner size="md" />
      <span className="text-xs text-gray-500 tracking-wider font-medium uppercase">Loading view...</span>
    </div>
  )
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  const { restoreSession } = useAuthStore()
  // If no session token in storage, don't show loading spinner — render Login immediately
  const [loading, setLoading] = React.useState(() => Boolean(sessionStorage.getItem('horizon_session_token')))

  useEffect(() => {
    if (sessionStorage.getItem('horizon_session_token')) {
      restoreSession().finally(() => setLoading(false))
    }
  }, [restoreSession])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B19] flex flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <span className="text-xs text-[#2E5EFF] tracking-widest uppercase font-semibold">Initializing Horizon...</span>
      </div>
    )
  }

  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<PrivateRoute><Suspense fallback={<PageLoading />}><AppShell /></Suspense></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<PageLoading />}><Dashboard /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<PageLoading />}><Products /></Suspense>} />
            <Route path="products/:productId" element={<Suspense fallback={<PageLoading />}><ProductWorkspace /></Suspense>} />
            <Route path="releases" element={<Suspense fallback={<PageLoading />}><Releases /></Suspense>} />
            <Route path="tasks" element={<Suspense fallback={<PageLoading />}><Tasks /></Suspense>} />
            <Route path="uat" element={<Suspense fallback={<PageLoading />}><UAT /></Suspense>} />
            <Route path="interfaces" element={<Suspense fallback={<PageLoading />}><Interfaces /></Suspense>} />
            <Route path="apis" element={<Suspense fallback={<PageLoading />}><Apis /></Suspense>} />
            <Route path="secrets" element={<Suspense fallback={<PageLoading />}><Secrets /></Suspense>} />
            <Route path="hr" element={<Suspense fallback={<PageLoading />}><HR /></Suspense>} />
            <Route path="schedule" element={<Suspense fallback={<PageLoading />}><Schedule /></Suspense>} />
            <Route path="documents" element={<Suspense fallback={<PageLoading />}><Documents /></Suspense>} />
            <Route path="audit" element={<Suspense fallback={<PageLoading />}><Audit /></Suspense>} />
            <Route path="plugins" element={<Suspense fallback={<PageLoading />}><Plugins /></Suspense>} />
            <Route path="access" element={<Suspense fallback={<PageLoading />}><Access /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoading />}><Settings /></Suspense>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  )
}
