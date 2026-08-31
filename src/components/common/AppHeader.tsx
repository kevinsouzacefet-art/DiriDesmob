import React from 'react'
import { Breadcrumb } from './Breadcrumb'
import { NotificationDropdown } from './NotificationDropdown'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { useAuth } from '../../providers/AuthProvider'
import { MapPin } from 'lucide-react'

interface AppHeaderProps {
  currentPath: string
  onNavigate: (path: string) => void
}

export const AppHeader: React.FC<AppHeaderProps> = ({ currentPath, onNavigate }) => {
  const { userLocations, isAdmin, isAnalyst } = useAuth()

  // Generate breadcrumb items from current path
  const getBreadcrumbItems = () => {
    switch (currentPath) {
      case '/app/dashboard':
        return [{ label: 'Dashboard Executivo' }]
      case '/app/obras':
        return [{ label: 'Cadastros' }, { label: 'Obras' }]
      case '/app/fornecedores':
        return [{ label: 'Cadastros' }, { label: 'Fornecedores' }]
      case '/app/galpoes':
        return [{ label: 'Cadastros' }, { label: 'Galpões' }]
      case '/app/localizacoes':
        return [{ label: 'Cadastros' }, { label: 'Localizações' }]
      case '/app/materiais':
        return [{ label: 'Cadastros' }, { label: 'Materiais & Fôrmas' }]
      case '/app/estoque':
        return [{ label: 'Logística' }, { label: 'Estoque' }]
      case '/app/mobilizacoes':
        return [{ label: 'Logística' }, { label: 'Mobilizações' }]
      case '/app/desmobilizacoes':
        return [{ label: 'Logística' }, { label: 'Desmobilizações' }]
      case '/app/pallets':
        return [{ label: 'Logística' }, { label: 'Pallets' }]
      case '/app/cargas':
        return [{ label: 'Logística' }, { label: 'Cargas' }]
      case '/app/conferencias':
        return [{ label: 'Logística' }, { label: 'Conferências' }]
      case '/app/divergencias':
        return [{ label: 'Logística' }, { label: 'Divergências' }]
      case '/app/perdas':
        return [{ label: 'Controle' }, { label: 'Reuniões de Perdas' }]
      case '/app/sucatas':
        return [{ label: 'Controle' }, { label: 'Classificação de Sucata' }]
      case '/app/movimentacoes':
        return [{ label: 'Logística' }, { label: 'Movimentações' }]
      case '/app/relatorios':
        return [{ label: 'Análise' }, { label: 'Relatórios' }]
      case '/app/notificacoes':
        return [{ label: 'Sistema' }, { label: 'Notificações' }]
      case '/app/usuarios':
        return [{ label: 'Sistema' }, { label: 'Usuários e Acessos' }]
      case '/app/configuracoes':
        return [{ label: 'Sistema' }, { label: 'Configurações' }]
      default:
        return [{ label: 'DiriDesmob' }]
    }
  }

  return (
    <header className="h-14 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between z-20 shrink-0">
      {/* Left: Breadcrumbs & Context */}
      <div className="flex items-center gap-3">
        <Breadcrumb items={getBreadcrumbItems()} onNavigate={onNavigate} />

        {!isAdmin && !isAnalyst && userLocations.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
            <MapPin className="w-3 h-3 text-blue-500" />
            <span className="truncate max-w-[180px]">{userLocations[0].name}</span>
          </div>
        )}
      </div>

      {/* Right: Actions, Theme, Notifications, Profile */}
      <div className="flex items-center gap-2">
        <NotificationDropdown onViewAll={() => onNavigate('/app/notificacoes')} />
        <ThemeToggle />
        <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
        <UserMenu />
      </div>
    </header>
  )
}
