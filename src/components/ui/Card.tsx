import React from 'react'

interface CardProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}

export function Card({ title, subtitle, action, children, className = '' }: CardProps) {
  return (
    <div className={`bg-[#111d3c] border border-[#1e2d52] rounded-xl overflow-hidden hover:bg-[#162040] transition-colors ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-[#1e2d52] flex justify-between items-center">
          <div>
            {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}
