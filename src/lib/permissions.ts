// 견적 편집 권한 판정 (클라이언트 표시용 — 실제 강제는 RLS Layer2).
// canEdit = 관리자  OR  (단계가 '정산'이 아니고 && 해당 프로젝트 담당자)
export function canEditQuote(opts: { isAdmin: boolean; isAssignee: boolean; status: string }): boolean {
  if (opts.isAdmin) return true
  return opts.status !== '정산' && opts.isAssignee
}
