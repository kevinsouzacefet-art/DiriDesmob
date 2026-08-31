import {
  Database,
  UserSystemRole,
  LocationType,
  WorkStatus,
  LoadStatus,
  PalletStatus,
  ConferenceStatus,
  PalletConferenceStatus,
  DivergenceType,
  DivergenceStatus,
  ScrapStatus,
  ScrapMovementStatus,
  StockBucket,
  StockMovementType,
  MobilizationImportStatus,
  DemobilizationStatus,
  LossStatus,
  LossResponsibleType,
  LossMeetingStatus,
  Json,
} from './database.types'

export type {
  UserSystemRole,
  LocationType,
  WorkStatus,
  LoadStatus,
  PalletStatus,
  ConferenceStatus,
  PalletConferenceStatus,
  DivergenceType,
  DivergenceStatus,
  ScrapStatus,
  ScrapMovementStatus,
  StockBucket,
  StockMovementType,
  MobilizationImportStatus,
  DemobilizationStatus,
  LossStatus,
  LossResponsibleType,
  LossMeetingStatus,
  Json,
}

export type ScrapMovementRequestStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'EXECUTADA' | 'CANCELADA'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Location = Database['public']['Tables']['locations']['Row']
export type Work = Database['public']['Tables']['works']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type Material = Database['public']['Tables']['materials']['Row']
export type LossValuationRate = Database['public']['Tables']['loss_valuation_rates']['Row']
export type SupplierServiceRate = Database['public']['Tables']['supplier_service_rates']['Row']
export type SupplierServiceCost = Database['public']['Tables']['supplier_service_costs']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type UserLocationAccess = Database['public']['Tables']['user_location_access']['Row']
export type Mobilization = Database['public']['Tables']['mobilizations']['Row']
export type MobilizationPallet = Database['public']['Tables']['mobilization_pallets']['Row']
export type MobilizationItem = Database['public']['Tables']['mobilization_items']['Row']
export type MobilizationImportBatch = Database['public']['Tables']['mobilization_import_batches']['Row']
export type MobilizationImportRow = Database['public']['Tables']['mobilization_import_rows']['Row']
export type Demobilization = Database['public']['Tables']['demobilizations']['Row']
export type DemobilizationPallet = Database['public']['Tables']['demobilization_pallets']['Row']
export type DemobilizationPalletItem = Database['public']['Tables']['demobilization_pallet_items']['Row']
export type StockMovement = Database['public']['Tables']['stock_movements']['Row']
export type StockBalance = Database['public']['Tables']['stock_balances']['Row']
export type Load = Database['public']['Tables']['loads']['Row']
export type LoadPallet = Database['public']['Tables']['load_pallets']['Row']
export type StockInTransitBalance = Database['public']['Tables']['stock_in_transit_balances']['Row']
export type LoadConference = Database['public']['Tables']['load_conferences']['Row']
export type PalletConference = Database['public']['Tables']['pallet_conferences']['Row']
export type PalletConferenceItem = Database['public']['Tables']['pallet_conference_items']['Row']
export type Divergence = Database['public']['Tables']['divergences']['Row']
export type DiscrepancyPhoto = Database['public']['Tables']['discrepancy_photos']['Row']
export type DivergenceHistory = Database['public']['Tables']['divergence_history']['Row']
export type ScrapMovementRequest = Database['public']['Tables']['scrap_movement_requests']['Row']
export type Loss = Database['public']['Tables']['losses']['Row']
export type LossMeeting = Database['public']['Tables']['loss_meetings']['Row']
export type LossMeetingLoss = Database['public']['Tables']['loss_meeting_losses']['Row']
export type LossMeetingDivergence = Database['public']['Tables']['loss_meeting_divergences']['Row']

export interface PalletConferenceItemWithDetails extends PalletConferenceItem {
  material: Material
}

export interface PalletConferenceWithDetails extends PalletConference {
  pallet?: DemobilizationPallet | null
  items: PalletConferenceItemWithDetails[]
  divergences?: Divergence[]
  total_expected_pieces: number
  total_received_pieces: number
  total_missing_pieces: number
  total_surplus_pieces: number
}

export interface LoadConferenceWithDetails extends LoadConference {
  load?: LoadWithRelations
  destination_location?: Location
  starter?: Profile | null
  finisher?: Profile | null
  pallet_conferences: PalletConferenceWithDetails[]
  divergences: DivergenceWithDetails[]
}

export interface DivergenceHistoryWithUser extends DivergenceHistory {
  performer?: Profile | null
}

export interface DivergenceWithDetails extends Divergence {
  material?: Material | null
  pallet?: DemobilizationPallet | null
  load?: LoadWithRelations | null
  creator?: Profile | null
  assignee?: Profile | null
  resolver?: Profile | null
  contester?: Profile | null
  photos?: DiscrepancyPhoto[]
  history?: DivergenceHistoryWithUser[]
  losses?: Loss[]
}

export interface ScrapMovementRequestWithDetails extends ScrapMovementRequest {
  origin_location?: Location
  destination_location?: Location
  material?: Material
  requester?: Profile | null
  approver?: Profile | null
  rejecter?: Profile | null
}

export interface LossWithDetails extends Loss {
  divergence?: DivergenceWithDetails | null
  work?: Location | null
  supplier?: Location | null
  material?: Material
  responsible_location?: Location | null
  creator?: Profile | null
  meetings?: LossMeeting[]
}

export interface LossMeetingWithDetails extends LossMeeting {
  work?: Location | null
  creator?: Profile | null
  losses?: (LossMeetingLoss & { loss: LossWithDetails })[]
  divergences?: (LossMeetingDivergence & { divergence: DivergenceWithDetails })[]
}

export interface LoadConsolidatedMaterial {
  material_id: string
  material_code: string
  material_name: string
  unit_area_m2: number
  total_pieces: number
  total_area_m2: number
}

export interface LoadWithRelations extends Load {
  origin_location?: Location
  destination_location?: Location
  creator?: Profile | null
  pallets_count?: number
  total_pieces?: number
  total_area_m2?: number
  is_delayed?: boolean
  pallets?: DemobilizationPalletWithDetails[]
  consolidated_materials?: LoadConsolidatedMaterial[]
  in_transit_balances?: (StockInTransitBalance & { material: Material })[]
}

export interface LoadPalletWithDetails extends LoadPallet {
  pallet: DemobilizationPalletWithDetails
}

export interface DemobilizationWithRelations extends Demobilization {
  work?: Location
  target_location?: Location | null
  pallets_count?: number
  pallets_in_assembly?: number
  pallets_ready?: number
  available_pieces?: number
  reserved_pieces?: number
  reserved_area_m2?: number
  last_movement_at?: string | null
}

export interface DemobilizationPalletItemWithMaterial extends DemobilizationPalletItem {
  material: Material
  total_area_m2?: number
  available_at_work?: number
}

export interface DemobilizationPalletWithDetails extends DemobilizationPallet {
  origin_location?: Location
  destination_location?: Location | null
  demobilization?: DemobilizationWithRelations
  creator?: Profile | null
  items: DemobilizationPalletItemWithMaterial[]
  total_pieces: number
  total_area_m2: number
}

export interface MobilizationWithRelations extends Mobilization {
  destination_work?: Location
  origin_location?: Location | null
  pallets?: MobilizationPalletWithItems[]
  creator?: Profile | null
}

export interface MobilizationPalletWithItems extends MobilizationPallet {
  items: (MobilizationItem & {
    material: Material
  })[]
  totalPieces?: number
  totalAreaM2?: number
}

export interface StockBalanceWithDetails extends StockBalance {
  material: Material
  location: Location
}

export interface StagingValidationError {
  field: string
  message: string
}

export interface StagingParsedRow {
  rowNumber: number
  rawWork: string
  rawOrigin: string
  rawDestination: string
  rawPallet: string
  rawMaterial: string
  rawQuantity: string
  resolvedWorkId?: string | null
  resolvedOriginLocationId?: string | null
  resolvedDestinationLocationId?: string | null
  resolvedMaterialId?: string | null
  resolvedMaterial?: Material | null
  quantity?: number | null
  calculatedAreaM2?: number | null
  isValid: boolean
  isDuplicateWarning: boolean
  validationErrors: StagingValidationError[]
}

export interface BatchPreviewSummary {
  fileName: string
  fileHash: string
  workCode: string
  workName: string
  totalRows: number
  validRows: number
  invalidRows: number
  totalPieces: number
  totalPallets: number
  totalAreaM2: number
}

export interface LossValuationRateWithRelations extends LossValuationRate {
  material?: Material
  work?: WorkWithLocation | null
}

export interface WorkWithLocation extends Work {
  location: Location
}

export interface SupplierWithLocation extends Supplier {
  location: Location
}

export interface UserWithLocations extends Profile {
  location_accesses?: {
    location: Location
  }[]
}

export interface AuthState {
  user: any | null
  profile: Profile | null
  locations: Location[]
  isAdmin: boolean
  isAnalyst: boolean
  isSupervisor: boolean
  isConferente: boolean
  isLoading: boolean
  error: string | null
}

export interface DashboardMetrics {
  totalMobilizedPieces: number
  completedWorks: number
  loadsPerDay: number
  piecesAtWorks: number
  totalPallets: number
  piecesInTransit: number
  piecesAtSuppliers: number
  lossCostTotal: number
  divergenceRate: number
  demobilizingWorks: number
  pendingLoads: number
  delayedLoads: number
  mobilizedAreaM2: number
  demobilizedAreaM2: number
}

export interface LossRankingItem {
  workId: string
  workCode: string
  workName: string
  lossValue: number
  lossPercentage: number
  divergencesCount: number
}

export interface NavItem {
  name: string
  path: string
  icon: string
  badge?: string | number
  minRole?: UserSystemRole[]
  section?: 'operacional' | 'gestao' | 'sistema'
  implemented?: boolean
}
