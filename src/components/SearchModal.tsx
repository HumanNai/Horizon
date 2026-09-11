import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, 
  Package, 
  GitMerge, 
  CheckSquare, 
  FileText, 
  Network, 
  Terminal,
  ArrowRight, 
  X, 
  CornerDownLeft,
  Sparkles
} from 'lucide-react'
import { dbQuery } from '../store/dbClient'
import { useAuthStore } from '../store/authStore'

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  category: 'Product' | 'Release' | 'Task' | 'Document' | 'Interface' | 'API'
  path: string
  badge?: string
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
      loadInitialSuggestions()
    }
  }, [isOpen])

  const loadInitialSuggestions = async () => {
    try {
      const user = useAuthStore.getState().user
      const isPO = user?.role === 'ProductOwner'
      const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

      // Show products as initial suggestions
      const products = isPO
        ? await dbQuery<any>('SELECT id, name, type, status FROM products LIMIT 5')
        : await dbQuery<any>('SELECT id, name, type, status FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ? LIMIT 5', prodParams)

      const items: SearchItem[] = products.map(p => ({
        id: p.id,
        title: p.name,
        subtitle: `${p.type} Application · ${p.status}`,
        category: 'Product',
        path: `/products/${p.id}`,
        badge: p.type
      }))
      setResults(items)
    } catch {
      setResults([])
    }
  }

  useEffect(() => {
    if (!query.trim()) {
      loadInitialSuggestions()
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const user = useAuthStore.getState().user
        const isPO = user?.role === 'ProductOwner'
        const prodSubquery = isPO
          ? 'SELECT id FROM products'
          : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
        const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

        const q = `%${query.trim()}%`
        const [prods, rels, tasks, docs, ifaces, apiList] = await Promise.all([
          isPO
            ? dbQuery<any>('SELECT id, name, type, status, description FROM products WHERE name LIKE ? OR type LIKE ? OR description LIKE ? LIMIT 4', [q, q, q])
            : dbQuery<any>(`SELECT id, name, type, status, description FROM products WHERE (name LIKE ? OR type LIKE ? OR description LIKE ?) AND (${prodSubquery.replace('SELECT id FROM products WHERE ', '')}) LIMIT 4`, [q, q, q, ...prodParams]),
          dbQuery<any>(`SELECT id, name, version, status, product_id FROM releases WHERE (name LIKE ? OR version LIKE ?) AND product_id IN (${prodSubquery}) LIMIT 4`, [q, q, ...prodParams]),
          isPO
            ? dbQuery<any>(`SELECT id, title, status, priority, product_id FROM tasks WHERE (title LIKE ? OR description LIKE ?) AND product_id IN (${prodSubquery}) LIMIT 5`, [q, q])
            : dbQuery<any>(`SELECT id, title, status, priority, product_id FROM tasks WHERE (title LIKE ? OR description LIKE ?) AND (product_id IN (${prodSubquery}) OR assignee_id = ? OR assignee_id = ?) LIMIT 5`, [q, q, ...prodParams, user?.username, user?.displayName]),
          dbQuery<any>(`SELECT id, title, category, version FROM documents_meta WHERE (title LIKE ? OR category LIKE ?) AND (product_id IN (${prodSubquery}) OR product_id IS NULL OR product_id = '') LIMIT 4`, [q, q, ...prodParams]),
          dbQuery<any>(`SELECT id, name, type, endpoint, product_id, service_provider FROM interfaces WHERE (name LIKE ? OR endpoint LIKE ? OR service_provider LIKE ?) AND product_id IN (${prodSubquery}) LIMIT 4`, [q, q, q, ...prodParams]),
          dbQuery<any>(`SELECT id, name, method, endpoint, product_id, given_to FROM apis WHERE (name LIKE ? OR endpoint LIKE ? OR given_to LIKE ?) AND product_id IN (${prodSubquery}) LIMIT 4`, [q, q, q, ...prodParams])
        ])

        const matched: SearchItem[] = [
          ...prods.map(p => ({
            id: p.id,
            title: p.name,
            subtitle: `${p.type} Workspace`,
            category: 'Product' as const,
            path: `/products/${p.id}`,
            badge: p.status
          })),
          ...rels.map(r => ({
            id: r.id,
            title: `${r.name} (${r.version})`,
            subtitle: `Target Release · ${r.status}`,
            category: 'Release' as const,
            path: r.product_id ? `/products/${r.product_id}` : '/releases',
            badge: r.version
          })),
          ...tasks.map(t => ({
            id: t.id,
            title: t.title,
            subtitle: `${t.status} · Priority: ${t.priority}`,
            category: 'Task' as const,
            path: t.product_id ? `/products/${t.product_id}` : '/tasks',
            badge: t.status
          })),
          ...docs.map(d => ({
            id: d.id,
            title: d.title,
            subtitle: `${d.category} · v${d.version || '1.0'}`,
            category: 'Document' as const,
            path: '/documents',
            badge: d.category
          })),
          ...ifaces.map(i => ({
            id: i.id,
            title: i.name,
            subtitle: `${i.type} (${i.service_provider || 'Broker'}) · ${i.endpoint}`,
            category: 'Interface' as const,
            path: i.product_id ? `/products/${i.product_id}` : '/interfaces',
            badge: i.type
          })),
          ...apiList.map(a => ({
            id: a.id,
            title: `${a.method} ${a.endpoint}`,
            subtitle: `${a.name} · Given to: ${a.given_to}`,
            category: 'API' as const,
            path: a.product_id ? `/products/${a.product_id}` : '/apis',
            badge: a.method
          }))
        ]

        setResults(matched)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Search query error:', err)
      } finally {
        setLoading(false)
      }
    }, 120)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (item: SearchItem) => {
    navigate(item.path)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Product': return <Package size={15} className="text-[#2E5EFF]" />
      case 'Release': return <GitMerge size={15} className="text-[#F5A623]" />
      case 'Task': return <CheckSquare size={15} className="text-emerald-400" />
      case 'Document': return <FileText size={15} className="text-purple-400" />
      case 'Interface': return <Network size={15} className="text-purple-400" />
      case 'API': return <Terminal size={15} className="text-cyan-400" />
      default: return <Search size={15} className="text-gray-400" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div 
        className="w-full max-w-2xl bg-[#0B1229] border border-[#1E2D52] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#15203D] gap-3 bg-[#0A1024]">
          <Search size={18} className="text-[#2E5EFF] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, releases, tasks, documents, endpoints..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D]"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-gray-400 bg-[#15203D] rounded border border-[#1E2D52]">
            ESC
          </kbd>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-2 custom-scrollbar">
          {results.length > 0 ? (
            <div className="space-y-1">
              {!query && (
                <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[#F5A623]" /> Suggested Applications & Core Entities
                </div>
              )}
              {results.map((item, index) => {
                const isSelected = index === selectedIndex
                return (
                  <div
                    key={`${item.category}-${item.id}-${index}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      isSelected 
                        ? 'bg-[#15203D] border border-[#2E5EFF]/40 text-white' 
                        : 'text-gray-300 hover:bg-[#0E1736]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#070B19] border border-[#15203D] shrink-0">
                        {getCategoryIcon(item.category)}
                      </div>
                      <div className="min-w-0 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">{item.title}</span>
                          {item.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0D1429] border border-[#1E2D52] text-gray-400">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-gray-400 truncate">{item.subtitle}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-gray-500">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#070B19] border border-[#15203D] text-gray-400">
                        {item.category}
                      </span>
                      {isSelected && <CornerDownLeft size={13} className="text-[#2E5EFF]" />}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-gray-500">
              {loading ? 'Searching repository...' : `No matching items found for "${query}"`}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 bg-[#080D1F] border-t border-[#15203D] flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[#15203D] rounded border border-[#1E2D52] font-mono text-gray-400">↑</kbd>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[#15203D] rounded border border-[#1E2D52] font-mono text-gray-400">↓</kbd> to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[#15203D] rounded border border-[#1E2D52] font-mono text-gray-400">↵</kbd> to open
            </span>
          </div>
          <span className="text-gray-400 font-mono">Horizon Quick Find</span>
        </div>
      </div>
    </div>
  )
}

