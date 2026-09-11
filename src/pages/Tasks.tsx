import React, { useEffect, useState } from 'react'
import { useTaskStore } from '../store/taskStore'
import { useProductStore } from '../store/productStore'
import { KanbanBoard } from '../components/KanbanBoard'
import { Card, Table, Badge, Button, Modal, Input, Select } from '../components/ui'
import { Task, TaskStatus, TaskPriority } from '../types'
import { Plus, LayoutGrid, List, CheckSquare, Search, Trash2, Edit3 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export function Tasks() {
  const { tasks, fetchTasks, createTask, updateTask, updateTaskStatus, deleteTask } = useTaskStore()
  const { products, fetchProducts } = useProductStore()
  const user = useAuthStore(state => state.user)

  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterProduct, setFilterProduct] = useState('')

  // Form inputs
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('Todo')
  const [priority, setPriority] = useState<TaskPriority>('Medium')
  const [assigneeId, setAssigneeId] = useState('PO')
  const [productId, setProductId] = useState('')
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0])

  useEffect(() => {
    fetchTasks()
    fetchProducts()
  }, [fetchTasks, fetchProducts])

  const handleOpenModal = (task?: Task) => {
    if (task) {
      setSelectedTask(task)
      setTitle(task.title)
      setDescription(task.description || '')
      setStatus(task.status)
      setPriority(task.priority)
      setAssigneeId(task.assigneeId)
      setProductId(task.productId || '')
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '')
    } else {
      setSelectedTask(null)
      setTitle('')
      setDescription('')
      setStatus('Todo')
      setPriority('Medium')
      setAssigneeId(user?.displayName || user?.username || 'PO')
      setProductId(products[0]?.id || '')
      setDueDate(new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0])
    }
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      description,
      status,
      priority,
      assigneeId: assigneeId || user?.displayName || user?.username || 'PO',
      productId: productId || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
    }

    if (selectedTask) {
      await updateTask(selectedTask.id, payload)
    } else {
      await createTask(payload)
    }
    setIsModalOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Delete this task?')) {
      await deleteTask(id)
      setIsModalOpen(false)
    }
  }

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesPriority = !filterPriority || t.priority === filterPriority
    const matchesProduct = !filterProduct || t.productId === filterProduct
    return matchesSearch && matchesPriority && matchesProduct
  })

  const listColumns = [
    { key: 'title', header: 'Task Summary', render: (t: Task) => <span className="font-semibold text-white">{t.title}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (t: Task) => (
        <Badge variant={t.status === 'Done' ? 'success' : t.status === 'Blocked' ? 'danger' : t.status === 'InProgress' ? 'blue' : 'neutral'}>
          {t.status}
        </Badge>
      ) 
    },
    { 
      key: 'priority', 
      header: 'Priority',
      render: (t: Task) => (
        <Badge variant={t.priority === 'Critical' ? 'danger' : t.priority === 'High' ? 'warning' : 'neutral'}>
          {t.priority}
        </Badge>
      )
    },
    { 
      key: 'productId', 
      header: 'Product', 
      render: (t: Task) => {
        const prod = products.find(p => p.id === t.productId)
        return <span className="text-gray-300">{prod ? prod.name : 'General'}</span>
      }
    },
    { key: 'assigneeId', header: 'Assignee', render: (t: Task) => <span className="font-mono text-xs">{t.assigneeId}</span> },
    { 
      key: 'dueDate', 
      header: 'Due Date', 
      render: (t: Task) => (
        <span className="text-gray-400">
          {t.dueDate ? (() => {
            try {
              const d = new Date(t.dueDate)
              return isNaN(d.getTime()) ? '-' : d.toLocaleDateString()
            } catch {
              return '-'
            }
          })() : '-'}
        </span>
      ) 
    },
    {
      key: 'actions',
      header: '',
      render: (t: Task) => (
        <button 
          onClick={(e) => { e.stopPropagation(); handleOpenModal(t) }}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#15203D]"
        >
          <Edit3 size={14} />
        </button>
      )
    }
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] max-w-7xl mx-auto space-y-4">
      {/* Top Controls & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <CheckSquare size={20} className="text-[#2E5EFF]" /> Task Execution Hub
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Drag-and-drop sprint management across all releases.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-[#0A1024] p-1 rounded-xl border border-[#15203D]">
            <button 
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === 'kanban' 
                  ? 'bg-[#2E5EFF] text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button 
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                view === 'list' 
                  ? 'bg-[#2E5EFF] text-white shadow-sm' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List size={14} /> List
            </button>
          </div>

          <Button size="sm" onClick={() => handleOpenModal()} className="shadow-lg shadow-[#2E5EFF]/20 gap-1.5">
            <Plus size={15} /> Add Task
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-2xl bg-[#0A1024]/80 border border-[#15203D] shrink-0">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..." 
            className="w-full bg-[#0D1429] border border-[#19264A] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF]"
          />
        </div>

        <Select 
          value={filterProduct} 
          onChange={e => setFilterProduct(e.target.value)}
          options={[{ label: 'All Products', value: '' }, ...products.map(p => ({ label: p.name, value: p.id }))]}
          className="w-44 bg-[#0D1429]"
        />

        <Select 
          value={filterPriority} 
          onChange={e => setFilterPriority(e.target.value)}
          options={[
            { label: 'All Priorities', value: '' },
            { label: 'Critical', value: 'Critical' },
            { label: 'High', value: 'High' },
            { label: 'Medium', value: 'Medium' },
            { label: 'Low', value: 'Low' }
          ]}
          className="w-36 bg-[#0D1429]"
        />
      </div>

      {/* Main View Area */}
      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? (
          <KanbanBoard 
            tasks={filteredTasks} 
            onTaskStatusChange={updateTaskStatus} 
            onTaskClick={handleOpenModal} 
          />
        ) : (
          <div className="h-full rounded-2xl bg-[#0A1024]/90 border border-[#15203D] overflow-hidden">
            <Table columns={listColumns} data={filteredTasks} onRowClick={handleOpenModal} />
          </div>
        )}
      </div>

      {/* Add / Edit Task Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedTask ? 'Edit Task Details' : 'Create New Task'}
        footer={
          <div className="flex justify-between w-full">
            {selectedTask ? (
              <Button variant="danger" size="sm" onClick={() => handleDelete(selectedTask.id)}>
                <Trash2 size={14} className="mr-1.5" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{selectedTask ? 'Save Changes' : 'Create Task'}</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <Input 
            label="Task Summary / Title" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
            placeholder="e.g. Implement UAT test runner automation"
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Status" 
              value={status} 
              onChange={e => setStatus(e.target.value as TaskStatus)} 
              options={[
                { label: 'To Do', value: 'Todo' }, 
                { label: 'In Progress', value: 'InProgress' }, 
                { label: 'Blocked', value: 'Blocked' }, 
                { label: 'Done', value: 'Done' }
              ]} 
            />

            <Select 
              label="Priority" 
              value={priority} 
              onChange={e => setPriority(e.target.value as TaskPriority)} 
              options={[
                { label: 'Low', value: 'Low' }, 
                { label: 'Medium', value: 'Medium' }, 
                { label: 'High', value: 'High' }, 
                { label: 'Critical', value: 'Critical' }
              ]} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select 
              label="Associated Product" 
              value={productId} 
              onChange={e => setProductId(e.target.value)}
              options={[{ label: 'General Task', value: '' }, ...products.map(p => ({ label: p.name, value: p.id }))]}
            />
            <Input label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <Input label="Assignee (Initials or Name)" value={assigneeId} onChange={e => setAssigneeId(e.target.value)} />

          <div className="flex flex-col w-full">
            <label className="mb-1 text-xs font-semibold text-gray-300">Detailed Description & Acceptance Criteria</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Outline steps to reproduce, expected results, or links..."
              className="w-full bg-[#070B19] border border-[#19264A] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2E5EFF] min-h-[90px]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
