export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserSystemRole =
  | 'ADMINISTRADOR'
  | 'ANALISTA'
  | 'OBRA_SUPERVISOR'
  | 'OBRA_CONFERENTE'
  | 'FORNECEDOR_SUPERVISOR'
  | 'FORNECEDOR_CONFERENTE'
  | 'GALPAO_CONFERENTE'

export type LocationType = 'GALPAO' | 'OBRA' | 'FORNECEDOR'

export type WorkStatus =
  | 'PLANEJADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'PARALISADA'

export type LoadStatus =
  | 'RASCUNHO'
  | 'PRONTA_PARA_ENVIO'
  | 'ENVIADA'
  | 'EM_TRANSITO'
  | 'RECEBIDA'
  | 'EM_CONFERENCIA'
  | 'CONFERIDA'
  | 'FINALIZADA'
  | 'CANCELADA'

export type DemobilizationStatus =
  | 'DISPONIVEL'
  | 'EM_DESMOBILIZACAO'
  | 'PARCIALMENTE_DESMOBILIZADA'
  | 'DESMOBILIZADA'

export type PalletStatus =
  | 'EM_MONTAGEM'
  | 'PRONTO'
  | 'RESERVADO'
  | 'EM_CARGA'
  | 'ENVIADO'
  | 'RECEBIDO'
  | 'CONFERIDO'
  | 'FINALIZADO'
  | 'DESMONTADO'
  | 'CANCELADO'
  | 'LIBERADO'
  | 'ALOCADO_EM_CARGA'

export type ConferenceStatus = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'FINALIZADA' | 'CANCELADA'

export type PalletConferenceStatus = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA'

export type DivergenceType =
  | 'FALTANTE'
  | 'SUCATA'
  | 'MATERIAL_DIFERENTE'
  | 'PALLET_DIFERENTE'
  | 'PALLET_DANIFICADO'
  | 'OUTRO'
  | 'EXCEDENTE_DE_ORIGEM'
  | 'FALTA'
  | 'SOBRA'
  | 'AVARIA'
  | 'ITEM_TROCADO'

export type DivergenceStatus = 'PENDENTE' | 'EM_ANALISE' | 'CONTESTADA' | 'RESOLVIDA' | 'ABERTA' | 'REJEITADA'

export type ScrapStatus =
  | 'AGUARDANDO_CLASSIFICACAO'
  | 'CLASSIFICADA'
  | 'DISPONIVEL_PARA_DESTINACAO'
  | 'DESTINADA'
  | 'DESCARTADA'

export type ScrapMovementStatus = 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'EXECUTADA'

export type StockBucket =
  | 'DISPONIVEL'
  | 'RESERVADO'
  | 'EM_TRANSITO'
  | 'EM_CONFERENCIA'
  | 'AVARIADO'
  | 'SUCATA'
  | 'AGUARDANDO_CLASSIFICACAO'
  | 'REAPROVEITAVEL'

export type StockMovementType =
  | 'MOBILIZACAO'
  | 'DESMOBILIZACAO'
  | 'TRANSFERENCIA'
  | 'AJUSTE'
  | 'SUCATA_BAIXA'
  | 'RESERVA_PALLET'
  | 'LIBERACAO_PALLET'
  | 'EXPEDICAO_CARGA'
  | 'CANCELAMENTO_EXPEDICAO'
  | 'RECEBIMENTO_CARGA'
  | 'RECONCILIACAO_EXCEDENTE'
  | 'RECONCILIACAO_MATERIAL_DIFERENTE'
  | 'RECONCILIACAO_FALTANTE_LOCALIZADO'
  | 'BAIXA_FALTANTE'
  | 'RECONCILIACAO_FALTANTE'
  | 'CLASSIFICACAO_FORNECEDOR'
  | 'MOVIMENTACAO_SUCATA'

export type LossStatus =
  | 'PENDENTE'
  | 'EM_NEGOCIACAO'
  | 'APROVADA'
  | 'COBRADA'
  | 'PAGA'
  | 'ABSORVIDA_PELA_EMPRESA'

export type LossResponsibleType = 'OBRA' | 'FORNECEDOR' | 'TRANSPORTADORA' | 'INTERNO' | 'OUTRO'
export type LossMeetingStatus = 'AGENDADA' | 'REALIZADA' | 'CANCELADA'

export type MobilizationImportStatus =
  | 'UPLOADED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'HAS_ERRORS'
  | 'READY_TO_COMMIT'
  | 'COMMITTED'
  | 'CANCELLED'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          system_role: UserSystemRole
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          system_role?: UserSystemRole
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          system_role?: UserSystemRole
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      locations: {
        Row: {
          id: string
          code: string
          name: string
          type: LocationType
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          type: LocationType
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          type?: LocationType
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      works: {
        Row: {
          id: string
          status: WorkStatus
          manager_name: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          status?: WorkStatus
          manager_name?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          status?: WorkStatus
          manager_name?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      suppliers: {
        Row: {
          id: string
          cnpj: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_email: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_email?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_location_access: {
        Row: {
          id: string
          user_id: string
          location_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          location_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          location_id?: string
          created_at?: string
        }
      }
      materials: {
        Row: {
          id: string
          code: string
          name: string
          width_mm: number
          height_mm: number
          unit_area_m2: number
          unit: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          width_mm: number
          height_mm: number
          unit?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          width_mm?: number
          height_mm?: number
          unit?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      loss_valuation_rates: {
        Row: {
          id: string
          material_id: string
          work_id: string | null
          rate_per_m2: number
          valid_from: string
          valid_to: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          material_id: string
          work_id?: string | null
          rate_per_m2: number
          valid_from: string
          valid_to?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          work_id?: string | null
          rate_per_m2?: number
          valid_from?: string
          valid_to?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      supplier_service_rates: {
        Row: {
          id: string
          supplier_id: string
          rate_per_m2: number
          valid_from: string
          valid_to: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          rate_per_m2: number
          valid_from: string
          valid_to?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          rate_per_m2?: number
          valid_from?: string
          valid_to?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string | null
          target_role: UserSystemRole | null
          target_location_id: string | null
          title: string
          message: string
          event_type: string
          is_read: boolean
          read_at: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          target_role?: UserSystemRole | null
          target_location_id?: string | null
          title: string
          message: string
          event_type: string
          is_read?: boolean
          read_at?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          target_role?: UserSystemRole | null
          target_location_id?: string | null
          title?: string
          message?: string
          event_type?: string
          is_read?: boolean
          read_at?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      mobilizations: {
        Row: {
          id: string
          code: string
          destination_work_id: string
          origin_location_id: string
          status: string
          import_batch_id: string | null
          total_pieces: number
          total_pallets: number
          total_area_m2: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          destination_work_id: string
          origin_location_id: string
          status?: string
          import_batch_id?: string | null
          total_pieces?: number
          total_pallets?: number
          total_area_m2?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          destination_work_id?: string
          origin_location_id?: string
          status?: string
          import_batch_id?: string | null
          total_pieces?: number
          total_pallets?: number
          total_area_m2?: number
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      mobilization_pallets: {
        Row: {
          id: string
          mobilization_id: string
          pallet_number: string
          created_at: string
        }
        Insert: {
          id?: string
          mobilization_id: string
          pallet_number: string
          created_at?: string
        }
        Update: {
          id?: string
          mobilization_id?: string
          pallet_number?: string
          created_at?: string
        }
      }
      mobilization_items: {
        Row: {
          id: string
          mobilization_pallet_id: string
          material_id: string
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          mobilization_pallet_id: string
          material_id: string
          quantity: number
          created_at?: string
        }
        Update: {
          id?: string
          mobilization_pallet_id?: string
          material_id?: string
          quantity?: number
          created_at?: string
        }
      }
      mobilization_import_batches: {
        Row: {
          id: string
          work_id: string | null
          file_name: string
          file_hash: string
          file_storage_path: string | null
          uploaded_by: string | null
          uploaded_at: string
          status: MobilizationImportStatus
          total_rows: number
          valid_rows: number
          invalid_rows: number
          total_pieces: number
          total_pallets: number
          total_area_m2: number
          committed_at: string | null
          committed_by: string | null
          mobilization_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_id?: string | null
          file_name: string
          file_hash: string
          file_storage_path?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
          status?: MobilizationImportStatus
          total_rows?: number
          valid_rows?: number
          invalid_rows?: number
          total_pieces?: number
          total_pallets?: number
          total_area_m2?: number
          committed_at?: string | null
          committed_by?: string | null
          mobilization_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_id?: string | null
          file_name?: string
          file_hash?: string
          file_storage_path?: string | null
          uploaded_by?: string | null
          uploaded_at?: string
          status?: MobilizationImportStatus
          total_rows?: number
          valid_rows?: number
          invalid_rows?: number
          total_pieces?: number
          total_pallets?: number
          total_area_m2?: number
          committed_at?: string | null
          committed_by?: string | null
          mobilization_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      mobilization_import_rows: {
        Row: {
          id: string
          batch_id: string
          row_number: number
          raw_work: string | null
          raw_origin: string | null
          raw_destination: string | null
          raw_pallet: string | null
          raw_material: string | null
          raw_quantity: string | null
          resolved_work_id: string | null
          resolved_origin_location_id: string | null
          resolved_destination_location_id: string | null
          resolved_material_id: string | null
          quantity: number | null
          calculated_area_m2: number | null
          is_valid: boolean
          is_duplicate_warning: boolean
          validation_errors: Json
          created_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          row_number: number
          raw_work?: string | null
          raw_origin?: string | null
          raw_destination?: string | null
          raw_pallet?: string | null
          raw_material?: string | null
          raw_quantity?: string | null
          resolved_work_id?: string | null
          resolved_origin_location_id?: string | null
          resolved_destination_location_id?: string | null
          resolved_material_id?: string | null
          quantity?: number | null
          calculated_area_m2?: number | null
          is_valid?: boolean
          is_duplicate_warning?: boolean
          validation_errors?: Json
          created_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          row_number?: number
          raw_work?: string | null
          raw_origin?: string | null
          raw_destination?: string | null
          raw_pallet?: string | null
          raw_material?: string | null
          raw_quantity?: string | null
          resolved_work_id?: string | null
          resolved_origin_location_id?: string | null
          resolved_destination_location_id?: string | null
          resolved_material_id?: string | null
          quantity?: number | null
          calculated_area_m2?: number | null
          is_valid?: boolean
          is_duplicate_warning?: boolean
          validation_errors?: Json
          created_at?: string
        }
      }
      stock_movements: {
        Row: {
          id: string
          movement_type: StockMovementType
          material_id: string
          quantity: number
          origin_location_id: string | null
          destination_location_id: string
          source_bucket: StockBucket | null
          destination_bucket: StockBucket
          load_id: string | null
          pallet_id: string | null
          mobilization_id: string | null
          mobilization_pallet_id: string | null
          demobilization_id: string | null
          demobilization_pallet_id: string | null
          notes: string | null
          idempotency_key: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          movement_type: StockMovementType
          material_id: string
          quantity: number
          origin_location_id?: string | null
          destination_location_id: string
          source_bucket?: StockBucket | null
          destination_bucket?: StockBucket
          load_id?: string | null
          pallet_id?: string | null
          mobilization_id?: string | null
          mobilization_pallet_id?: string | null
          demobilization_id?: string | null
          demobilization_pallet_id?: string | null
          notes?: string | null
          idempotency_key?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          movement_type?: StockMovementType
          material_id?: string
          quantity?: number
          origin_location_id?: string | null
          destination_location_id?: string
          source_bucket?: StockBucket | null
          destination_bucket?: StockBucket
          load_id?: string | null
          pallet_id?: string | null
          mobilization_id?: string | null
          mobilization_pallet_id?: string | null
          demobilization_id?: string | null
          demobilization_pallet_id?: string | null
          notes?: string | null
          idempotency_key?: string | null
          created_by?: string | null
          created_at?: string
        }
      }
      loads: {
        Row: {
          id: string
          code: string
          origin_location_id: string
          destination_location_id: string
          status: LoadStatus
          vehicle_plate: string | null
          driver_name: string | null
          carrier_name: string | null
          departure_date: string | null
          expected_arrival_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          sent_at: string | null
          received_at: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancellation_reason: string | null
        }
        Insert: {
          id?: string
          code?: string
          origin_location_id: string
          destination_location_id: string
          status?: LoadStatus
          vehicle_plate?: string | null
          driver_name?: string | null
          carrier_name?: string | null
          departure_date?: string | null
          expected_arrival_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          sent_at?: string | null
          received_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_reason?: string | null
        }
        Update: {
          id?: string
          code?: string
          origin_location_id?: string
          destination_location_id?: string
          status?: LoadStatus
          vehicle_plate?: string | null
          driver_name?: string | null
          carrier_name?: string | null
          departure_date?: string | null
          expected_arrival_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          sent_at?: string | null
          received_at?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancellation_reason?: string | null
        }
      }
      load_pallets: {
        Row: {
          id: string
          load_id: string
          pallet_id: string
          is_active: boolean
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          load_id: string
          pallet_id: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          load_id?: string
          pallet_id?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
        }
      }
      stock_in_transit_balances: {
        Row: {
          id: string
          load_id: string
          pallet_id: string
          material_id: string
          origin_location_id: string
          destination_location_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          load_id: string
          pallet_id: string
          material_id: string
          origin_location_id: string
          destination_location_id: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          load_id?: string
          pallet_id?: string
          material_id?: string
          origin_location_id?: string
          destination_location_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      demobilizations: {
        Row: {
          id: string
          work_id: string
          target_location_id: string | null
          status: DemobilizationStatus
          enabled_at: string
          enabled_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_id: string
          target_location_id?: string | null
          status?: DemobilizationStatus
          enabled_at?: string
          enabled_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_id?: string
          target_location_id?: string | null
          status?: DemobilizationStatus
          enabled_at?: string
          enabled_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      demobilization_pallets: {
        Row: {
          id: string
          code: string
          demobilization_id: string
          origin_location_id: string
          destination_location_id: string | null
          status: PalletStatus
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code?: string
          demobilization_id: string
          origin_location_id: string
          destination_location_id?: string | null
          status?: PalletStatus
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          demobilization_id?: string
          origin_location_id?: string
          destination_location_id?: string | null
          status?: PalletStatus
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      demobilization_pallet_items: {
        Row: {
          id: string
          pallet_id: string
          material_id: string
          quantity: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pallet_id: string
          material_id: string
          quantity: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pallet_id?: string
          material_id?: string
          quantity?: number
          created_at?: string
          updated_at?: string
        }
      }
      stock_balances: {
        Row: {
          id: string
          location_id: string
          material_id: string
          bucket: StockBucket
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location_id: string
          material_id: string
          bucket?: StockBucket
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location_id?: string
          material_id?: string
          bucket?: StockBucket
          quantity?: number
          updated_at?: string
        }
      }
      operation_idempotency: {
        Row: {
          id: string
          operation_key: string
          operation_type: string
          entity_type: string | null
          entity_id: string | null
          user_id: string | null
          status: string
          response_payload: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          operation_key: string
          operation_type: string
          entity_type?: string | null
          entity_id?: string | null
          user_id?: string | null
          status?: string
          response_payload?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          operation_key?: string
          operation_type?: string
          entity_type?: string | null
          entity_id?: string | null
          user_id?: string | null
          status?: string
          response_payload?: Json | null
          created_at?: string
        }
      }
      load_conferences: {
        Row: {
          id: string
          load_id: string
          destination_location_id: string
          status: ConferenceStatus
          started_at: string
          finished_at: string | null
          started_by: string | null
          finished_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          load_id: string
          destination_location_id: string
          status?: ConferenceStatus
          started_at?: string
          finished_at?: string | null
          started_by?: string | null
          finished_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          load_id?: string
          destination_location_id?: string
          status?: ConferenceStatus
          started_at?: string
          finished_at?: string | null
          started_by?: string | null
          finished_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      pallet_conferences: {
        Row: {
          id: string
          conference_id: string
          pallet_id: string | null
          is_unexpected: boolean
          unexpected_code: string | null
          status: PalletConferenceStatus
          started_at: string | null
          finished_at: string | null
          started_by: string | null
          finished_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conference_id: string
          pallet_id?: string | null
          is_unexpected?: boolean
          unexpected_code?: string | null
          status?: PalletConferenceStatus
          started_at?: string | null
          finished_at?: string | null
          started_by?: string | null
          finished_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conference_id?: string
          pallet_id?: string | null
          is_unexpected?: boolean
          unexpected_code?: string | null
          status?: PalletConferenceStatus
          started_at?: string | null
          finished_at?: string | null
          started_by?: string | null
          finished_by?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      pallet_conference_items: {
        Row: {
          id: string
          pallet_conference_id: string
          material_id: string
          expected_qty: number
          received_qty: number | null
          is_checked: boolean
          is_unexpected: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pallet_conference_id: string
          material_id: string
          expected_qty?: number
          received_qty?: number | null
          is_checked?: boolean
          is_unexpected?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pallet_conference_id?: string
          material_id?: string
          expected_qty?: number
          received_qty?: number | null
          is_checked?: boolean
          is_unexpected?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      divergences: {
        Row: {
          id: string
          load_id: string
          conference_id: string | null
          pallet_conference_id: string | null
          pallet_id: string | null
          material_id: string | null
          type: DivergenceType
          expected_qty: number | null
          received_qty: number | null
          difference_qty: number | null
          status: DivergenceStatus
          notes: string | null
          assigned_to: string | null
          analysis_started_at: string | null
          contest_reason: string | null
          contested_by: string | null
          contested_at: string | null
          resolution_type: string | null
          resolution_notes: string | null
          resolved_by: string | null
          resolved_at: string | null
          allocated_loss_qty: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          load_id: string
          conference_id?: string | null
          pallet_conference_id?: string | null
          pallet_id?: string | null
          material_id?: string | null
          type: DivergenceType
          expected_qty?: number | null
          received_qty?: number | null
          difference_qty?: number | null
          status?: DivergenceStatus
          notes?: string | null
          assigned_to?: string | null
          analysis_started_at?: string | null
          contest_reason?: string | null
          contested_by?: string | null
          contested_at?: string | null
          resolution_type?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          allocated_loss_qty?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          load_id?: string
          conference_id?: string | null
          pallet_conference_id?: string | null
          pallet_id?: string | null
          material_id?: string | null
          type?: DivergenceType
          expected_qty?: number | null
          received_qty?: number | null
          difference_qty?: number | null
          status?: DivergenceStatus
          notes?: string | null
          assigned_to?: string | null
          analysis_started_at?: string | null
          contest_reason?: string | null
          contested_by?: string | null
          contested_at?: string | null
          resolution_type?: string | null
          resolution_notes?: string | null
          resolved_by?: string | null
          resolved_at?: string | null
          allocated_loss_qty?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      divergence_history: {
        Row: {
          id: string
          divergence_id: string
          action: string
          from_status: string | null
          to_status: string | null
          notes: string | null
          performed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          divergence_id: string
          action: string
          from_status?: string | null
          to_status?: string | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          divergence_id?: string
          action?: string
          from_status?: string | null
          to_status?: string | null
          notes?: string | null
          performed_by?: string | null
          created_at?: string
        }
      }
      scrap_movement_requests: {
        Row: {
          id: string
          origin_location_id: string
          destination_location_id: string
          material_id: string
          quantity: number
          status: ScrapMovementStatus
          requested_by: string | null
          requested_at: string
          approved_by: string | null
          approved_at: string | null
          rejected_by: string | null
          rejected_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          origin_location_id: string
          destination_location_id: string
          material_id: string
          quantity: number
          status?: ScrapMovementStatus
          requested_by?: string | null
          requested_at?: string
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          origin_location_id?: string
          destination_location_id?: string
          material_id?: string
          quantity?: number
          status?: ScrapMovementStatus
          requested_by?: string | null
          requested_at?: string
          approved_by?: string | null
          approved_at?: string | null
          rejected_by?: string | null
          rejected_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      losses: {
        Row: {
          id: string
          divergence_id: string | null
          work_id: string | null
          supplier_id: string | null
          material_id: string
          quantity: number
          responsible_type: LossResponsibleType
          responsible_reference_id: string | null
          reason: string
          status: LossStatus
          applied_rate_per_m2: number
          unit_area_m2_snapshot: number
          calculated_value: number
          charged_value: number | null
          agreement_notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          divergence_id?: string | null
          work_id?: string | null
          supplier_id?: string | null
          material_id: string
          quantity: number
          responsible_type: LossResponsibleType
          responsible_reference_id?: string | null
          reason: string
          status?: LossStatus
          applied_rate_per_m2: number
          unit_area_m2_snapshot: number
          calculated_value: number
          charged_value?: number | null
          agreement_notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          divergence_id?: string | null
          work_id?: string | null
          supplier_id?: string | null
          material_id?: string
          quantity?: number
          responsible_type?: LossResponsibleType
          responsible_reference_id?: string | null
          reason?: string
          status?: LossStatus
          applied_rate_per_m2?: number
          unit_area_m2_snapshot?: number
          calculated_value?: number
          charged_value?: number | null
          agreement_notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loss_meetings: {
        Row: {
          id: string
          work_id: string | null
          meeting_date: string
          title: string
          participants: string | null
          responsible: string | null
          decisions: string | null
          agreement: string | null
          notes: string | null
          status: LossMeetingStatus
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_id?: string | null
          meeting_date?: string
          title?: string
          participants?: string | null
          responsible?: string | null
          decisions?: string | null
          agreement?: string | null
          notes?: string | null
          status?: LossMeetingStatus
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_id?: string | null
          meeting_date?: string
          title?: string
          participants?: string | null
          responsible?: string | null
          decisions?: string | null
          agreement?: string | null
          notes?: string | null
          status?: LossMeetingStatus
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      loss_meeting_losses: {
        Row: {
          id: string
          loss_meeting_id: string
          loss_id: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loss_meeting_id: string
          loss_id: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loss_meeting_id?: string
          loss_id?: string
          notes?: string | null
          created_at?: string
        }
      }
      loss_meeting_divergences: {
        Row: {
          id: string
          loss_meeting_id: string
          divergence_id: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loss_meeting_id: string
          divergence_id: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          loss_meeting_id?: string
          divergence_id?: string
          notes?: string | null
          created_at?: string
        }
      }
      discrepancy_photos: {
        Row: {
          id: string
          divergence_id: string
          storage_path: string
          file_name: string
          file_size: number | null
          content_type: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          divergence_id: string
          storage_path: string
          file_name: string
          file_size?: number | null
          content_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          divergence_id?: string
          storage_path?: string
          file_name?: string
          file_size?: number | null
          content_type?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
      supplier_service_costs: {
        Row: {
          id: string
          supplier_id: string
          load_id: string
          conference_id: string
          service_date: string
          received_area_m2: number
          applied_rate_per_m2: number | null
          calculated_value: number | null
          status: 'CALCULADO' | 'PENDENTE_DE_TAXA' | 'RECALCULADO'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          supplier_id: string
          load_id: string
          conference_id: string
          service_date: string
          received_area_m2?: number
          applied_rate_per_m2?: number | null
          calculated_value?: number | null
          status?: 'CALCULADO' | 'PENDENTE_DE_TAXA' | 'RECALCULADO'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          supplier_id?: string
          load_id?: string
          conference_id?: string
          service_date?: string
          received_area_m2?: number
          applied_rate_per_m2?: number | null
          calculated_value?: number | null
          status?: 'CALCULADO' | 'PENDENTE_DE_TAXA' | 'RECALCULADO'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_table: string
          entity_id: string | null
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          entity_table: string
          entity_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          entity_table?: string
          entity_id?: string | null
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          created_at?: string
        }
      }
    }
  }
}
