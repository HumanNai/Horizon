import React from 'react'

interface PipelineBarProps {
  activeStep: number
  size?: 'sm' | 'lg'
}

export function PipelineBar({ activeStep, size = 'sm' }: PipelineBarProps) {
  const steps = ['Align', 'Plan', 'Execute', 'Measure', 'Impact']
  const dotSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6'
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-[#1e2d52] z-0 rounded-full" />
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-[#2E5EFF] to-[#F5A623] z-0 rounded-full transition-all duration-500"
          style={{ width: `${(Math.min(activeStep, steps.length - 1) / (steps.length - 1)) * 100}%` }}
        />
        
        {steps.map((step, i) => {
          const isActive = i === activeStep
          const isCompleted = i < activeStep
          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
              <div 
                className={`${dotSize} rounded-full transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#2E5EFF] shadow-[0_0_10px_#2E5EFF]' 
                    : isCompleted 
                      ? 'bg-[#F5A623]' 
                      : 'bg-[#1e2d52]'
                }`}
              />
              <span className={`text-[10px] sm:${textSize} whitespace-nowrap text-center ${isActive ? 'text-white font-medium' : isCompleted ? 'text-gray-300' : 'text-gray-500'} absolute top-full mt-2 left-1/2 -translate-x-1/2`}>
                {step}
              </span>
            </div>
          )
        })}
      </div>
      <div className={size === 'sm' ? 'mt-7' : 'mt-8 sm:mt-10'} />
    </div>
  )
}
