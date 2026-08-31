import * as XLSX from 'xlsx'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  Mobilization,
  MobilizationWithRelations,
  MobilizationImportBatch,
  StagingParsedRow,
  BatchPreviewSummary,
  Location,
  Material,
} from '../types'
import { locationService } from './locationService'
import { materialService } from './materialService'

// Local in-memory state for fallback/demo mode
const initialFallbackMobilizations: MobilizationWithRelations[] = [
  {
    id: 'mob-001',
    code: 'MOB-20250115-1001',
    destination_work_id: 'a1111111-1111-1111-1111-111111111111',
    origin_location_id: 'b2222222-2222-2222-2222-222222222221',
    status: 'CONCLUIDA',
    import_batch_id: 'batch-001',
    total_pieces: 185,
    total_pallets: 3,
    total_area_m2: 182.4,
    notes: 'Mobilização inicial de painéis e escoras para estrutura',
    created_by: '00000000-0000-0000-0000-000000000001',
    created_at: '2025-01-15T09:30:00Z',
    updated_at: '2025-01-15T09:30:00Z',
    destination_work: {
      id: 'a1111111-1111-1111-1111-111111111111',
      code: 'OBRA-RES-PARK',
      name: 'Residencial Parque das Flores',
      type: 'OBRA',
      city: 'São Paulo',
      state: 'SP',
      is_active: true,
      created_at: '2025-01-10T08:00:00Z',
      updated_at: '2025-01-10T08:00:00Z',
    },
    origin_location: {
      id: 'b2222222-2222-2222-2222-222222222221',
      code: 'GALP-CENTRAL',
      name: 'Galpão Logístico Central',
      type: 'GALPAO',
      city: 'Guarulhos',
      state: 'SP',
      is_active: true,
      created_at: '2025-01-10T08:00:00Z',
      updated_at: '2025-01-10T08:00:00Z',
    },
    pallets: [
      {
        id: 'pal-mob-01',
        mobilization_id: 'mob-001',
        pallet_number: 'Pallet-01',
        created_at: '2025-01-15T09:30:00Z',
        totalPieces: 70,
        totalAreaM2: 93.6,
        items: [
          {
            id: 'item-mob-01',
            mobilization_pallet_id: 'pal-mob-01',
            material_id: 'd4444444-4444-4444-4444-444444444441',
            quantity: 50,
            created_at: '2025-01-15T09:30:00Z',
            material: {
              id: 'd4444444-4444-4444-4444-444444444441',
              code: 'PAN-2400-600',
              name: 'Painel Fôrma Metálica 2400x600',
              width_mm: 600,
              height_mm: 2400,
              unit_area_m2: 1.44,
              unit: 'UN',
              is_active: true,
              created_at: '2025-01-10T08:00:00Z',
              updated_at: '2025-01-10T08:00:00Z',
            },
          },
          {
            id: 'item-mob-02',
            mobilization_pallet_id: 'pal-mob-01',
            material_id: 'd4444444-4444-4444-4444-444444444442',
            quantity: 20,
            created_at: '2025-01-15T09:30:00Z',
            material: {
              id: 'd4444444-4444-4444-4444-444444444442',
              code: 'PAN-2400-450',
              name: 'Painel Fôrma Metálica 2400x450',
              width_mm: 450,
              height_mm: 2400,
              unit_area_m2: 1.08,
              unit: 'UN',
              is_active: true,
              created_at: '2025-01-10T08:00:00Z',
              updated_at: '2025-01-10T08:00:00Z',
            },
          },
        ],
      },
      {
        id: 'pal-mob-02',
        mobilization_id: 'mob-001',
        pallet_number: 'Pallet-02',
        created_at: '2025-01-15T09:30:00Z',
        totalPieces: 35,
        totalAreaM2: 25.2,
        items: [
          {
            id: 'item-mob-03',
            mobilization_pallet_id: 'pal-mob-02',
            material_id: 'd4444444-4444-4444-4444-444444444444',
            quantity: 35,
            created_at: '2025-01-15T09:30:00Z',
            material: {
              id: 'd4444444-4444-4444-4444-444444444444',
              code: 'PAN-1200-600',
              name: 'Painel Fôrma Metálica 1200x600',
              width_mm: 600,
              height_mm: 1200,
              unit_area_m2: 0.72,
              unit: 'UN',
              is_active: true,
              created_at: '2025-01-10T08:00:00Z',
              updated_at: '2025-01-10T08:00:00Z',
            },
          },
        ],
      },
      {
        id: 'pal-mob-03',
        mobilization_id: 'mob-001',
        pallet_number: 'Pallet-03',
        created_at: '2025-01-15T09:30:00Z',
        totalPieces: 80,
        totalAreaM2: 63.6,
        items: [
          {
            id: 'item-mob-04',
            mobilization_pallet_id: 'pal-mob-03',
            material_id: 'd4444444-4444-4444-4444-444444444445',
            quantity: 40,
            created_at: '2025-01-15T09:30:00Z',
            material: {
              id: 'd4444444-4444-4444-4444-444444444445',
              code: 'VIG-ALU-2400',
              name: 'Viga de Alumínio Primária 2400mm',
              width_mm: 150,
              height_mm: 2400,
              unit_area_m2: 0.36,
              unit: 'UN',
              is_active: true,
              created_at: '2025-01-10T08:00:00Z',
              updated_at: '2025-01-10T08:00:00Z',
            },
          },
          {
            id: 'item-mob-05',
            mobilization_pallet_id: 'pal-mob-03',
            material_id: 'd4444444-4444-4444-4444-444444444446',
            quantity: 40,
            created_at: '2025-01-15T09:30:00Z',
            material: {
              id: 'd4444444-4444-4444-4444-444444444446',
              code: 'ESC-MET-3500',
              name: 'Escora Telescópica Pesada 3.50m',
              width_mm: 120,
              height_mm: 3500,
              unit_area_m2: 0.42,
              unit: 'UN',
              is_active: true,
              created_at: '2025-01-10T08:00:00Z',
              updated_at: '2025-01-10T08:00:00Z',
            },
          },
        ],
      },
    ],
  },
]

let localBatches: MobilizationImportBatch[] = []
let localStagingRows: Record<string, StagingParsedRow[]> = {}

function getStoredMobilizations(): MobilizationWithRelations[] {
  try {
    const stored = localStorage.getItem('diridesmob_custom_mobilizations')
    return stored ? JSON.parse(stored) : initialFallbackMobilizations
  } catch {
    return initialFallbackMobilizations
  }
}

function saveStoredMobilizations(list: MobilizationWithRelations[]): void {
  try {
    localStorage.setItem('diridesmob_custom_mobilizations', JSON.stringify(list))
  } catch (err) {
    console.warn('Could not save local mobilizations:', err)
  }
}

export const mobilizationService = {
  /**
   * Calculates SHA-256 hash of a file for idempotency and duplicate checking
   */
  async calculateFileHash(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  },

  /**
   * Checks if this exact file hash has already been committed
   */
  async checkDuplicateFileHash(fileHash: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('mobilization_import_batches')
          .select('id, status')
          .eq('file_hash', fileHash)
          .eq('status', 'COMMITTED')
          .limit(1)

        if (!error && data) {
          return data.length > 0
        }
        if (error) {
          console.warn('Erro ao verificar hash de duplicidade via Supabase:', error.message)
        }
      } catch (err: any) {
        console.warn('Erro ao verificar hash de duplicidade (fallback):', err?.message)
      }
    }

    return localBatches.some((b) => b.file_hash === fileHash && b.status === 'COMMITTED')
  },

  /**
   * Parses Excel file, validates every line against catalog and locations, and calculates metrics
   */
  async parseAndValidateExcel(
    file: File,
    forcedWorkId?: string
  ): Promise<{
    summary: BatchPreviewSummary
    rows: StagingParsedRow[]
    isDuplicateFile: boolean
  }> {
    const fileHash = await this.calculateFileHash(file)
    const isDuplicateFile = await this.checkDuplicateFileHash(fileHash)

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      throw new Error('O arquivo Excel está vazio ou não possui planilhas válidas.')
    }

    const worksheet = workbook.Sheets[firstSheetName]
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    if (rawData.length < 2) {
      throw new Error('A planilha deve conter o cabeçalho e pelo menos 1 linha de dados.')
    }

    // 1. Verify Mandatory Headers (Exact columns)
    const headerRow: string[] = (rawData[0] || []).map((h: any) =>
      String(h).trim().toLowerCase()
    )

    const requiredHeaders = ['obra', 'origem', 'destino', 'pallet', 'material', 'quantidade']
    const missingHeaders = requiredHeaders.filter((req) => !headerRow.includes(req))

    if (missingHeaders.length > 0) {
      throw new Error(
        `Colunas obrigatórias ausentes no Excel: ${missingHeaders.map((h) => h.toUpperCase()).join(', ')}. As colunas obrigatórias são: Obra, Origem, Destino, Pallet, Material, Quantidade.`
      )
    }

    const colIndex = {
      obra: headerRow.indexOf('obra'),
      origem: headerRow.indexOf('origem'),
      destino: headerRow.indexOf('destino'),
      pallet: headerRow.indexOf('pallet'),
      material: headerRow.indexOf('material'),
      quantidade: headerRow.indexOf('quantidade'),
    }

    // 2. Fetch Reference Catalogs (Locations and Materials)
    const [locations, materials] = await Promise.all([
      locationService.listLocations(),
      materialService.listMaterials(),
    ])

    const locationCodeMap = new Map<string, Location>()
    locations.forEach((loc) => {
      locationCodeMap.set(loc.code.trim().toUpperCase(), loc)
    })

    const materialCodeMap = new Map<string, Material>()
    materials.forEach((mat) => {
      materialCodeMap.set(mat.code.trim().toUpperCase(), mat)
    })

    // 3. Process Each Row
    const parsedRows: StagingParsedRow[] = []
    const duplicateTracker = new Map<string, number>()
    const distinctPallets = new Set<string>()
    let totalPieces = 0
    let totalAreaM2 = 0
    let validRowsCount = 0
    let invalidRowsCount = 0

    let detectedWork: Location | null = null

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i]
      if (!row || row.every((val: any) => val === '' || val === null || val === undefined)) {
        continue // Ignore completely empty rows
      }

      const rowNumber = i + 1
      const rawWork = String(row[colIndex.obra] || '').trim()
      const rawOrigin = String(row[colIndex.origem] || '').trim()
      const rawDestination = String(row[colIndex.destino] || '').trim()
      const rawPallet = String(row[colIndex.pallet] || '').trim()
      const rawMaterial = String(row[colIndex.material] || '').trim()
      const rawQtyStr = String(row[colIndex.quantidade] || '').trim()

      const validationErrors: { field: string; message: string }[] = []

      // Field Validations
      if (!rawWork) {
        validationErrors.push({ field: 'Obra', message: 'O código da obra é obrigatório.' })
      }
      if (!rawOrigin) {
        validationErrors.push({ field: 'Origem', message: 'A localização de origem é obrigatória.' })
      }
      if (!rawDestination) {
        validationErrors.push({ field: 'Destino', message: 'A localização de destino é obrigatória.' })
      }
      if (!rawPallet) {
        validationErrors.push({ field: 'Pallet', message: 'A identificação do pallet é obrigatória.' })
      }
      if (!rawMaterial) {
        validationErrors.push({ field: 'Material', message: 'O código do material é obrigatório.' })
      }

      // Quantity validation
      const parsedQty = Number(rawQtyStr)
      if (
        !rawQtyStr ||
        isNaN(parsedQty) ||
        !Number.isInteger(parsedQty) ||
        parsedQty <= 0
      ) {
        validationErrors.push({
          field: 'Quantidade',
          message: 'Quantidade deve ser um número inteiro maior que zero.',
        })
      }

      // Catalog Resolution
      const resolvedWork = locationCodeMap.get(rawWork.toUpperCase())
      if (rawWork && !resolvedWork) {
        validationErrors.push({
          field: 'Obra',
          message: `Obra '${rawWork}' não encontrada no cadastro de localizações.`,
        })
      } else if (resolvedWork && resolvedWork.type !== 'OBRA') {
        validationErrors.push({
          field: 'Obra',
          message: `Localização '${rawWork}' não é do tipo OBRA.`,
        })
      } else if (resolvedWork && !resolvedWork.is_active) {
        validationErrors.push({
          field: 'Obra',
          message: `Obra '${rawWork}' está inativa.`,
        })
      }

      if (resolvedWork && !detectedWork) {
        detectedWork = resolvedWork
      }

      const resolvedOrigin = locationCodeMap.get(rawOrigin.toUpperCase())
      if (rawOrigin && !resolvedOrigin) {
        validationErrors.push({
          field: 'Origem',
          message: `Origem '${rawOrigin}' não encontrada no cadastro.`,
        })
      } else if (resolvedOrigin && !resolvedOrigin.is_active) {
        validationErrors.push({
          field: 'Origem',
          message: `Origem '${rawOrigin}' está inativa.`,
        })
      }

      const resolvedDest = locationCodeMap.get(rawDestination.toUpperCase())
      if (rawDestination && !resolvedDest) {
        validationErrors.push({
          field: 'Destino',
          message: `Destino '${rawDestination}' não encontrado no cadastro.`,
        })
      } else if (resolvedDest && resolvedWork && resolvedDest.id !== resolvedWork.id) {
        validationErrors.push({
          field: 'Destino',
          message: `Destino '${rawDestination}' é incoerente com a Obra receptora '${rawWork}'.`,
        })
      }

      const resolvedMaterial = materialCodeMap.get(rawMaterial.toUpperCase())
      if (rawMaterial && !resolvedMaterial) {
        validationErrors.push({
          field: 'Material',
          message: `Material '${rawMaterial}' não encontrado no catálogo.`,
        })
      } else if (resolvedMaterial && !resolvedMaterial.is_active) {
        validationErrors.push({
          field: 'Material',
          message: `Material '${rawMaterial}' está inativo no catálogo.`,
        })
      }

      // Row Duplicity Check in same file
      const rowFingerprint = `${rawWork.toUpperCase()}|${rawOrigin.toUpperCase()}|${rawDestination.toUpperCase()}|${rawPallet.toUpperCase()}|${rawMaterial.toUpperCase()}|${rawQtyStr}`
      const dupCount = (duplicateTracker.get(rowFingerprint) || 0) + 1
      duplicateTracker.set(rowFingerprint, dupCount)
      const isDuplicateWarning = dupCount > 1

      const isValid = validationErrors.length === 0
      let calculatedAreaM2 = 0

      if (isValid && resolvedMaterial && parsedQty > 0) {
        calculatedAreaM2 = Number(
          ((resolvedMaterial.unit_area_m2 || 0) * parsedQty).toFixed(4)
        )
        totalPieces += parsedQty
        totalAreaM2 += calculatedAreaM2
        if (rawPallet) {
          distinctPallets.add(rawPallet.toUpperCase())
        }
        validRowsCount++
      } else {
        invalidRowsCount++
      }

      parsedRows.push({
        rowNumber,
        rawWork,
        rawOrigin,
        rawDestination,
        rawPallet,
        rawMaterial,
        rawQuantity: rawQtyStr,
        resolvedWorkId: resolvedWork?.id || null,
        resolvedOriginLocationId: resolvedOrigin?.id || null,
        resolvedDestinationLocationId: resolvedDest?.id || null,
        resolvedMaterialId: resolvedMaterial?.id || null,
        resolvedMaterial: resolvedMaterial || null,
        quantity: isValid ? parsedQty : null,
        calculatedAreaM2: isValid ? calculatedAreaM2 : null,
        isValid,
        isDuplicateWarning,
        validationErrors,
      })
    }

    const summary: BatchPreviewSummary = {
      fileName: file.name,
      fileHash,
      workCode: detectedWork?.code || '---',
      workName: detectedWork?.name || 'Múltiplas / Não definida',
      totalRows: parsedRows.length,
      validRows: validRowsCount,
      invalidRows: invalidRowsCount,
      totalPieces,
      totalPallets: distinctPallets.size,
      totalAreaM2: Number(totalAreaM2.toFixed(4)),
    }

    return {
      summary,
      rows: parsedRows,
      isDuplicateFile,
    }
  },

  /**
   * Uploads original file to Supabase Storage (if available)
   */
  async uploadFileToStorage(file: File, fileHash: string): Promise<string | null> {
    if (!isSupabaseConfigured) {
      return `local-storage/mobilization-imports/${file.name}`
    }

    try {
      const storagePath = `${Date.now()}_${fileHash.slice(0, 8)}_${file.name.replace(/\s+/g, '_')}`
      const { error } = await supabase.storage
        .from('mobilization-imports')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.warn('Falha no upload para Storage (seguindo com lote):', error.message)
        return null
      }

      return storagePath
    } catch (err) {
      console.warn('Storage upload exception:', err)
      return null
    }
  },

  /**
   * Generates a temporary signed URL to download private files from storage
   */
  async getStorageDownloadUrl(storagePath: string, expiresInSeconds: number = 300): Promise<string | null> {
    if (!isSupabaseConfigured || !storagePath || storagePath.startsWith('local-storage/')) {
      return null
    }

    try {
      const { data, error } = await supabase.storage
        .from('mobilization-imports')
        .createSignedUrl(storagePath, expiresInSeconds)

      if (error || !data?.signedUrl) {
        console.warn('Falha ao gerar URL assinada:', error?.message)
        return null
      }

      return data.signedUrl
    } catch (err) {
      console.warn('Exceção ao gerar URL assinada:', err)
      return null
    }
  },

  /**
   * Creates Staging Batch and Staging Rows in Database
   */
  async createStagingBatch(
    summary: BatchPreviewSummary,
    rows: StagingParsedRow[],
    storagePath: string | null,
    workId: string | null,
    userId: string | null
  ): Promise<MobilizationImportBatch> {
    const status = summary.invalidRows > 0 ? 'HAS_ERRORS' : 'READY_TO_COMMIT'

    if (isSupabaseConfigured) {
      try {
        // 1. Create Batch
        const { data: batch, error: batchErr } = await supabase
          .from('mobilization_import_batches')
          .insert({
            file_name: summary.fileName,
            file_hash: summary.fileHash,
            file_storage_path: storagePath,
            work_id: workId,
            uploaded_by: userId,
            status,
            total_rows: summary.totalRows,
            valid_rows: summary.validRows,
            invalid_rows: summary.invalidRows,
            total_pieces: summary.totalPieces,
            total_pallets: summary.totalPallets,
            total_area_m2: summary.totalAreaM2,
          })
          .select()
          .single()

        if (!batchErr && batch) {
          // 2. Insert Rows in Chunks of 100
          const dbRows = rows.map((r) => ({
            batch_id: batch.id,
            row_number: r.rowNumber,
            raw_work: r.rawWork,
            raw_origin: r.rawOrigin,
            raw_destination: r.rawDestination,
            raw_pallet: r.rawPallet,
            raw_material: r.rawMaterial,
            raw_quantity: r.rawQuantity,
            resolved_work_id: r.resolvedWorkId,
            resolved_origin_location_id: r.resolvedOriginLocationId,
            resolved_destination_location_id: r.resolvedDestinationLocationId,
            resolved_material_id: r.resolvedMaterialId,
            quantity: r.quantity,
            calculated_area_m2: r.calculatedAreaM2,
            is_valid: r.isValid,
            is_duplicate_warning: r.isDuplicateWarning,
            validation_errors: r.validationErrors,
          }))

          const chunkSize = 100
          for (let i = 0; i < dbRows.length; i += chunkSize) {
            const chunk = dbRows.slice(i, i + chunkSize)
            await supabase.from('mobilization_import_rows').insert(chunk)
          }

          return batch as MobilizationImportBatch
        }
        console.warn('Supabase createStagingBatch failed, using local batch:', batchErr?.message)
      } catch (err) {
        console.warn('Supabase createStagingBatch exception, using local batch:', err)
      }
    }

    // Local Fallback
    const localBatch: MobilizationImportBatch = {
      id: crypto.randomUUID(),
      file_name: summary.fileName,
      file_hash: summary.fileHash,
      file_storage_path: storagePath,
      work_id: workId,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
      status,
      total_rows: summary.totalRows,
      valid_rows: summary.validRows,
      invalid_rows: summary.invalidRows,
      total_pieces: summary.totalPieces,
      total_pallets: summary.totalPallets,
      total_area_m2: summary.totalAreaM2,
      committed_at: null,
      committed_by: null,
      mobilization_id: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    localBatches.unshift(localBatch)
    localStagingRows[localBatch.id] = rows
    return localBatch
  },

  /**
   * Commits the mobilization import via Transactional Atomic RPC
   */
  async commitImport(
    batchId: string,
    idempotencyKey?: string
  ): Promise<{
    success: boolean
    mobilization_id: string
    mobilization_code: string
    total_pieces: number
    total_pallets: number
    total_area_m2: number
  }> {
    const safeKey = idempotencyKey || crypto.randomUUID()

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('fn_commit_mobilization_import', {
          p_batch_id: batchId,
          p_idempotency_key: safeKey,
        })

        if (!error && data) {
          return data as any
        }
        console.warn('Supabase RPC fn_commit_mobilization_import failed, using local fallback:', error?.message)
      } catch (err) {
        console.warn('Supabase RPC fn_commit_mobilization_import exception, using local fallback:', err)
      }
    }

    // Local fallback for commit
    const batch = localBatches.find((b) => b.id === batchId)
    if (!batch) throw new Error('Lote não encontrado.')
    if (batch.invalid_rows > 0) throw new Error('Lote possui erros.')

    const mobId = crypto.randomUUID()
    const mobCode = `MOB-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
      1000 + Math.random() * 9000
    )}`

    batch.status = 'COMMITTED'
    batch.committed_at = new Date().toISOString()
    batch.mobilization_id = mobId

    const rows = localStagingRows[batchId] || []
    const locations = await locationService.listLocations()
    const materials = await materialService.listMaterials()

    const workLoc = locations.find((l) => l.id === batch.work_id) || locations[0]

    // Determine multiple origins vs single origin (No silent fallback)
    const originIds = Array.from(
      new Set(rows.map((r) => r.resolvedOriginLocationId).filter((id): id is string => !!id))
    )
    let originLoc: Location | null = null
    let headerOriginId: string | null = null

    if (originIds.length === 1) {
      originLoc = locations.find((l) => l.id === originIds[0]) || null
      headerOriginId = originLoc ? originLoc.id : null
    } else {
      originLoc = null
      headerOriginId = null
    }

    const distinctPalletCodes = Array.from(new Set(rows.map((r) => r.rawPallet)))
    const pallets = distinctPalletCodes.map((pCode) => {
      const pItems = rows.filter((r) => r.rawPallet === pCode)
      return {
        id: crypto.randomUUID(),
        mobilization_id: mobId,
        pallet_number: pCode,
        created_at: new Date().toISOString(),
        items: pItems.map((item) => {
          const mat = materials.find((m) => m.id === item.resolvedMaterialId) || materials[0]
          return {
            id: crypto.randomUUID(),
            mobilization_pallet_id: crypto.randomUUID(),
            material_id: mat.id,
            quantity: item.quantity || 0,
            created_at: new Date().toISOString(),
            material: mat,
          }
        }),
      }
    })

    const mobRecord: MobilizationWithRelations = {
      id: mobId,
      code: mobCode,
      destination_work_id: workLoc?.id || 'work-unknown',
      origin_location_id: headerOriginId,
      status: 'CONCLUIDA',
      import_batch_id: batchId,
      total_pieces: batch.total_pieces,
      total_pallets: batch.total_pallets,
      total_area_m2: batch.total_area_m2,
      notes: `Importação via Excel: ${batch.file_name}`,
      created_by: batch.uploaded_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      destination_work: workLoc,
      origin_location: originLoc,
      pallets,
    }

    const currentList = getStoredMobilizations()
    currentList.unshift(mobRecord)
    saveStoredMobilizations(currentList)

    return {
      success: true,
      mobilization_id: mobId,
      mobilization_code: mobCode,
      total_pieces: batch.total_pieces,
      total_pallets: batch.total_pallets,
      total_area_m2: batch.total_area_m2,
    }
  },

  /**
   * Cancels a staging batch before commit
   */
  async cancelBatch(batchId: string): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('mobilization_import_batches')
        .update({ status: 'CANCELLED' })
        .eq('id', batchId)

      if (error) {
        throw new Error(`Erro ao cancelar lote: ${error.message}`)
      }
      return
    }

    const b = localBatches.find((item) => item.id === batchId)
    if (b) b.status = 'CANCELLED'
  },

  /**
   * Retrieves all mobilization records with relations
   */
  async getMobilizations(workId?: string): Promise<MobilizationWithRelations[]> {
    if (isSupabaseConfigured) {
      let query = supabase
        .from('mobilizations')
        .select(`
          *,
          destination_work:locations!mobilizations_destination_work_id_fkey(*),
          origin_location:locations!mobilizations_origin_location_id_fkey(*),
          creator:profiles!mobilizations_created_by_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (workId) {
        query = query.eq('destination_work_id', workId)
      }

      const { data, error } = await query

      if (error) {
        console.warn('Erro ao buscar mobilizações do Supabase (usando fallback local):', error.message || error)
        const local = getStoredMobilizations()
        return workId ? local.filter((m) => m.destination_work_id === workId) : local
      }

      if (data && data.length > 0) {
        return (data || []) as any
      }

      const local = getStoredMobilizations()
      return workId ? local.filter((m) => m.destination_work_id === workId) : local
    }

    const local = getStoredMobilizations()
    if (workId) {
      return local.filter((m) => m.destination_work_id === workId)
    }
    return local
  },

  /**
   * Retrieves a single mobilization by ID with its pallets and items
   */
  async getMobilizationById(id: string): Promise<MobilizationWithRelations | null> {
    if (isSupabaseConfigured) {
      try {
        const { data: mob, error: mobErr } = await supabase
          .from('mobilizations')
          .select(`
            *,
            destination_work:locations!mobilizations_destination_work_id_fkey(*),
            origin_location:locations!mobilizations_origin_location_id_fkey(*),
            creator:profiles!mobilizations_created_by_fkey(*)
          `)
          .eq('id', id)
          .single()

        if (mobErr || !mob) {
          console.warn('Mobilização não encontrada no Supabase, consultando local:', mobErr?.message)
          return getStoredMobilizations().find((m) => m.id === id) || null
        }

        // Fetch Pallets and their items
        const { data: pallets, error: palletErr } = await supabase
          .from('mobilization_pallets')
          .select(`
            *,
            items:mobilization_items(
              *,
              material:materials(*)
            )
          `)
          .eq('mobilization_id', id)
          .order('pallet_number', { ascending: true })

        if (palletErr) {
          console.warn('Erro ao buscar pallets da mobilização:', palletErr.message)
        }

        const enrichedPallets = (pallets || []).map((p: any) => {
          let pPieces = 0
          let pArea = 0
          ;(p.items || []).forEach((item: any) => {
            const qty = Number(item.quantity || 0)
            pPieces += qty
            pArea += qty * Number(item.material?.unit_area_m2 || 0)
          })
          return {
            ...p,
            totalPieces: pPieces,
            totalAreaM2: Number(pArea.toFixed(4)),
          }
        })

        return {
          ...mob,
          pallets: enrichedPallets,
        } as MobilizationWithRelations
      } catch (err) {
        console.warn('Exceção ao buscar mobilização Supabase:', err)
        return getStoredMobilizations().find((m) => m.id === id) || null
      }
    }

    return getStoredMobilizations().find((m) => m.id === id) || null
  },

  /**
   * Downloads official standard Excel template with exact columns
   */
  downloadSampleTemplate(): void {
    const data = [
      ['Obra', 'Origem', 'Destino', 'Pallet', 'Material', 'Quantidade'],
      ['OBRA-RES-PARK', 'GALP-CENTRAL', 'OBRA-RES-PARK', 'Pallet-01', 'PAN-2400-600', 50],
      ['OBRA-RES-PARK', 'GALP-CENTRAL', 'OBRA-RES-PARK', 'Pallet-01', 'PAN-2400-450', 20],
      ['OBRA-RES-PARK', 'GALP-CENTRAL', 'OBRA-RES-PARK', 'Pallet-02', 'PAN-1200-600', 35],
      ['OBRA-RES-PARK', 'FORN-FORMAX', 'OBRA-RES-PARK', 'Pallet-03', 'VIG-ALU-2400', 40],
      ['OBRA-RES-PARK', 'FORN-FORMAX', 'OBRA-RES-PARK', 'Pallet-03', 'ESC-MET-3500', 120],
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(data)
    // Set column widths
    worksheet['!cols'] = [
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mobilizacao')

    XLSX.writeFile(workbook, 'modelo_importacao_mobilizacao_diridesmob.xlsx')
  },

  /**
   * Exports validation errors to an Excel file
   */
  exportErrorsReport(rows: StagingParsedRow[], originalFileName: string): void {
    const errorRows: any[] = [
      ['Linha', 'Pallet', 'Material', 'Quantidade', 'Campo com Erro', 'Descrição do Erro', 'Obra', 'Origem', 'Destino'],
    ]

    rows
      .filter((r) => !r.isValid)
      .forEach((r) => {
        r.validationErrors.forEach((err) => {
          errorRows.push([
            r.rowNumber,
            r.rawPallet,
            r.rawMaterial,
            r.rawQuantity,
            err.field,
            err.message,
            r.rawWork,
            r.rawOrigin,
            r.rawDestination,
          ])
        })
      })

    const worksheet = XLSX.utils.aoa_to_sheet(errorRows)
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 45 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Erros_Validacao')

    const cleanName = originalFileName.replace(/\.[^/.]+$/, '')
    XLSX.writeFile(workbook, `relatorio_erros_${cleanName}.xlsx`)
  },
}
