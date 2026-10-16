import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './password-input.css'

export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const [isVisible, setIsVisible] = useState(false)

  return <span className="password-input"><input {...props} type={isVisible ? 'text' : 'password'} /><button type="button" className="password-input-toggle" onClick={() => setIsVisible((visible) => !visible)} aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'} disabled={props.disabled}>{isVisible ? <EyeOff aria-hidden="true" size={18} /> : <Eye aria-hidden="true" size={18} />}</button></span>
}
