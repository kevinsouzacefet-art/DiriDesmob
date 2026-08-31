import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { UserSystemRole, LocationType, WorkStatus } from '../types/database.types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatAreaM2(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0,00 m²'
  return `${formatNumber(value, 2)} m²`
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  } catch {
    return dateString
  }
}

export function getRoleLabel(role: UserSystemRole | string | undefined): string {
  switch (role) {
    case 'ADMINISTRADOR':
      return 'Administrador do Sistema'
    case 'ANALISTA':
      return 'Analista de Operações'
    case 'OBRA_SUPERVISOR':
      return 'Supervisor de Obra'
    case 'OBRA_CONFERENTE':
      return 'Conferente de Obra'
    case 'FORNECEDOR_SUPERVISOR':
      return 'Supervisor de Fornecedor'
    case 'FORNECEDOR_CONFERENTE':
      return 'Conferente de Fornecedor'
    case 'GALPAO_CONFERENTE':
      return 'Conferente de Galpão'
    default:
      return role || 'Usuário'
  }
}

export function getLocationTypeLabel(type: LocationType | string | undefined): string {
  switch (type) {
    case 'GALPAO':
      return 'Galpão Central'
    case 'OBRA':
      return 'Obra em Campo'
    case 'FORNECEDOR':
      return 'Fornecedor de Fôrmas'
    default:
      return type || 'Localização'
  }
}

export function getWorkStatusLabel(status: WorkStatus | string | undefined): { label: string; variant: 'info' | 'success' | 'warning' | 'neutral' | 'danger' } {
  switch (status) {
    case 'PLANEJADA':
      return { label: 'Planejada', variant: 'neutral' }
    case 'EM_ANDAMENTO':
      return { label: 'Em Andamento', variant: 'info' }
    case 'DESMOBILIZACAO_INICIADA':
      return { label: 'Desmobilização Iniciada', variant: 'warning' }
    case 'CONCLUIDA':
      return { label: 'Concluída', variant: 'success' }
    case 'PARALISADA':
      return { label: 'Paralisada', variant: 'danger' }
    default:
      return { label: status || 'Desconhecido', variant: 'neutral' }
  }
}
