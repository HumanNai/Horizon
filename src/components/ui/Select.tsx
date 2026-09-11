import React from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { label: string; value: string | number }[]
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ label, error, options, className = '', ...props }, ref) => {
  return (
    <div className="flex flex-col w-full">
      {label && <label className="mb-1 text-xs font-semibold text-gray-300">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={`w-full bg-[#070B19] border ${
            error 
              ? 'border-red-500 focus:border-red-500' 
              : 'border-[#19264A] hover:border-[#2E5EFF]/50 focus:border-[#2E5EFF]'
          } rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white appearance-none focus:outline-none transition-colors pr-9 ${className}`}
          {...props}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-[#0D1429] text-white py-1">
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <ChevronDown size={14} />
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
})
Select.displayName = 'Select'
