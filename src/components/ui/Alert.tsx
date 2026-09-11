import React, { useState } from 'react'
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react'

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: React.ReactNode
  dismissible?: boolean
  onDismiss?: () => void
  className?: string
}

export function Alert({ variant = 'info', title, children, dismissible, onDismiss, className = '' }: AlertProps) {
  const [isVisible, setIsVisible] = useState(true)

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible) return null

  const variants = {
    info: 'bg-cyan-900/20 border-cyan-800 text-cyan-200',
    success: 'bg-green-900/20 border-green-800 text-green-200',
    warning: 'bg-yellow-900/20 border-yellow-800 text-yellow-200',
    error: 'bg-red-900/20 border-red-800 text-red-200'
  }

  const icons = {
    info: <Info className="w-5 h-5 text-cyan-400" />,
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />
  }

  return (
    <div className={`p-4 rounded-md border flex items-start gap-3 ${variants[variant]} ${className}`}>
      <div className="shrink-0 mt-0.5">{icons[variant]}</div>
      <div className="flex-1">
        {title && <h4 className="font-medium mb-1">{title}</h4>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {(dismissible || onDismiss) && (
        <button onClick={handleDismiss} className="shrink-0 opacity-70 hover:opacity-100">
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
