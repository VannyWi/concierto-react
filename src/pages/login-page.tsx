import { useState, useTransition } from 'react'
import { KeyRound, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import { PasswordInput } from '../shared/components/password-input.tsx'
import { ApplicationBrand } from '../shared/components/application-brand.tsx'
import './login-page.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

type AuthenticatedUser = {
  id: string
  username: string
  roleName: string
}

async function getResponseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiResponse<unknown> | null
  return body?.message ?? 'No fue posible completar la solicitud.'
}

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const navigate = useNavigate()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password) {
      setError('Ingresa tu usuario y contrasena para continuar.')
      return
    }

    startTransition(async () => {
      setError('')

      try {
        const response = await fetch(`${API_URL}/api/v1/auth/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: normalizedUsername, password }),
        })

        if (!response.ok) {
          throw new Error(await getResponseMessage(response))
        }

        const result = (await response.json()) as ApiResponse<AuthenticatedUser>
        if (!result.success || !result.data) {
          throw new Error(result.message)
        }

        setPassword('')
        void Swal.fire({ icon: 'success', title: 'Sesion iniciada correctamente.', timer: 2200, showConfirmButton: false })
        navigate('/dashboard')
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'No fue posible conectar con el servidor.',
        )
      }
    })
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <ApplicationBrand apiUrl={API_URL} className="login-brand" />
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <p className="login-eyebrow">Acceso privado</p>
            <h1 id="login-title">Inicia sesion</h1>
            <p className="login-form-description">Usa las credenciales asignadas por tu administrador.</p>
          </div>

            <div className="login-fields">
              <label htmlFor="username">
                <span className="login-label">
                  <UserRound aria-hidden="true" size={16} />
                  Usuario
                </span>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={isPending}
                  required
                />
              </label>

              <label htmlFor="password">
                <span className="login-label">
                  <KeyRound aria-hidden="true" size={16} />
                  Contraseña
                </span>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isPending}
                  required
                />
              </label>
            </div>

            {error ? (
              <p className="login-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="login-primary-button" type="submit" disabled={isPending}>
              <ShieldCheck aria-hidden="true" size={18} />
              {isPending ? 'Validando acceso...' : 'Entrar al sistema'}
            </button>
        </form>
      </section>
    </main>
  )
}
