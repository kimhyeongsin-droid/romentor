import type { WorkType } from '@/types'

// 마감재 대상 공종 화이트리스트 (스켈레톤 자동생성 대상)
// 제외: 가설공사·철거·마루철거·설비·전기배선·목공·설계비용·공조·홈스타일링·기타
export const FINISH_WORK_TYPES: WorkType[] = [
  '타일', '도배', '필름', '도장', '바닥', '욕실도기',
  '조명', '가구', '금속', '창호', '도어', '유리실리콘',
]

export interface FinishAttrs {
  spec?: string              // 규격
  quantity?: string          // 수량
  unit?: string              // 단위
  grout?: string             // 줄눈 (타일)
  matching_material?: string // 매칭자재 (필름/유리실리콘)
}

export interface ProjectFinish {
  id: string
  quote_id: string
  work_type: WorkType
  location: string | null
  brand: string | null
  vendor: string | null          // 발주처 (내부전용)
  product_name: string | null
  color_code: string | null
  installed_at: string | null    // 시공일
  warranty_until: string | null  // 보증만료
  note: string | null
  customer_visible: boolean
  attrs: FinishAttrs
  sort_order: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// 공종별로 노출할 가변 필드 (UI 칸 구성)
export const FINISH_ATTR_FIELDS: Partial<Record<WorkType, (keyof FinishAttrs)[]>> = {
  '타일': ['spec', 'quantity', 'unit', 'grout'],
  '바닥': ['spec', 'quantity', 'unit'],
  '욕실도기': ['spec', 'quantity', 'unit'],
  '가구': ['spec', 'quantity', 'unit'],
  '금속': ['spec', 'quantity'],
  '창호': ['spec', 'quantity'],
  '도어': ['spec', 'quantity'],
  '조명': ['quantity', 'unit'],
  '필름': ['matching_material'],
  '유리실리콘': ['matching_material'],
  '도배': [],
  '도장': [],
}

export const ATTR_LABEL: Record<keyof FinishAttrs, string> = {
  spec: '규격',
  quantity: '수량',
  unit: '단위',
  grout: '줄눈',
  matching_material: '매칭자재',
}
