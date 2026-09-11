import React, { useRef } from 'react'
import { Upload, Image as ImageIcon, X } from 'lucide-react'
import { Button } from './ui'

export function isImageIcon(icon?: string): boolean {
  if (!icon) return false
  return (
    icon.startsWith('data:image') ||
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('blob:')
  )
}

interface IconPickerProps {
  value: string
  onChange: (val: string) => void
  label?: string
}

const PRESET_EMOJIS = ['⚡', '🚀', '🛡️', '🌐', '📦', '📊', '⚙️', '🔒', '📡', '🧠', '💳', '🔗', '🧩', '📈']

export function IconPicker({ value, onChange, label = 'Application Icon / Logo (Optional)' }: IconPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const rawDataUrl = reader.result as string
      if (file.type === 'image/svg+xml') {
        onChange(rawDataUrl)
        return
      }

      const img = new Image()
      img.onload = () => {
        try {
          const MAX_SIZE = 256
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width)
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height)
              height = MAX_SIZE
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const resized = canvas.toDataURL('image/png')
            onChange(resized)
          } else {
            onChange(rawDataUrl)
          }
        } catch (err) {
          console.warn('Canvas resize fallback:', err)
          onChange(rawDataUrl)
        }
      }
      img.onerror = (err) => {
        console.warn('Image load fallback:', err)
        onChange(rawDataUrl)
      }
      img.src = rawDataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const isImg = isImageIcon(value)

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-gray-300 block">{label}</label>

      {/* Main Preview & Upload Controls */}
      <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-[#070B19] border border-[#19264A]">
        {/* Preview Thumbnail */}
        <div className="w-14 h-14 rounded-xl bg-[#0D1429] border border-[#23335F] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
          {isImg ? (
            <img src={value} alt="Application Logo" className="w-full h-full object-contain p-1" />
          ) : value ? (
            <span className="text-2xl select-none">{value}</span>
          ) : (
            <ImageIcon size={22} className="text-gray-500" />
          )}
        </div>

        {/* Upload & Action Buttons */}
        <div className="flex-1 min-w-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            className="hidden"
            onChange={handleFileUpload}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5 text-xs py-1.5 h-auto border-[#2E5EFF]/40 hover:border-[#2E5EFF] text-gray-200"
            >
              <Upload size={13} className="text-[#2E5EFF]" />
              {isImg ? 'Change Image' : 'Upload Custom Image'}
            </Button>

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="px-2.5 py-1.5 rounded-xl border border-red-500/30 text-[11px] text-red-400 hover:bg-red-500/10 flex items-center gap-1 transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1 truncate">
            {isImg ? 'Custom image logo active' : 'Upload PNG, JPG, SVG, or WebP (auto-optimized)'}
          </p>
        </div>
      </div>

      {/* Preset Emojis */}
      <div>
        <span className="text-[11px] font-medium text-gray-400 block mb-1.5">Or choose a preset emblem:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              className={`w-8 h-8 rounded-lg border text-base flex items-center justify-center transition-all ${
                value === emoji
                  ? 'bg-[#2E5EFF]/30 border-[#2E5EFF] scale-110 shadow-sm shadow-[#2E5EFF]/40'
                  : 'bg-[#0A1024] border-[#19264A] hover:border-gray-500 text-gray-300'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Text / Emoji input */}
      {!isImg && (
        <input
          type="text"
          placeholder="Or type custom emoji / text (e.g. 🎯, 🤖, Core)"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
        />
      )}
    </div>
  )
}

