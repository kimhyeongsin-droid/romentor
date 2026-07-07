import { WORK_TYPE_COLOR, type WorkType } from '@/types'

// 마감재 대상 공종 화이트리스트 (스켈레톤 자동생성 대상)
export const FINISH_WORK_TYPES: WorkType[] = [
  '타일', '도배', '필름', '도장', '바닥', '욕실도기',
  '조명', '가구', '금속', '창호', '도어', '유리실리콘',
]

// 상세 화면에서 수동으로 추가할 수 있는 추천 공종
// (견적 taxonomy 밖 · 시딩 대상 아님 · 교차검색엔 포함)
export const RECOMMENDED_EXTRA_WORK_TYPES: string[] = [
  '수전', '도기', '손잡이', '조색실리콘', '공조',
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
  work_type: string          // 화이트리스트 + 추가 공종 모두 허용 (컬럼은 text)
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

// 공종 문자열로 안전 조회 (화이트리스트 밖이면 가변 칸 없음)
export function finishAttrFields(wt: string): (keyof FinishAttrs)[] {
  return FINISH_ATTR_FIELDS[wt as WorkType] ?? []
}

// 공종 색상 (화이트리스트 밖이면 회색 fallback)
export function finishWtColor(wt: string): string {
  return (WORK_TYPE_COLOR as Record<string, string>)[wt] ?? 'bg-gray-100 text-gray-600'
}
