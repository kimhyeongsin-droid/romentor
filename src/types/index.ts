export type WorkType =
  | '설계비용'
  | '가설공사' | '철거' | '마루철거' | '설비' | '전기배선'
  | '창호' | '목공' | '도어' | '타일' | '도장'
  | '필름' | '도배' | '욕실도기' | '조명' | '바닥'
  | '가구' | '금속' | '유리실리콘' | '공조' | '홈스타일링' | '기타'

export const WORK_TYPES: WorkType[] = [
  '설계비용',
  '가설공사', '철거', '마루철거', '설비', '전기배선',
  '창호', '목공', '도어', '타일', '도장',
  '필름', '도배', '욕실도기', '조명', '바닥',
  '가구', '금속', '유리실리콘', '공조', '홈스타일링', '기타',
]

export const WORK_TYPE_COLOR: Record<WorkType, string> = {
  '설계비용':  'bg-violet-100 text-violet-700',
  '가설공사':  'bg-gray-100 text-gray-700',
  '철거':      'bg-red-100 text-red-700',
  '마루철거':  'bg-rose-100 text-rose-700',
  '설비':      'bg-blue-100 text-blue-700',
  '전기배선':  'bg-cyan-100 text-cyan-700',
  '창호':      'bg-violet-100 text-violet-700',
  '목공':      'bg-yellow-100 text-yellow-700',
  '도어':      'bg-amber-100 text-amber-700',
  '타일':      'bg-orange-100 text-orange-700',
  '도장':      'bg-green-100 text-green-700',
  '필름':      'bg-teal-100 text-teal-700',
  '도배':      'bg-lime-100 text-lime-700',
  '욕실도기':  'bg-sky-100 text-sky-700',
  '조명':      'bg-purple-100 text-purple-700',
  '바닥':      'bg-indigo-100 text-indigo-700',
  '가구':      'bg-pink-100 text-pink-700',
  '금속':      'bg-slate-100 text-slate-700',
  '유리실리콘':'bg-emerald-100 text-emerald-700',
  '공조':      'bg-fuchsia-100 text-fuchsia-700',
  '홈스타일링':'bg-rose-50 text-rose-600',
  '기타':      'bg-gray-100 text-gray-500',
}

export interface Project {
  id: string
  name: string
  client_name: string
  address: string
  area_sqm: number
  manager_name: string
  manager_phone: string
  designer_name?: string
  designer_phone?: string
  site_manager_name?: string
  site_manager_phone?: string
  note?: string
  status: 'draft' | 'active' | 'completed'
  created_at: string
  updated_at: string
}

export interface UnitPrice {
  id: string
  work_type: WorkType
  item_name: string
  unit: string
  unit_price: number
  material_unit_price: number
  labor_unit_price: number
  description: string | null
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  work_type: WorkType
  item_name: string
  unit: string
  quantity: number
  unit_price: number
  material_unit_price: number
  material_amount: number
  labor_unit_price: number
  labor_amount: number
  quote_amount: number
  execution_amount: number
  profit: number
  profit_rate: number
  note: string | null
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  project_id: string
  quote_number: string
  version: number
  total_material_amount: number
  total_labor_amount: number
  total_quote_amount: number
  total_execution_amount: number
  total_profit: number
  total_profit_rate: number
  indirect_accident_insurance: number
  indirect_employment_insurance: number
  indirect_overhead: number
  indirect_profit_margin: number
  total_indirect_cost: number
  vat_amount: number
  discount_amount: number
  final_amount: number
  status: 'draft' | 'confirmed' | 'executed'
  note: string | null
  created_at: string
  updated_at: string
  project?: Project
  items?: QuoteItem[]
}

export interface SmsAlert {
  id: string
  quote_id: string
  quote_item_id: string | null
  work_type: WorkType | null
  message: string
  recipient_phone: string
  sent_at: string
  status: 'sent' | 'failed'
}
