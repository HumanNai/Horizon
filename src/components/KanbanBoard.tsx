import React, { useState } from 'react'
import { Task, TaskStatus } from '../types'
import { Badge } from './ui'

interface KanbanBoardProps {
  tasks: Task[]
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void
  onTaskClick: (task: Task) => void
}

export function KanbanBoard({ tasks, onTaskStatusChange, onTaskClick }: KanbanBoardProps) {
  const columns: { title: string; status: TaskStatus; color: string }[] = [
    { title: 'To Do', status: 'Todo', color: 'bg-gray-800 border-gray-700' },
    { title: 'In Progress', status: 'InProgress', color: 'bg-[#2E5EFF]/20 border-[#2E5EFF]/30' },
    { title: 'Blocked', status: 'Blocked', color: 'bg-red-900/20 border-red-900/30' },
    { title: 'Done', status: 'Done', color: 'bg-green-900/20 border-green-900/30' }
  ]

  const [draggedTask, setDraggedTask] = useState<Task | null>(null)

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault()
    if (draggedTask && draggedTask.status !== status) {
      onTaskStatusChange(draggedTask.id, status)
    }
    setDraggedTask(null)
  }

  return (
    <div className="flex gap-3 sm:gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
      {columns.map(col => {
        const columnTasks = tasks.filter(t => t.status === col.status)
        return (
          <div 
            key={col.status} 
            className="flex-shrink-0 w-64 sm:w-72 lg:w-80 flex flex-col bg-[#0B1229] border border-[#1e2d52] rounded-xl overflow-hidden"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <div className={`px-4 py-3 border-b ${col.color} flex justify-between items-center`}>
              <h3 className="font-semibold text-white">{col.title}</h3>
              <span className="bg-[#111d3c] text-xs px-2 py-1 rounded-full text-gray-300">
                {columnTasks.length}
              </span>
            </div>
            <div className="p-3 flex-1 overflow-y-auto space-y-3">
              {columnTasks.map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => onTaskClick(task)}
                  className="bg-[#111d3c] border border-[#1e2d52] p-4 rounded-lg cursor-grab active:cursor-grabbing hover:border-gray-500 transition-colors shadow-sm"
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={task.priority === 'Critical' ? 'danger' : task.priority === 'High' ? 'warning' : task.priority === 'Medium' ? 'blue' : 'neutral'}>
                      {task.priority}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-medium text-white mb-3 line-clamp-2">{task.title}</h4>
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>
                      {task.dueDate ? (() => {
                        try {
                          const d = new Date(task.dueDate)
                          return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString()
                        } catch {
                          return 'No date'
                        }
                      })() : 'No date'}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-[#2E5EFF] text-white flex items-center justify-center font-bold text-[10px]" title={`Assignee: ${task.assigneeId || 'Unassigned'}`}>
                      {(task.assigneeId || 'PO').substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
              {columnTasks.length === 0 && (
                <div className="h-20 flex items-center justify-center border-2 border-dashed border-[#1e2d52] rounded-lg text-gray-500 text-sm">
                  Drop here
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
