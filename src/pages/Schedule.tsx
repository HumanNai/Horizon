import React, { useEffect, useState } from 'react'
import { Card, Button, Modal, Input, Select, Badge } from '../components/ui'
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Bell, Trash2 } from 'lucide-react'
import { dbQuery, dbExecute } from '../store/dbClient'
import { useProductStore } from '../store/productStore'
import { useAuthStore } from '../store/authStore'

interface ScheduleEventItem {
  id: string
  title: string
  type: string
  start_date: string
  end_date?: string
  linked_id?: string
  linked_type?: string
  notify_at?: string
  notified: number
  created_by: string
}

export function Schedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<ScheduleEventItem[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { products, fetchProducts } = useProductStore()
  const currentUser = useAuthStore(state => state.user)

  // Form State
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Release')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [linkedId, setLinkedId] = useState('')
  const [notifyAt, setNotifyAt] = useState('')

  useEffect(() => {
    fetchProducts()
    loadEvents()
  }, [fetchProducts])

  const loadEvents = async () => {
    try {
      const user = useAuthStore.getState().user || currentUser
      const isPO = user?.role === 'ProductOwner'
      const prodSubquery = isPO
        ? 'SELECT id FROM products'
        : 'SELECT id FROM products WHERE owner_id = ? OR owner_id = ? OR owner_id = ?'
      const prodParams = isPO ? [] : [user?.id, user?.username, user?.displayName]

      const rows = isPO
        ? await dbQuery<ScheduleEventItem>('SELECT * FROM schedule_events ORDER BY start_date ASC')
        : await dbQuery<ScheduleEventItem>(
            `SELECT * FROM schedule_events 
             WHERE (linked_id IN (${prodSubquery}) 
                OR linked_id IN (SELECT id FROM releases WHERE product_id IN (${prodSubquery}))
                OR created_by = ? OR created_by = ? OR created_by = ?)
             ORDER BY start_date ASC`,
            [...prodParams, ...prodParams, ...prodParams]
          )
      setEvents(rows)
    } catch (err) {
      console.error(err)
    }
  }

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))

  const handleCreateEvent = async () => {
    if (!title.trim() || !startDate) return
    const user = useAuthStore.getState().user || currentUser
    const id = `sched-${Date.now()}`
    await dbExecute(
      `INSERT INTO schedule_events (id, title, type, start_date, end_date, linked_id, linked_type, notify_at, notified, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id, 
        title.trim(), 
        type, 
        new Date(startDate).toISOString(), 
        new Date(startDate).toISOString(), 
        linkedId || null, 
        'Product', 
        notifyAt ? new Date(notifyAt).toISOString() : null,
        user?.displayName || user?.username || 'Team Member'
      ]
    )
    await loadEvents()
    setIsModalOpen(false)
    setTitle('')
    setNotifyAt('')
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this scheduled deadline?')) {
      await dbExecute('DELETE FROM schedule_events WHERE id = ?', [id])
      setEvents(events.filter(e => e.id !== id))
    }
  }

  const getEventBadge = (t: string) => {
    switch (t) {
      case 'Release': return 'bg-blue-500/20 text-[#6087FF] border-[#2E5EFF]/30'
      case 'UAT': return 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/30'
      case 'Deadline': return 'bg-red-500/20 text-red-400 border-red-500/30'
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-7.5rem)] max-w-7xl mx-auto">
      {/* Main Calendar View */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <CalendarIcon size={20} className="text-[#2E5EFF]" /> {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <div className="flex items-center bg-[#0A1024] rounded-xl border border-[#15203D]">
              <button onClick={prevMonth} className="p-1.5 hover:bg-[#15203D] rounded-l-xl text-gray-400 hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} className="p-1.5 hover:bg-[#15203D] rounded-r-xl text-gray-400 hover:text-white transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <Button size="sm" onClick={() => setIsModalOpen(true)} className="gap-1.5 shadow-lg shadow-[#2E5EFF]/20">
            <Plus size={15} /> Add Event
          </Button>
        </div>

        <div className="flex-1 rounded-2xl bg-[#0A1024]/90 border border-[#15203D] flex flex-col overflow-hidden shadow-xl">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-[#15203D] bg-[#0D1429] text-center text-xs font-semibold text-gray-400 uppercase tracking-wider py-3">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>

          {/* Calendar Grid Days */}
          <div className="flex-1 grid grid-cols-7 grid-rows-5 bg-[#070B19]">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="border-r border-b border-[#131C38] bg-[#090E21]/50 p-2" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dayEvents = events.filter(e => {
                if (!e.start_date) return false
                try {
                  const d = new Date(e.start_date)
                  if (isNaN(d.getTime())) return false
                  return d.getDate() === dayNum && d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()
                } catch {
                  return false
                }
              })
              const isToday = dayNum === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth()

              return (
                <div 
                  key={`day-${dayNum}`} 
                  className={`border-r border-b border-[#131C38] p-2 hover:bg-[#0D1429] transition-colors relative flex flex-col justify-between overflow-hidden ${
                    isToday ? 'bg-[#2E5EFF]/5' : ''
                  }`}
                >
                  <span className={`text-xs font-bold ${isToday ? 'text-[#2E5EFF] font-black' : 'text-gray-400'}`}>
                    {dayNum}
                  </span>

                  <div className="space-y-1 overflow-y-auto max-h-16 custom-scrollbar">
                    {dayEvents.map(ev => (
                      <div 
                        key={ev.id}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border truncate ${getEventBadge(ev.type)}`}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right Upcoming Deadlines Feed */}
      <div className="w-full lg:w-80 rounded-2xl bg-[#0A1024]/90 border border-[#15203D] p-5 flex flex-col shadow-xl shrink-0">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2 mb-4">
          <Clock size={16} className="text-[#F5A623]" /> Upcoming Deadlines
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar text-xs">
          {events.map(ev => (
            <div key={ev.id} className="p-3 rounded-xl bg-[#0D1429] border border-[#172242] hover:border-[#2E5EFF]/30 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <Badge variant={ev.type === 'Release' ? 'blue' : ev.type === 'UAT' ? 'orange' : 'danger'}>
                  {ev.type}
                </Badge>
                <button onClick={(e) => handleDelete(ev.id, e)} className="text-gray-500 hover:text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
              <h4 className="font-bold text-white truncate">{ev.title}</h4>
              <div className="text-[11px] text-gray-400 font-mono mt-1">
                {ev.start_date ? (() => {
                  try {
                    const d = new Date(ev.start_date)
                    return isNaN(d.getTime()) ? 'No date' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                  } catch {
                    return 'No date'
                  }
                })() : 'No date'}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-center py-10 text-xs text-gray-500">No scheduled events.</div>
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Event or Reminder"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent}>Save Event</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Event Summary / Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Phoenix Production Cutover" required autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Event Type" 
              value={type} 
              onChange={e => setType(e.target.value)}
              options={[
                { label: 'Release Cutover', value: 'Release' },
                { label: 'UAT Sign-off Gate', value: 'UAT' },
                { label: 'Milestone Deadline', value: 'Deadline' },
                { label: 'General Reminder', value: 'Reminder' }
              ]} 
            />
            <Input label="Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </div>
          <Select 
            label="Associated System" 
            value={linkedId} 
            onChange={e => setLinkedId(e.target.value)}
            options={[{ label: 'General Event', value: '' }, ...products.map(p => ({ label: p.name, value: p.id }))]}
          />
        </div>
      </Modal>
    </div>
  )
}
