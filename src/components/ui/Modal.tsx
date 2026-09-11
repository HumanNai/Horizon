import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export function Modal({ isOpen, onClose, title, children, footer, maxWidth = 'lg' }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto app-region-no-drag" role="dialog" aria-modal="true">
      {/* Deep Navy Glassmorphism Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      
      {/* Modal Dialog Card */}
      <div 
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-gradient-to-b from-[#0D1429] to-[#070B19] border border-[#1E2D52] shadow-[0_25px_60px_rgba(0,0,0,0.85)] rounded-2xl w-full ${widthClasses[maxWidth]} overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200 app-region-no-drag`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#15203D] bg-[#0A1024]/90 flex justify-between items-center select-none">
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            {title}
          </h2>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D] transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content Area with Custom Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[75vh] custom-scrollbar text-gray-200">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#15203D] bg-[#0A1024]/95 flex justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
