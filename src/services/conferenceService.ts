import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  LoadConferenceWithDetails,
  PalletConferenceWithDetails,
  DivergenceWithDetails,
  DivergenceType,
  Material,
  LoadWithRelations,
} from '../types'
import { loadService } from './loadService'
import { materialService } from './materialService'

// Local in-memory state for fallback/sandbox mode
let localConferences: any[] = []
let localPalletConferences: any[] = []
let localPalletConferenceItems: any[] = []
let localDivergences: any[] = []
let localDiscrepancyPhotos: any[] = []

export const conferenceService = {
  /**
   * Receive a load in transit at the destination.
   * Carga: EM_TRANSITO -> RECEBIDA
   * Pallets: ENVIADO -> RECEBIDO
   * Transit stock remains in stock_in_transit_balances until conference.
   */
  async receiveLoad(loadId: string, idempotencyKey?: string): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `RCV-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_receive_load', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao receber carga:', error)
        throw new Error(error.message || 'Erro ao receber carga no destino.')
      }

      return { success: true, message: 'Carga recebida no destino com sucesso.' }
    }

    // Local fallback
    const load = await loadService.getLoadById(loadId)
    if (!load) throw new Error('Carga não encontrada.')
    if (load.status !== 'EM_TRANSITO') throw new Error('Apenas cargas em trânsito podem ser recebidas.')

    await loadService.updateLoadStatus(loadId, 'RECEBIDA')
    return { success: true, message: 'Carga recebida no destino com sucesso (simulação).' }
  },

  /**
   * Start the conference for a received load.
   * Carga: RECEBIDA -> EM_CONFERENCIA
   * Creates load_conference and pallet_conferences with expected items.
   */
  async startLoadConference(loadId: string, idempotencyKey?: string): Promise<{ success: boolean; conference_id?: string }> {
    const key = idempotencyKey || `START-CONF-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_start_load_conference', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao iniciar conferência da carga:', error)
        throw new Error(error.message || 'Erro ao iniciar conferência da carga.')
      }

      return { success: true, conference_id: data?.conference_id }
    }

    // Local fallback
    const load = await loadService.getLoadById(loadId)
    if (!load) throw new Error('Carga não encontrada.')

    await loadService.updateLoadStatus(loadId, 'EM_CONFERENCIA')

    let conf = localConferences.find((c) => c.load_id === loadId)
    if (!conf) {
      conf = {
        id: `conf-${Date.now()}`,
        load_id: loadId,
        destination_location_id: load.destination_location_id,
        status: 'EM_ANDAMENTO',
        started_at: new Date().toISOString(),
        finished_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      localConferences.push(conf)

      // Initialize pallet conferences
      const pallets = load.pallets || []
      pallets.forEach((p) => {
        const palConfId = `pal-conf-${p.id}`
        const exists = localPalletConferences.find((pc) => pc.id === palConfId)
        if (!exists) {
          localPalletConferences.push({
            id: palConfId,
            conference_id: conf.id,
            pallet_id: p.id,
            is_unexpected: false,
            unexpected_code: null,
            status: 'PENDENTE',
            started_at: null,
            finished_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

          p.items.forEach((it) => {
            localPalletConferenceItems.push({
              id: `pci-${palConfId}-${it.material_id}`,
              pallet_conference_id: palConfId,
              material_id: it.material_id,
              expected_qty: it.quantity,
              received_qty: null,
              is_checked: false,
              is_unexpected: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          })
        }
      })
    }

    return { success: true, conference_id: conf.id }
  },

  /**
   * Start individual pallet conference timer
   * Pallet: PENDENTE -> EM_ANDAMENTO
   */
  async startPalletConference(palletConferenceId: string, idempotencyKey?: string): Promise<{ success: boolean }> {
    const key = idempotencyKey || `START-PAL-${palletConferenceId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_start_pallet_conference', {
        p_pallet_conference_id: palletConferenceId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao iniciar conferência do pallet:', error)
        throw new Error(error.message || 'Erro ao iniciar conferência do pallet.')
      }

      return { success: true }
    }

    const palConf = localPalletConferences.find((pc) => pc.id === palletConferenceId)
    if (palConf) {
      palConf.status = 'EM_ANDAMENTO'
      palConf.started_at = palConf.started_at || new Date().toISOString()
      palConf.updated_at = new Date().toISOString()
    }
    return { success: true }
  },

  /**
   * Set received quantity for a pallet item.
   * ZERO is a valid physical quantity.
   */
  async setItemReceivedQty(
    palletConferenceId: string,
    materialId: string,
    receivedQty: number,
    idempotencyKey?: string
  ): Promise<{ success: boolean }> {
    const key = idempotencyKey || `QTY-${palletConferenceId}-${materialId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_set_conference_item_received_qty', {
        p_pallet_conference_id: palletConferenceId,
        p_material_id: materialId,
        p_received_qty: Math.floor(receivedQty),
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao registrar quantidade conferida:', error)
        throw new Error(error.message || 'Erro ao registrar contagem do item.')
      }

      return { success: true }
    }

    // Local fallback
    let item = localPalletConferenceItems.find(
      (it) => it.pallet_conference_id === palletConferenceId && it.material_id === materialId
    )
    if (item) {
      item.received_qty = Math.floor(receivedQty)
      item.is_checked = true
      item.updated_at = new Date().toISOString()
    } else {
      localPalletConferenceItems.push({
        id: `pci-${palletConferenceId}-${materialId}`,
        pallet_conference_id: palletConferenceId,
        material_id: materialId,
        expected_qty: 0,
        received_qty: Math.floor(receivedQty),
        is_checked: true,
        is_unexpected: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    return { success: true }
  },

  /**
   * Add unexpected material to pallet conference
   */
  async addUnexpectedItem(
    palletConferenceId: string,
    materialId: string,
    receivedQty: number,
    idempotencyKey?: string
  ): Promise<{ success: boolean }> {
    const key = idempotencyKey || `UNEXP-${palletConferenceId}-${materialId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_add_unexpected_conference_item', {
        p_pallet_conference_id: palletConferenceId,
        p_material_id: materialId,
        p_received_qty: Math.floor(receivedQty),
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao adicionar item não previsto:', error)
        throw new Error(error.message || 'Erro ao adicionar item não previsto.')
      }

      return { success: true }
    }

    return this.setItemReceivedQty(palletConferenceId, materialId, receivedQty, key)
  },

  /**
   * Add unexpected physical pallet found on truck
   */
  async addUnexpectedPallet(
    loadId: string,
    code: string,
    notes?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; pallet_conference_id?: string }> {
    const key = idempotencyKey || `UNEXP-PAL-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_add_unexpected_pallet_conference', {
        p_load_id: loadId,
        p_code: code.trim().toUpperCase(),
        p_notes: notes || '',
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao adicionar pallet não previsto:', error)
        throw new Error(error.message || 'Erro ao registrar pallet inesperado.')
      }

      return { success: true, pallet_conference_id: data?.pallet_conference_id }
    }

    const conf = localConferences.find((c) => c.load_id === loadId)
    const newId = `unexp-pal-${Date.now()}`
    localPalletConferences.push({
      id: newId,
      conference_id: conf?.id || 'conf-1',
      pallet_id: null,
      is_unexpected: true,
      unexpected_code: code.trim().toUpperCase(),
      status: 'PENDENTE',
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    return { success: true, pallet_conference_id: newId }
  },

  /**
   * Record custom divergence or pallet occurrence (e.g. PALLET_DANIFICADO, SUCATA, OUTRO)
   */
  async recordDivergence(
    palletConferenceId: string,
    divergenceType: DivergenceType,
    materialId?: string,
    expectedQty?: number,
    receivedQty?: number,
    notes?: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; divergence_id?: string }> {
    const key = idempotencyKey || `DIV-${palletConferenceId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_record_pallet_divergence', {
        p_pallet_conference_id: palletConferenceId,
        p_divergence_type: divergenceType,
        p_material_id: materialId || null,
        p_expected_qty: expectedQty !== undefined ? expectedQty : null,
        p_received_qty: receivedQty !== undefined ? receivedQty : null,
        p_notes: notes || '',
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao registrar divergência:', error)
        throw new Error(error.message || 'Erro ao registrar ocorrência/divergência.')
      }

      return { success: true, divergence_id: data?.divergence_id }
    }

    const divId = `div-${Date.now()}`
    localDivergences.push({
      id: divId,
      pallet_conference_id: palletConferenceId,
      type: divergenceType,
      material_id: materialId || null,
      expected_qty: expectedQty || null,
      received_qty: receivedQty || null,
      difference_qty: expectedQty !== undefined && receivedQty !== undefined ? Math.abs(receivedQty - expectedQty) : null,
      status: 'PENDENTE',
      notes,
      created_at: new Date().toISOString(),
    })
    return { success: true, divergence_id: divId }
  },

  /**
   * Finalize Pallet Conference:
   * Validates all items checked (received_qty IS NOT NULL)
   * Debits stock_in_transit_balances and Credits stock_balances at destination.
   * Transitions pallet to CONFERIDO, pallet_conference to CONCLUIDA.
   */
  async finalizePalletConference(
    palletConferenceId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `FIN-PAL-${palletConferenceId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_finalize_pallet_conference', {
        p_pallet_conference_id: palletConferenceId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao finalizar conferência do pallet:', error)
        throw new Error(error.message || 'Erro ao finalizar conferência do pallet.')
      }

      return { success: true, message: 'Pallet conferido e estoque físico movimentado com sucesso.' }
    }

    const palConf = localPalletConferences.find((pc) => pc.id === palletConferenceId)
    if (!palConf) throw new Error('Conferência de pallet não encontrada.')
    if (palConf.status === 'CONCLUIDA') throw new Error('Este pallet já foi concluído anteriormente.')

    const items = localPalletConferenceItems.filter((it) => it.pallet_conference_id === palletConferenceId)
    const unconferred = items.filter((it) => !it.is_checked || it.received_qty === null)
    if (unconferred.length > 0) {
      throw new Error(`Não é permitido finalizar o pallet: existem ${unconferred.length} item(ns) ainda não conferidos.`)
    }

    palConf.status = 'CONCLUIDA'
    palConf.finished_at = new Date().toISOString()
    palConf.updated_at = new Date().toISOString()

    return { success: true, message: 'Pallet conferido com sucesso (simulação).' }
  },

  /**
   * Finalize Load Conference:
   * Validates all pallet conferences are CONCLUIDA.
   * Transitions load_conference to CONCLUIDA, load to CONFERIDA.
   */
  async finalizeLoadConference(
    loadId: string,
    idempotencyKey?: string
  ): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `FIN-CONF-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_finalize_load_conference', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao finalizar conferência da carga:', error)
        throw new Error(error.message || 'Erro ao finalizar conferência geral da carga.')
      }

      return { success: true, message: 'Conferência da carga finalizada com sucesso. Status alterado para CONFERIDA.' }
    }

    await loadService.updateLoadStatus(loadId, 'CONFERIDA')
    const conf = localConferences.find((c) => c.load_id === loadId)
    if (conf) {
      conf.status = 'CONCLUIDA'
      conf.finished_at = new Date().toISOString()
    }
    return { success: true, message: 'Conferência finalizada com sucesso (simulação).' }
  },

  /**
   * Administrative finalization:
   * Transitions load from CONFERIDA to FINALIZADA.
   */
  async finalizeLoad(loadId: string, idempotencyKey?: string): Promise<{ success: boolean; message?: string }> {
    const key = idempotencyKey || `ADMIN-FIN-${loadId}-${Date.now()}`

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('fn_finalize_load', {
        p_load_id: loadId,
        p_idempotency_key: key,
      })

      if (error) {
        console.error('Erro ao finalizar carga administrativamente:', error)
        throw new Error(error.message || 'Erro ao finalizar carga administrativamente.')
      }

      return { success: true, message: 'Carga finalizada administrativamente.' }
    }

    await loadService.updateLoadStatus(loadId, 'FINALIZADA')
    return { success: true, message: 'Carga finalizada com sucesso (simulação).' }
  },

  /**
   * Get full conference details for a load
   */
  async getLoadConference(loadId: string): Promise<LoadConferenceWithDetails | null> {
    if (isSupabaseConfigured) {
      const { data: conf, error } = await supabase
        .from('load_conferences')
        .select(`
          *,
          destination_location:locations(*),
          starter:profiles!load_conferences_started_by_fkey(*),
          finisher:profiles!load_conferences_finished_by_fkey(*)
        `)
        .eq('load_id', loadId)
        .maybeSingle()

      if (error || !conf) {
        return null
      }

      const load = await loadService.getLoadById(loadId)

      // Fetch pallet conferences
      const { data: palletConfs } = await supabase
        .from('pallet_conferences')
        .select(`
          *,
          pallet:demobilization_pallets(*)
        `)
        .eq('conference_id', conf.id)
        .order('created_at', { ascending: true })

      // Fetch items and divergences
      const enrichedPallets: PalletConferenceWithDetails[] = await Promise.all(
        (palletConfs || []).map(async (pc: any) => {
          const { data: items } = await supabase
            .from('pallet_conference_items')
            .select(`
              *,
              material:materials(*)
            `)
            .eq('pallet_conference_id', pc.id)
            .order('created_at', { ascending: true })

          const { data: divergences } = await supabase
            .from('divergences')
            .select(`
              *,
              material:materials(*),
              photos:discrepancy_photos(*)
            `)
            .eq('pallet_conference_id', pc.id)

          let total_expected_pieces = 0
          let total_received_pieces = 0
          let total_missing_pieces = 0
          let total_surplus_pieces = 0

          ;(items || []).forEach((item: any) => {
            const exp = Number(item.expected_qty || 0)
            const rec = item.received_qty !== null ? Number(item.received_qty) : null

            total_expected_pieces += exp
            if (rec !== null) {
              total_received_pieces += rec
              if (rec < exp) {
                total_missing_pieces += exp - rec
              } else if (rec > exp) {
                total_surplus_pieces += rec - exp
              }
            }
          })

          return {
            ...pc,
            items: items || [],
            divergences: divergences || [],
            total_expected_pieces,
            total_received_pieces,
            total_missing_pieces,
            total_surplus_pieces,
          }
        })
      )

      // Fetch load-level divergences
      const { data: loadDivergences } = await supabase
        .from('divergences')
        .select(`
          *,
          material:materials(*),
          pallet:demobilization_pallets(*),
          creator:profiles(*),
          photos:discrepancy_photos(*)
        `)
        .eq('load_id', loadId)

      return {
        ...conf,
        load: load || undefined,
        pallet_conferences: enrichedPallets,
        divergences: (loadDivergences as any) || [],
      }
    }

    // Local fallback
    const conf = localConferences.find((c) => c.load_id === loadId)
    if (!conf) return null

    const load = await loadService.getLoadById(loadId)
    const materials = await materialService.listMaterials()

    const palletConfs = localPalletConferences
      .filter((pc) => pc.conference_id === conf.id)
      .map((pc) => {
        const items = localPalletConferenceItems
          .filter((it) => it.pallet_conference_id === pc.id)
          .map((it) => ({
            ...it,
            material: materials.find((m) => m.id === it.material_id) || {
              id: it.material_id,
              code: 'MAT',
              name: 'Material',
              unit_area_m2: 1,
            },
          }))

        const divergences = localDivergences.filter((d) => d.pallet_conference_id === pc.id)

        let total_expected_pieces = 0
        let total_received_pieces = 0
        let total_missing_pieces = 0
        let total_surplus_pieces = 0

        items.forEach((item: any) => {
          const exp = Number(item.expected_qty || 0)
          const rec = item.received_qty !== null ? Number(item.received_qty) : null

          total_expected_pieces += exp
          if (rec !== null) {
            total_received_pieces += rec
            if (rec < exp) {
              total_missing_pieces += exp - rec
            } else if (rec > exp) {
              total_surplus_pieces += rec - exp
            }
          }
        })

        return {
          ...pc,
          items,
          divergences,
          total_expected_pieces,
          total_received_pieces,
          total_missing_pieces,
          total_surplus_pieces,
        }
      })

    return {
      ...conf,
      load: load || undefined,
      pallet_conferences: palletConfs,
      divergences: localDivergences.filter((d) => d.load_id === loadId),
    }
  },

  /**
   * Upload discrepancy photo to private bucket discrepancy-photos
   */
  async uploadDiscrepancyPhoto(
    divergenceId: string,
    file: File
  ): Promise<{ success: boolean; photo_url?: string; error?: string }> {
    if (isSupabaseConfigured) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${divergenceId}/${Date.now()}.${fileExt}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('discrepancy-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Erro ao enviar foto para storage:', uploadError)
          throw uploadError
        }

        // Insert into discrepancy_photos table
        const { data: photoRec, error: dbError } = await supabase
          .from('discrepancy_photos')
          .insert({
            divergence_id: divergenceId,
            storage_path: uploadData.path,
            file_name: file.name,
            file_size: file.size,
            content_type: file.type,
          })
          .select()
          .single()

        if (dbError) {
          console.error('Erro ao registrar foto no banco:', dbError)
        }

        // Create signed URL for display (private bucket)
        const { data: signedData } = await supabase.storage
          .from('discrepancy-photos')
          .createSignedUrl(uploadData.path, 3600)

        return {
          success: true,
          photo_url: signedData?.signedUrl,
        }
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Falha ao salvar foto.',
        }
      }
    }

    // Local fallback: create object URL
    const localUrl = URL.createObjectURL(file)
    localDiscrepancyPhotos.push({
      id: `photo-${Date.now()}`,
      divergence_id: divergenceId,
      storage_path: localUrl,
      file_name: file.name,
      file_size: file.size,
      content_type: file.type,
    })

    return { success: true, photo_url: localUrl }
  },

  /**
   * Get signed photo URL for viewing private photo
   */
  async getSignedPhotoUrl(storagePath: string): Promise<string | null> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.storage
        .from('discrepancy-photos')
        .createSignedUrl(storagePath, 3600)

      if (error || !data?.signedUrl) return null
      return data.signedUrl
    }
    return storagePath
  },
}
