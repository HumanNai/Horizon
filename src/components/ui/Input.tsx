import React, { useState, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ label, error, icon, className = '', type = 'text', style, onClick, value, ...props }, ref) => {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const isDate = type === 'date' || type === 'datetime-local'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  const localRef = useRef<HTMLInputElement | null>(null)

  const handleRef = (node: HTMLInputElement | null) => {
    localRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref && 'current' in ref) {
      (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    if (isDate) {
      try {
        localRef.current?.showPicker?.()
      } catch {}
    }
    if (onClick) onClick(e)
  }

  // Normalize controlled value: if value prop is supplied, ensure null/undefined is coerced to empty string
  const normalizedValue = value !== undefined ? (value === null ? '' : value) : undefined

  return (
    <div className="flex flex-col w-full app-region-no-drag">
      {label && <label className="mb-1 text-xs font-semibold text-gray-300 select-none">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">{icon}</div>}
        <input
          ref={handleRef}
          type={inputType}
          style={isDate ? { colorScheme: 'dark', ...style } : style}
          onClick={handleClick}
          value={normalizedValue}
          className={`w-full bg-[#070B19] border ${
            error 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-[#19264A] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF]'
          } rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none transition-colors app-region-no-drag select-text ${icon ? 'pl-9' : ''} ${isPassword ? 'pr-10' : ''} ${isDate ? 'cursor-pointer' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button 
            type="button" 
            tabIndex={-1}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
})
Input.displayName = 'Input'

