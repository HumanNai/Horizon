import React from 'react'

interface BadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'blue' | 'orange'
  children: React.ReactNode
  className?: string
}

export function Badge({ variant, children, className = '' }: BadgeProps) {
  const variants = {
    success: 'bg-green-900/30 text-green-400 border-green-800',
    warning: 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
    danger: 'bg-red-900/30 text-red-400 border-red-800',
    info: 'bg-cyan-900/30 text-cyan-400 border-cyan-800',
    neutral: 'bg-gray-800 text-gray-300 border-gray-700',
    blue: 'bg-[#2E5EFF]/20 text-[#2E5EFF] border-[#2E5EFF]/50',
    orange: 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/50'
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
