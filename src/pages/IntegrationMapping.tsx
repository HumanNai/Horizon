import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import * as XLSX from 'xlsx'
import { 
  Network, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  Server, 
  Database, 
  Layers, 
  Globe, 
  Zap, 
  Users, 
  Cpu, 
  Activity, 
  Info, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  Maximize2,
  RefreshCw,
  FolderOpen
} from 'lucide-react'
import { Card, Button, Badge, Modal, Input, Select } from '../components/ui'
import { getSessionToken, dbQuery } from '../store/dbClient'
import { Product } from '../types'

// ── Color and Icon Mappings ──────────────────────────────────
const PROTOCOL_COLORS: Record<string, string> = {
  REST: '#2E5EFF',
  Kafka: '#F5A623',
  MQ: '#8B5CF6',
  gRPC: '#10B981',
  'DB Link': '#EC4899',
  Event: '#EF4444',
  SFTP: '#6B7280',
  Batch: '#64748B',
  SOAP: '#06B6D4',
  Other: '#94A3B8'
}

const NODE_TYPE_CONFIG: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  Application: { bg: 'rgba(46, 94, 255, 0.12)', border: '#2E5EFF', text: '#93C5FD', icon: Server },
  Database: { bg: 'rgba(16, 185, 129, 0.12)', border: '#10B981', text: '#6EE7B7', icon: Database },
  Queue: { bg: 'rgba(245, 166, 35, 0.12)', border: '#F5A623', text: '#FCD34D', icon: Layers },
  ExternalAPI: { bg: 'rgba(168, 85, 247, 0.12)', border: '#A855F7', text: '#D8B4FE', icon: Globe },
  Gateway: { bg: 'rgba(245, 158, 11, 0.12)', border: '#F59E0B', text: '#FDE68A', icon: Zap },
  User: { bg: 'rgba(20, 184, 166, 0.12)', border: '#14B8A6', text: '#5EEAD4', icon: Users },
  Service: { bg: 'rgba(99, 102, 241, 0.12)', border: '#6366F1', text: '#A5B4FC', icon: Cpu }
}

// ── Custom React Flow Node Component ─────────────────────────
function CustomIntegrationNode({ data, selected }: NodeProps) {
  const node = (data as any).nodeData
  const isDimmed = (data as any).isDimmed
  const typeConfig = NODE_TYPE_CONFIG[node.nodeType] || NODE_TYPE_CONFIG.Application
  const IconComp = typeConfig.icon

  return (
    <div 
      className={`relative px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer shadow-lg select-none min-w-[210px] max-w-[260px] ${
        selected ? 'ring-2 ring-blue-400 border-white' : ''
      }`}
      style={{
        backgroundColor: '#0D152E',
        borderColor: selected ? '#60A5FA' : typeConfig.border,
        opacity: isDimmed ? 0.2 : 1,
        boxShadow: selected ? `0 0 16px ${typeConfig.border}` : '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
      }}
    >
      {/* Handles for connections */}
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-[#070B19]" />
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-[#070B19]" />

      {/* Header with Type & Env */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span 
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" 
            style={{ backgroundColor: typeConfig.bg, color: typeConfig.border }}
          >
            <IconComp size={14} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: typeConfig.text }}>
            {node.nodeType}
          </span>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
          node.environment === 'Prod' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
          node.environment === 'UAT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
          'bg-blue-500/10 text-blue-400 border-blue-500/30'
        }`}>
          {node.environment || 'Prod'}
        </span>
      </div>

      {/* Node Title */}
      <div className="font-bold text-white text-xs leading-snug truncate" title={node.label}>
        {node.label}
      </div>

      {/* Tech Stack or Key */}
      <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
        {node.techStack || node.nodeKey}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#1E2D52] text-[10px]">
        <span className="text-gray-400 truncate max-w-[120px]">
          {node.teamOwner || 'Unassigned'}
        </span>
        <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
          node.criticality === 'High' ? 'text-red-400 bg-red-500/10' :
          node.criticality === 'Medium' ? 'text-amber-400 bg-amber-500/10' :
          'text-gray-400 bg-gray-500/10'
        }`}>
          {node.criticality || 'Med'}
        </span>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-[#070B19]" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-blue-400 !border-2 !border-[#070B19]" />
    </div>
  )
}

const nodeTypes = {
  customIntegration: CustomIntegrationNode
}

// ── Props Interface ──────────────────────────────────────────
export interface IntegrationMappingProps {
  productId?: string
  productName?: string
  embeddedMode?: boolean
}

// ── Inner Flow Canvas Component ──────────────────────────────
function CanvasView({ 
  mapData, 
  onSavePositions, 
  searchQuery, 
  filters, 
  onSelectNode,
  onSelectEdge,
  selectedNodeId,
  selectedEdgeId
}: {
  mapData: { map: any; nodes: any[]; edges: any[]; groups: any[] }
  onSavePositions: (positions: any[]) => void
  searchQuery: string
  filters: { env: string; criticality: string; protocol: string }
  onSelectNode: (node: any | null) => void
  onSelectEdge: (edge: any | null) => void
  selectedNodeId: string | null
  selectedEdgeId: string | null
}) {
  const { fitView } = useReactFlow()

  // Convert raw DB nodes to React Flow nodes
  const initialNodes = useMemo(() => {
    return mapData.nodes.map((n) => {
      const matchSearch = !searchQuery || 
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.nodeKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.techStack && n.techStack.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (n.teamOwner && n.teamOwner.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchEnv = filters.env === 'ALL' || n.environment === filters.env
      const matchCrit = filters.criticality === 'ALL' || n.criticality === filters.criticality

      const isDimmed = !matchSearch || !matchEnv || !matchCrit

      return {
        id: n.nodeKey,
        type: 'customIntegration',
        position: { x: n.posX || 50, y: n.posY || 50 },
        selected: selectedNodeId === n.nodeKey,
        data: {
          nodeData: n,
          isDimmed
        }
      }
    })
  }, [mapData.nodes, searchQuery, filters, selectedNodeId])

  // Convert raw DB edges to React Flow edges
  const initialEdges = useMemo(() => {
    return mapData.edges.map((e) => {
      const color = PROTOCOL_COLORS[e.protocol] || '#4B5563'
      const matchProtocol = filters.protocol === 'ALL' || e.protocol === filters.protocol
      const isSelected = selectedEdgeId === e.edgeKey

      return {
        id: e.edgeKey,
        source: e.fromNode,
        target: e.toNode,
        animated: e.status !== 'Deprecated',
        label: `${e.protocol || 'LINK'} (${e.frequency || 'Live'})`,
        style: {
          stroke: color,
          strokeWidth: isSelected ? 3.5 : 2,
          opacity: matchProtocol ? 0.9 : 0.15
        },
        labelStyle: {
          fill: '#E2E8F0',
          fontSize: 10,
          fontWeight: 600
        },
        labelBgStyle: {
          fill: '#0D152E',
          fillOpacity: 0.85,
          rx: 4,
          ry: 4
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: color,
          width: 16,
          height: 16
        },
        data: {
          edgeData: e
        }
      }
    })
  }, [mapData.edges, filters.protocol, selectedEdgeId])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])

  useEffect(() => {
    setEdges(initialEdges)
  }, [initialEdges, setEdges])

  // On node drag stop, persist positions
  const onNodeDragStop = useCallback((_: any, node: any) => {
    const updated = nodes.map(n => n.id === node.id ? { ...n, position: node.position } : n)
    const positionsPayload = updated.map(n => ({
      mapId: mapData.map.id,
      nodeKey: n.id,
      posX: n.position.x,
      posY: n.position.y
    }))
    onSavePositions(positionsPayload)
  }, [nodes, mapData.map.id, onSavePositions])

  const onNodeClick = useCallback((_: any, node: any) => {
    onSelectNode(node.data.nodeData)
    onSelectEdge(null)
  }, [onSelectNode, onSelectEdge])

  const onEdgeClick = useCallback((_: any, edge: any) => {
    onSelectEdge(edge.data.edgeData)
    onSelectNode(null)
  }, [onSelectEdge, onSelectNode])

  const onPaneClick = useCallback(() => {
    onSelectNode(null)
    onSelectEdge(null)
  }, [onSelectNode, onSelectEdge])

  return (
    <div className="w-full h-full relative bg-[#070B19]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1E2D52" gap={24} size={1.5} />
        <Controls 
          className="!bg-[#0D152E] !border !border-[#1E2D52] !rounded-xl !overflow-hidden [&>button]:!bg-[#0D152E] [&>button]:!border-[#1E2D52] [&>button]:!text-gray-300 hover:[&>button]:!bg-[#15203D]" 
        />
        <MiniMap 
          nodeColor={(n: any) => {
            const type = n.data?.nodeData?.nodeType || 'Application'
            return NODE_TYPE_CONFIG[type]?.border || '#2E5EFF'
          }}
          maskColor="rgba(7, 11, 25, 0.7)"
          className="!bg-[#0D152E] !border !border-[#1E2D52] !rounded-xl"
        />
      </ReactFlow>
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────
export function IntegrationMapping({ productId: propProductId, productName: propProductName, embeddedMode = false }: IntegrationMappingProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>(propProductId || '')
  const [maps, setMaps] = useState<any[]>([])
  const [activeMapId, setActiveMapId] = useState<string | null>(null)
  const [activeMapData, setActiveMapData] = useState<{ map: any; nodes: any[]; edges: any[]; groups: any[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ env: 'ALL', criticality: 'ALL', protocol: 'ALL' })

  // Slide-over detail selection
  const [selectedNode, setSelectedNode] = useState<any | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<any | null>(null)

  // Modals
  const [isCreateMapOpen, setIsCreateMapOpen] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [newMapDesc, setNewMapDesc] = useState('')
  const [importStatus, setImportStatus] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 1. Initial Load of products (if not provided via prop)
  useEffect(() => {
    if (!propProductId) {
      loadProducts()
    } else {
      setSelectedProductId(propProductId)
    }
  }, [propProductId])

  const loadProducts = async () => {
    try {
      const list = await dbQuery<Product>('SELECT id, name, type, status FROM products ORDER BY name ASC')
      setProducts(list)
      if (list.length > 0 && !selectedProductId) {
        setSelectedProductId(list[0].id)
      }
    } catch (err) {
      console.error('Failed to load products:', err)
    }
  }

  // 2. Load Maps when selectedProductId changes
  useEffect(() => {
    if (selectedProductId) {
      loadMaps(selectedProductId)
    }
  }, [selectedProductId])

  const loadMaps = async (pId: string) => {
    setLoading(true)
    try {
      const token = getSessionToken()
      const list = await (window as any).horizon?.integrationMapping?.listMaps(token, pId)
      setMaps(list || [])
      if (list && list.length > 0) {
        // Auto-select the first map if none active
        setActiveMapId(list[0].id)
      } else {
        setActiveMapId(null)
        setActiveMapData(null)
      }
    } catch (err) {
      console.error('Failed to load integration maps:', err)
    } finally {
      setLoading(false)
    }
  }

  // 3. Load Active Map Details (nodes, edges, groups)
  useEffect(() => {
    if (activeMapId) {
      loadMapData(activeMapId)
    }
  }, [activeMapId])

  const loadMapData = async (mId: string) => {
    try {
      const token = getSessionToken()
      const data = await (window as any).horizon?.integrationMapping?.getMapData(token, mId)
      setActiveMapData(data)
      setSelectedNode(null)
      setSelectedEdge(null)
    } catch (err) {
      console.error('Failed to load map data:', err)
    }
  }

  // 4. Create New Map
  const handleCreateMap = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMapName.trim() || !selectedProductId) return
    try {
      const token = getSessionToken()
      const created = await (window as any).horizon?.integrationMapping?.createMap(token, {
        productId: selectedProductId,
        name: newMapName.trim(),
        description: newMapDesc.trim()
      })
      setIsCreateMapOpen(false)
      setNewMapName('')
      setNewMapDesc('')
      await loadMaps(selectedProductId)
      if (created?.id) setActiveMapId(created.id)
    } catch (err: any) {
      alert(err.message || 'Failed to create map')
    }
  }

  // 5. Delete Map
  const handleDeleteMap = async (mId: string) => {
    if (!confirm('Are you sure you want to delete this integration map and all its nodes and connections?')) return
    try {
      const token = getSessionToken()
      await (window as any).horizon?.integrationMapping?.deleteMap(token, mId)
      await loadMaps(selectedProductId)
    } catch (err: any) {
      alert(err.message || 'Failed to delete map')
    }
  }

  // 6. Handle Excel File Upload & Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeMapId) return

    setImportStatus('Reading Excel file...')
    const reader = new FileReader()

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const workbook = XLSX.read(bstr, { type: 'binary' })

        // Check required sheets
        const sheetNames = workbook.SheetNames
        const hasNodes = sheetNames.some(s => s.toLowerCase() === 'nodes')
        const hasEdges = sheetNames.some(s => s.toLowerCase() === 'edges')

        if (!hasNodes || !hasEdges) {
          alert('Excel file must contain at least "Nodes" and "Edges" sheets. Please download our template for the exact format.')
          setImportStatus('')
          return
        }

        const nodesSheetName = sheetNames.find(s => s.toLowerCase() === 'nodes')!
        const edgesSheetName = sheetNames.find(s => s.toLowerCase() === 'edges')!
        const groupsSheetName = sheetNames.find(s => s.toLowerCase() === 'groups')

        const rawNodes = XLSX.utils.sheet_to_json(workbook.Sheets[nodesSheetName])
        const rawEdges = XLSX.utils.sheet_to_json(workbook.Sheets[edgesSheetName])
        const rawGroups = groupsSheetName ? XLSX.utils.sheet_to_json(workbook.Sheets[groupsSheetName]) : []

        if (rawNodes.length === 0) {
          alert('Nodes sheet is empty. Please add at least one system/node.')
          setImportStatus('')
          return
        }

        setImportStatus(`Importing ${rawNodes.length} systems & ${rawEdges.length} integrations...`)

        const token = getSessionToken()
        await (window as any).horizon?.integrationMapping?.importExcel(token, {
          mapId: activeMapId,
          nodes: rawNodes,
          edges: rawEdges,
          groups: rawGroups
        })

        setImportStatus('')
        await loadMapData(activeMapId)
        alert(`Successfully imported ${rawNodes.length} systems and ${rawEdges.length} connections!`)
      } catch (err: any) {
        console.error('Import error:', err)
        alert('Failed to parse Excel file: ' + err.message)
        setImportStatus('')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }

    reader.readAsBinaryString(file)
  }

  // 7. Save Node Positions
  const handleSavePositions = useCallback(async (positions: any[]) => {
    try {
      const token = getSessionToken()
      await (window as any).horizon?.integrationMapping?.savePositions(token, positions)
    } catch (err) {
      console.warn('Failed to save positions:', err)
    }
  }, [])

  // 8. Download Template
  const handleDownloadTemplate = () => {
    const link = document.createElement('a')
    link.href = './templates/integration-mapping-template.xlsx'
    link.download = 'Horizon-Integration-Mapping-Template.xlsx'
    link.click()
  }

  // Ingress & Egress for selected node
  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode || !activeMapData) return { ingress: [], egress: [] }
    const key = selectedNode.nodeKey
    const ingress = activeMapData.edges.filter(e => e.toNode === key)
    const egress = activeMapData.edges.filter(e => e.fromNode === key)
    return { ingress, egress }
  }, [selectedNode, activeMapData])

  return (
    <div className={`flex flex-col h-full bg-[#070B19] text-gray-100 ${embeddedMode ? 'p-0' : 'p-6'}`}>
      {/* Top Header / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1E2D52] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Network size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">
                Integration Architecture & Service Map
              </h1>
              {propProductName && (
                <Badge variant="blue">{propProductName}</Badge>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Interactive topological dependency mapping, data-flow pipelines, and interface protocols.
            </p>
          </div>
        </div>

        {/* Global actions: Download Template & Excel Import */}
        <div className="flex items-center gap-2">
          {!embeddedMode && products.length > 0 && (
            <div className="w-52">
              <Select
                value={selectedProductId}
                onChange={e => setSelectedProductId(e.target.value)}
                options={products.map(p => ({ label: p.name, value: p.id }))}
              />
            </div>
          )}

          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleDownloadTemplate}
            title="Download Excel mapping format template"
          >
            <Download size={15} className="mr-1.5 text-blue-400" /> Download Template
          </Button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls" 
            className="hidden" 
          />

          <Button 
            variant="primary" 
            size="sm"
            onClick={() => {
              if (!activeMapId) {
                alert('Please create or select an integration map first before importing.')
                return
              }
              fileInputRef.current?.click()
            }}
            disabled={!activeMapId}
            title="Import Excel file to generate graph"
          >
            <Upload size={15} className="mr-1.5" /> Import Excel
          </Button>

          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setIsCreateMapOpen(true)}
            title="Create new integration map version"
          >
            <Plus size={15} className="mr-1" /> New Map
          </Button>
        </div>
      </div>

      {/* Map Tabs & Filter Toolbar */}
      {maps.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-[#1E2D52] bg-[#0A1024]/60 px-4 shrink-0">
          {/* Map Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {maps.map((m) => (
              <button
                key={m.id}
                onClick={() => setActiveMapId(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                  activeMapId === m.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-[#0D152E] text-gray-400 hover:text-white hover:bg-[#15203D]'
                }`}
              >
                <span>{m.name}</span>
                {activeMapId === m.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteMap(m.id); }}
                    className="text-white/60 hover:text-red-300 ml-1"
                    title="Delete Map"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </button>
            ))}
          </div>

          {/* Search & Filter Controls */}
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search systems..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-[#0D152E] border border-[#1E2D52] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Protocol Filter */}
            <select
              value={filters.protocol}
              onChange={e => setFilters({ ...filters, protocol: e.target.value })}
              className="px-2.5 py-1 bg-[#0D152E] border border-[#1E2D52] rounded-lg text-xs text-gray-300 focus:outline-none"
            >
              <option value="ALL">All Protocols</option>
              {Object.keys(PROTOCOL_COLORS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            {/* Environment Filter */}
            <select
              value={filters.env}
              onChange={e => setFilters({ ...filters, env: e.target.value })}
              className="px-2.5 py-1 bg-[#0D152E] border border-[#1E2D52] rounded-lg text-xs text-gray-300 focus:outline-none"
            >
              <option value="ALL">All Envs</option>
              <option value="Prod">Prod</option>
              <option value="UAT">UAT</option>
              <option value="Dev">Dev</option>
            </select>

            {/* Criticality Filter */}
            <select
              value={filters.criticality}
              onChange={e => setFilters({ ...filters, criticality: e.target.value })}
              className="px-2.5 py-1 bg-[#0D152E] border border-[#1E2D52] rounded-lg text-xs text-gray-300 focus:outline-none"
            >
              <option value="ALL">All Criticality</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <button
              onClick={() => {
                setSearchQuery('')
                setFilters({ env: 'ALL', criticality: 'ALL', protocol: 'ALL' })
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#15203D]"
              title="Reset filters"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Area + Slide-over details */}
      <div className="flex-1 relative overflow-hidden flex">
        {maps.length === 0 ? (
          /* Empty Maps State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <Network size={32} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">No Integration Maps Created Yet</h3>
            <p className="text-xs text-gray-400 max-w-md mb-6 leading-relaxed">
              Create an integration map, download our standardized Excel template, fill in your services and connection details, and import it to visualize a live interactive architectural dependency graph.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                <Download size={14} className="mr-1.5 text-blue-400" /> Download Template (.xlsx)
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsCreateMapOpen(true)}>
                <Plus size={14} className="mr-1.5" /> Create Map
              </Button>
            </div>
          </div>
        ) : activeMapData && activeMapData.nodes.length === 0 ? (
          /* Map exists but has no imported nodes yet */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <FolderOpen size={32} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">
              "{activeMapData.map?.name}" is Empty
            </h3>
            <p className="text-xs text-gray-400 max-w-md mb-6 leading-relaxed">
              Import an Excel workbook with your systems (Nodes sheet) and interactions (Edges sheet) to generate the graph visualization.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                <Download size={14} className="mr-1.5 text-blue-400" /> Download Template
              </Button>
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} className="mr-1.5" /> Import Excel (.xlsx)
              </Button>
            </div>
          </div>
        ) : activeMapData ? (
          /* Canvas View */
          <div className="flex-1 h-full relative">
            <ReactFlowProvider>
              <CanvasView
                mapData={activeMapData}
                onSavePositions={handleSavePositions}
                searchQuery={searchQuery}
                filters={filters}
                onSelectNode={setSelectedNode}
                onSelectEdge={setSelectedEdge}
                selectedNodeId={selectedNode?.nodeKey || null}
                selectedEdgeId={selectedEdge?.edgeKey || null}
              />
            </ReactFlowProvider>

            {/* Quick Metrics Overlay at bottom-left */}
            <div className="absolute bottom-4 left-4 z-10 bg-[#0D152E]/90 backdrop-blur-md border border-[#1E2D52] rounded-xl px-4 py-2 flex items-center gap-5 text-xs text-gray-300 shadow-xl pointer-events-none">
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Systems / Nodes</span>
                <span className="font-bold text-white text-sm">{activeMapData.nodes.length}</span>
              </div>
              <div className="h-6 w-px bg-[#1E2D52]" />
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Integrations</span>
                <span className="font-bold text-white text-sm">{activeMapData.edges.length}</span>
              </div>
              <div className="h-6 w-px bg-[#1E2D52]" />
              <div>
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Protocols</span>
                <span className="font-bold text-white text-sm">
                  {new Set(activeMapData.edges.map(e => e.protocol)).size}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-500">
            Loading map data...
          </div>
        )}

        {/* Slide-over Node Detail Panel */}
        {selectedNode && (
          <div className="w-80 border-l border-[#1E2D52] bg-[#0A1024]/95 backdrop-blur-xl p-5 overflow-y-auto shrink-0 z-20 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1E2D52]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <Server size={18} />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">
                      {selectedNode.nodeType}
                    </span>
                    <h3 className="font-bold text-white text-sm leading-tight">
                      {selectedNode.label}
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)} 
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#15203D]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Attributes Grid */}
              <div className="space-y-3 py-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Node Key / Identifier</span>
                  <span className="font-mono text-gray-200">{selectedNode.nodeKey}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Environment</span>
                  <span className="text-gray-200">{selectedNode.environment || 'Prod'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Criticality</span>
                  <span className={
                    selectedNode.criticality === 'High' ? 'text-red-400 font-semibold' :
                    selectedNode.criticality === 'Medium' ? 'text-amber-400 font-semibold' :
                    'text-gray-300'
                  }>
                    {selectedNode.criticality || 'Medium'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Tech Stack / Runtime</span>
                  <span className="text-gray-200">{selectedNode.techStack || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Team Owner</span>
                  <span className="text-gray-200">{selectedNode.teamOwner || '—'}</span>
                </div>
                {selectedNode.notes && (
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Architectural Notes</span>
                    <p className="text-gray-300 text-xs mt-1 leading-relaxed bg-[#0D152E] p-2 rounded-lg border border-[#1E2D52]">
                      {selectedNode.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Upstream Ingress Integrations */}
              <div className="pt-3 border-t border-[#1E2D52]">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <ArrowRight size={13} className="text-emerald-400 rotate-180" /> Ingress Calls ({selectedNodeConnections.ingress.length})
                </h4>
                {selectedNodeConnections.ingress.length === 0 ? (
                  <span className="text-[11px] text-gray-500 italic">No incoming connections</span>
                ) : (
                  <div className="space-y-2">
                    {selectedNodeConnections.ingress.map((e: any) => (
                      <div key={e.id} className="p-2 bg-[#0D152E] rounded-lg border border-[#1E2D52] text-[11px]">
                        <div className="flex items-center justify-between font-semibold text-white">
                          <span>{e.fromNode}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold" style={{ backgroundColor: `${PROTOCOL_COLORS[e.protocol] || '#4B5563'}20`, color: PROTOCOL_COLORS[e.protocol] || '#4B5563' }}>
                            {e.protocol}
                          </span>
                        </div>
                        <div className="text-gray-400 text-[10px] mt-0.5 flex items-center justify-between">
                          <span>Format: {e.dataFormat || 'JSON'}</span>
                          <span>{e.frequency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Downstream Egress Integrations */}
              <div className="pt-4 border-t border-[#1E2D52] mt-4">
                <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                  <ArrowRight size={13} className="text-blue-400" /> Egress Outbound ({selectedNodeConnections.egress.length})
                </h4>
                {selectedNodeConnections.egress.length === 0 ? (
                  <span className="text-[11px] text-gray-500 italic">No outbound calls</span>
                ) : (
                  <div className="space-y-2">
                    {selectedNodeConnections.egress.map((e: any) => (
                      <div key={e.id} className="p-2 bg-[#0D152E] rounded-lg border border-[#1E2D52] text-[11px]">
                        <div className="flex items-center justify-between font-semibold text-white">
                          <span>{e.toNode}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold" style={{ backgroundColor: `${PROTOCOL_COLORS[e.protocol] || '#4B5563'}20`, color: PROTOCOL_COLORS[e.protocol] || '#4B5563' }}>
                            {e.protocol}
                          </span>
                        </div>
                        <div className="text-gray-400 text-[10px] mt-0.5 flex items-center justify-between">
                          <span>Format: {e.dataFormat || 'JSON'}</span>
                          <span>{e.frequency}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full mt-6"
              onClick={() => setSelectedNode(null)}
            >
              Close Details
            </Button>
          </div>
        )}

        {/* Slide-over Edge Detail Panel */}
        {selectedEdge && (
          <div className="w-80 border-l border-[#1E2D52] bg-[#0A1024]/95 backdrop-blur-xl p-5 overflow-y-auto shrink-0 z-20 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1E2D52]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                    <Activity size={18} />
                  </span>
                  <div>
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">
                      Integration Pipeline
                    </span>
                    <h3 className="font-bold text-white text-sm">
                      {selectedEdge.protocol || 'Interface'} Edge
                    </h3>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEdge(null)} 
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#15203D]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Edge Details */}
              <div className="space-y-3 py-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Source (From)</span>
                  <span className="font-bold text-white text-sm">{selectedEdge.fromNode}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Target (To)</span>
                  <span className="font-bold text-white text-sm">{selectedEdge.toNode}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Protocol</span>
                  <Badge variant="blue">{selectedEdge.protocol || 'REST'}</Badge>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Direction</span>
                  <span className="text-gray-200">{selectedEdge.direction || 'Unidirectional'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Payload / Serialization</span>
                  <span className="font-mono text-gray-200">{selectedEdge.dataFormat || 'JSON'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Execution Frequency</span>
                  <span className="text-gray-200">{selectedEdge.frequency || 'Real-time'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Status</span>
                  <span className="text-emerald-400 font-semibold">{selectedEdge.status || 'Active'}</span>
                </div>
                {selectedEdge.notes && (
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Interface Notes</span>
                    <p className="text-gray-300 text-xs mt-1 leading-relaxed bg-[#0D152E] p-2 rounded-lg border border-[#1E2D52]">
                      {selectedEdge.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full mt-6"
              onClick={() => setSelectedEdge(null)}
            >
              Close Edge Details
            </Button>
          </div>
        )}
      </div>

      {/* Create Map Modal */}
      <Modal
        isOpen={isCreateMapOpen}
        onClose={() => setIsCreateMapOpen(false)}
        title="Create New Integration Architecture Map"
      >
        <form onSubmit={handleCreateMap} className="space-y-4">
          <Input
            label="Architecture Map Name"
            placeholder="e.g. Production Microservices Architecture Q4"
            value={newMapName}
            onChange={e => setNewMapName(e.target.value)}
            required
          />
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1 block">Description (Optional)</label>
            <textarea
              className="w-full bg-[#0D152E] border border-[#1E2D52] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 min-h-[80px]"
              placeholder="Scope, intended release, or architecture overview notes..."
              value={newMapDesc}
              onChange={e => setNewMapDesc(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setIsCreateMapOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Create & Open Map
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// Standalone Page Wrapper for Route /integration-mapping
export function IntegrationMappingPage() {
  return <IntegrationMapping />
}
