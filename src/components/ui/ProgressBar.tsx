import React from 'react'

interface ProgressBarProps {
  value: number
  variant?: 'blue' | 'green' | 'orange' | 'red'
  label?: string
  showValue?: boolean
  className?: string
}

export function ProgressBar({ value, variant = 'blue', label, showValue = true, className = '' }: ProgressBarProps) {
  const variants = {
    blue: 'bg-[#2E5EFF]',
    green: 'bg-green-500',
    orange: 'bg-[#F5A623]',
    red: 'bg-red-500'
  }

  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1 text-sm font-medium">
          {label && <span className="text-gray-300">{label}</span>}
          {showValue && <span className="text-gray-400">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div className="w-full bg-[#1e2d52] rounded-full h-2 overflow-hidden flex">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-out ${variants[variant]}`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}
