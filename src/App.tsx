import React, { useState } from 'react'
import { AuthProvider, useAuth } from './providers/AuthProvider'
import { ThemeProvider } from './providers/ThemeProvider'
import { AppSidebar } from './components/common/AppSidebar'
import { AppHeader } from './components/common/AppHeader'
import { MobileBottomNav } from './components/common/MobileBottomNav'
import { LoadingState } from './components/common/FeedbackStates'

// Feature Pages
import { LoginPage } from './features/auth/LoginPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { LocationsPage } from './features/locations/LocationsPage'
import { WorksPage } from './features/works/WorksPage'
import { SuppliersPage } from './features/suppliers/SuppliersPage'
import { MaterialsPage } from './features/materials/MaterialsPage'
import { UsersPage } from './features/users/UsersPage'
import { NotificationsPage } from './features/notifications/NotificationsPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ModulePlaceholder } from './features/placeholder/ModulePlaceholder'
import { MobilizationsListPage } from './features/mobilizations/MobilizationsListPage'
import { MobilizationImportPage } from './features/mobilizations/MobilizationImportPage'
import { MobilizationDetailPage } from './features/mobilizations/MobilizationDetailPage'
import { StockPage } from './features/stock/StockPage'
import { DemobilizationsListPage } from './features/demobilizations/DemobilizationsListPage'
import { DemobilizationDetailPage } from './features/demobilizations/DemobilizationDetailPage'
import { PalletDetailPage } from './features/demobilizations/PalletDetailPage'
import { PalletsOverviewPage } from './features/demobilizations/PalletsOverviewPage'
import { LoadsListPage } from './features/loads/LoadsListPage'
import { LoadDetailPage } from './features/loads/LoadDetailPage'
import { LoadConferencePage } from './features/conference/LoadConferencePage'
import { ConferencesListPage } from './features/conference/ConferencesListPage'
import { DivergencesPage } from './features/divergences/DivergencesPage'
import { LossesPage } from './features/losses/LossesPage'
import { ScrapPage } from './features/scrap/ScrapPage'
import { MovementsPage } from './features/movements/MovementsPage'
import { ReportsHubPage } from './features/reports/ReportsHubPage'
import { SupplierCostsPage } from './features/supplier-costs/SupplierCostsPage'
import { AuditPage } from './features/audit/AuditPage'

const MainAppContent: React.FC = () => {
  const { session, profile, isLoading } = useAuth()
  const [currentPath, setCurrentPath] = useState('/app/dashboard')
  const [selectedMobilizationId, setSelectedMobilizationId] = useState<string | null>(null)
  const [selectedDemobilizationId, setSelectedDemobilizationId] = useState<string | null>(null)
  const [selectedPalletId, setSelectedPalletId] = useState<string | null>(null)
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0d141f]">
        <LoadingState message="Inicializando sessão e verificando credenciais..." />
      </div>
    )
  }

  if (!session || !profile) {
    return <LoginPage />
  }

  const handleSelectMobilization = (id: string) => {
    setSelectedMobilizationId(id)
    setCurrentPath('/app/mobilizacoes/detalhe')
  }

  const handleSelectDemobilization = (id: string) => {
    setSelectedDemobilizationId(id)
    setCurrentPath('/app/desmobilizacoes/detalhe')
  }

  const handleSelectPallet = (palletId: string, demobId?: string) => {
    setSelectedPalletId(palletId)
    if (demobId) setSelectedDemobilizationId(demobId)
    setCurrentPath('/app/desmobilizacoes/pallets/detalhe')
  }

  const handleSelectLoad = (loadId: string) => {
    setSelectedLoadId(loadId)
    setCurrentPath('/app/cargas/detalhe')
  }

  const renderContent = () => {
    switch (currentPath) {
      case '/app/dashboard':
        return <DashboardPage onNavigate={setCurrentPath} />
      case '/app/obras':
        return <WorksPage />
      case '/app/fornecedores':
        return <SuppliersPage />
      case '/app/galpoes':
      case '/app/localizacoes':
        return <LocationsPage />
      case '/app/materiais':
        return <MaterialsPage />
      case '/app/usuarios':
        return <UsersPage />
      case '/app/notificacoes':
        return <NotificationsPage />
      case '/app/configuracoes':
        return <SettingsPage />

      // Operational Stock & Mobilization Modules
      case '/app/estoque':
        return (
          <StockPage
            onNavigateToMobilizations={() => setCurrentPath('/app/mobilizacoes/importar')}
          />
        )
      case '/app/mobilizacoes':
        return (
          <MobilizationsListPage
            onNavigate={setCurrentPath}
            onSelectMobilization={handleSelectMobilization}
          />
        )
      case '/app/mobilizacoes/importar':
        return (
          <MobilizationImportPage
            onBack={() => setCurrentPath('/app/mobilizacoes')}
            onNavigateToStock={() => setCurrentPath('/app/estoque')}
            onViewMobilization={handleSelectMobilization}
          />
        )
      case '/app/mobilizacoes/detalhe':
        return selectedMobilizationId ? (
          <MobilizationDetailPage
            mobilizationId={selectedMobilizationId}
            onBack={() => setCurrentPath('/app/mobilizacoes')}
            onNavigateToStock={() => setCurrentPath('/app/estoque')}
          />
        ) : (
          <MobilizationsListPage
            onNavigate={setCurrentPath}
            onSelectMobilization={handleSelectMobilization}
          />
        )

      // Demobilization & Pallets Modules (Phase 2.3)
      case '/app/desmobilizacoes':
        return (
          <DemobilizationsListPage
            onNavigate={setCurrentPath}
            onSelectDemobilization={handleSelectDemobilization}
          />
        )
      case '/app/desmobilizacoes/detalhe':
        return selectedDemobilizationId ? (
          <DemobilizationDetailPage
            demobilizationId={selectedDemobilizationId}
            onBack={() => setCurrentPath('/app/desmobilizacoes')}
            onSelectPallet={(palletId) => handleSelectPallet(palletId, selectedDemobilizationId)}
          />
        ) : (
          <DemobilizationsListPage
            onNavigate={setCurrentPath}
            onSelectDemobilization={handleSelectDemobilization}
          />
        )
      case '/app/desmobilizacoes/pallets/detalhe':
        return selectedPalletId ? (
          <PalletDetailPage
            palletId={selectedPalletId}
            onBack={() => {
              if (selectedDemobilizationId) {
                setCurrentPath('/app/desmobilizacoes/detalhe')
              } else {
                setCurrentPath('/app/pallets')
              }
            }}
          />
        ) : (
          <PalletsOverviewPage
            onNavigate={setCurrentPath}
            onSelectPallet={handleSelectPallet}
          />
        )
      case '/app/pallets':
        return (
          <PalletsOverviewPage
            onNavigate={setCurrentPath}
            onSelectPallet={handleSelectPallet}
          />
        )
      case '/app/cargas':
        return (
          <LoadsListPage
            onNavigate={setCurrentPath}
            onSelectLoad={handleSelectLoad}
          />
        )
      case '/app/cargas/detalhe':
        return selectedLoadId ? (
          <LoadDetailPage
            loadId={selectedLoadId}
            onBack={() => setCurrentPath('/app/cargas')}
            onSelectPallet={handleSelectPallet}
            onNavigateToConference={(lId) => {
              setSelectedLoadId(lId)
              setCurrentPath('/app/cargas/conferencia')
            }}
          />
        ) : (
          <LoadsListPage
            onNavigate={setCurrentPath}
            onSelectLoad={handleSelectLoad}
          />
        )
      case '/app/cargas/conferencia':
        return selectedLoadId ? (
          <LoadConferencePage
            loadId={selectedLoadId}
            onBack={() => setCurrentPath('/app/cargas/detalhe')}
            onNavigateToLoads={() => setCurrentPath('/app/cargas')}
          />
        ) : (
          <ConferencesListPage
            onNavigate={setCurrentPath}
            onSelectLoadForConference={(lId) => {
              setSelectedLoadId(lId)
              setCurrentPath('/app/cargas/conferencia')
            }}
          />
        )
      case '/app/conferencias':
        return (
          <ConferencesListPage
            onNavigate={setCurrentPath}
            onSelectLoadForConference={(lId) => {
              setSelectedLoadId(lId)
              setCurrentPath('/app/cargas/conferencia')
            }}
          />
        )
      case '/app/divergencias':
        return (
          <DivergencesPage
            onNavigateToConference={(lId) => {
              setSelectedLoadId(lId)
              setCurrentPath('/app/cargas/conferencia')
            }}
          />
        )
      case '/app/perdas':
        return <LossesPage />
      case '/app/sucata':
        return <ScrapPage />
      case '/app/movimentacoes':
        return <MovementsPage />
      case '/app/custos-fornecedores':
        return <SupplierCostsPage onNavigate={setCurrentPath} />
      case '/app/relatorios':
        return <ReportsHubPage onNavigate={setCurrentPath} />
      case '/app/auditoria':
        return <AuditPage onNavigate={setCurrentPath} />
      default:
        return <DashboardPage onNavigate={setCurrentPath} />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-[#0a0f18] text-zinc-900 dark:text-zinc-100 antialiased font-sans">
      {/* Enterprise Collapsible Sidebar */}
      <AppSidebar
        currentPath={currentPath}
        onNavigate={setCurrentPath}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main App Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AppHeader currentPath={currentPath} onNavigate={setCurrentPath} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6">
          <div className="max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Responsive Mobile Bottom Bar */}
      <MobileBottomNav currentPath={currentPath} onNavigate={setCurrentPath} />
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainAppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
