import React from 'react'
import {
  LayoutDashboard,
  Building2,
  Truck,
  Warehouse,
  MapPin,
  Layers,
  PackageCheck,
  Boxes,
  Container,
  ClipboardCheck,
  AlertTriangle,
  Flame,
  Trash2,
  ArrowLeftRight,
  FileBarChart,
  Bell,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Coins,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'
import { NavItem } from '../../types'
import { cn } from '../../lib/utils'

interface AppSidebarProps {
  currentPath: string
  onNavigate: (path: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentPath,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { isAdmin, isAnalyst, profile } = useAuth()

  const navItems: NavItem[] = [
    // Operacional
    {
      name: 'Dashboard',
      path: '/app/dashboard',
      icon: 'LayoutDashboard',
      section: 'operacional',
      implemented: true,
    },
    {
      name: 'Obras',
      path: '/app/obras',
      icon: 'Building2',
      section: 'operacional',
      implemented: true,
    },
    {
      name: 'Fornecedores',
      path: '/app/fornecedores',
      icon: 'Truck',
      section: 'operacional',
      implemented: true,
    },
    {
      name: 'Galpões',
      path: '/app/galpoes',
      icon: 'Warehouse',
      section: 'operacional',
      implemented: true,
    },
    {
      name: 'Localizações',
      path: '/app/localizacoes',
      icon: 'MapPin',
      section: 'operacional',
      implemented: true,
    },
    {
      name: 'Materiais / Fôrmas',
      path: '/app/materiais',
      icon: 'Layers',
      section: 'operacional',
      implemented: true,
    },

    // Movimentação & Controle (Operacional)
    {
      name: 'Estoque / Posição',
      path: '/app/estoque',
      icon: 'Boxes',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Mobilizações',
      path: '/app/mobilizacoes',
      icon: 'PackageCheck',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Desmobilizações',
      path: '/app/desmobilizacoes',
      icon: 'Layers',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Pallets / Volumes',
      path: '/app/pallets',
      icon: 'Boxes',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Cargas / Transportes',
      path: '/app/cargas',
      icon: 'Truck',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Conferências',
      path: '/app/conferencias',
      icon: 'ClipboardCheck',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Divergências',
      path: '/app/divergencias',
      icon: 'AlertTriangle',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Reuniões de Perdas',
      path: '/app/perdas',
      icon: 'Flame',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Classificação de Sucata',
      path: '/app/sucata',
      icon: 'Trash2',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Custos de Fornecedores',
      path: '/app/custos-fornecedores',
      icon: 'Coins',
      section: 'gestao',
      minRole: ['ADMINISTRADOR', 'ANALISTA', 'FORNECEDOR_SUPERVISOR', 'FORNECEDOR_CONFERENTE'],
      implemented: true,
    },
    {
      name: 'Movimentações',
      path: '/app/movimentacoes',
      icon: 'ArrowLeftRight',
      section: 'gestao',
      implemented: true,
    },
    {
      name: 'Relatórios / Análises',
      path: '/app/relatorios',
      icon: 'FileBarChart',
      section: 'gestao',
      implemented: true,
    },

    // Sistema
    {
      name: 'Auditoria do Sistema',
      path: '/app/auditoria',
      icon: 'ShieldCheck',
      section: 'sistema',
      minRole: ['ADMINISTRADOR', 'ANALISTA'],
      implemented: true,
    },
    {
      name: 'Notificações',
      path: '/app/notificacoes',
      icon: 'Bell',
      section: 'sistema',
      implemented: true,
    },
    {
      name: 'Usuários e Acessos',
      path: '/app/usuarios',
      icon: 'Users',
      section: 'sistema',
      minRole: ['ADMINISTRADOR'],
      implemented: true,
    },
    {
      name: 'Configurações',
      path: '/app/configuracoes',
      icon: 'Settings',
      section: 'sistema',
      minRole: ['ADMINISTRADOR'],
      implemented: true,
    },
  ]

  const getIcon = (name: string) => {
    const props = { className: 'w-4 h-4 shrink-0' }
    switch (name) {
      case 'LayoutDashboard': return <LayoutDashboard {...props} />
      case 'Building2': return <Building2 {...props} />
      case 'Truck': return <Truck {...props} />
      case 'Warehouse': return <Warehouse {...props} />
      case 'MapPin': return <MapPin {...props} />
      case 'Layers': return <Layers {...props} />
      case 'PackageCheck': return <PackageCheck {...props} />
      case 'Boxes': return <Boxes {...props} />
      case 'Container': return <Container {...props} />
      case 'ClipboardCheck': return <ClipboardCheck {...props} />
      case 'AlertTriangle': return <AlertTriangle {...props} />
      case 'Flame': return <Flame {...props} />
      case 'Trash2': return <Trash2 {...props} />
      case 'Coins': return <Coins {...props} />
      case 'ArrowLeftRight': return <ArrowLeftRight {...props} />
      case 'FileBarChart': return <FileBarChart {...props} />
      case 'ShieldCheck': return <ShieldCheck {...props} />
      case 'Bell': return <Bell {...props} />
      case 'Users': return <Users {...props} />
      case 'Settings': return <Settings {...props} />
      default: return <LayoutDashboard {...props} />
    }
  }

  const filteredItems = navItems.filter(item => {
    if (!item.minRole) return true
    if (isAdmin) return true
    return item.minRole.includes(profile?.system_role as any)
  })

  const sections = [
    { key: 'operacional', label: 'Cadastros & Operação' },
    { key: 'gestao', label: 'Logística & Controle' },
    { key: 'sistema', label: 'Administração' },
  ]

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-200 z-30 shrink-0 select-none',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="h-14 flex items-center justify-between px-3.5 border-b border-zinc-200 dark:border-zinc-800">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-black text-sm tracking-tighter shrink-0 shadow-xs">
              DD
            </div>
            <div className="truncate">
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 block">
                DiriDesmob
              </span>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block -mt-0.5 tracking-wider uppercase">
                Gestão de Fôrmas
              </span>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
            DD
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {sections.map(section => {
          const items = filteredItems.filter(i => i.section === section.key)
          if (items.length === 0) return null

          return (
            <div key={section.key} className="space-y-0.5">
              {!isCollapsed && (
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {section.label}
                </p>
              )}
              {items.map(item => {
                const isActive = currentPath === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => onNavigate(item.path)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer text-left relative group',
                      isActive
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    {getIcon(item.icon)}

                    {!isCollapsed && (
                      <span className="truncate flex-1">{item.name}</span>
                    )}

                    {!isCollapsed && !item.implemented && (
                      <span
                        className={cn(
                          'text-[9px] px-1.5 py-0.2 rounded font-mono',
                          isActive
                            ? 'bg-blue-700 text-blue-200'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'
                        )}
                      >
                        Etapa 2
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Bottom Environment Status */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400">
        {!isCollapsed ? (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Supabase RLS Ativo
            </span>
            <span className="text-[10px] font-mono text-zinc-400">v2.0-Fase2</span>
          </div>
        ) : (
          <div className="flex justify-center" title="RLS Ativo">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>
    </aside>
  )
}
