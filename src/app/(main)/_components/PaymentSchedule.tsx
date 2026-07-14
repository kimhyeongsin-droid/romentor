'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Plus, Trash2, CheckCircle, CreditCard, Bell, BellOff, Send, X } from 'lucide-react'

type Member = { name?: string; phone?: string; notify?: boolean }
type Recip = { name: string; phone: string; include: boolean }
type Row = {
  id: string
  label: string
  amount: number
  due_date: string | null
  status: 'pending' | 'paid'
  paid_at: string | null
  reminder_sent_at: string | null
  overdue_count: number
  sort_order: number
}

const PRESETS = ['계약금', '착수금', '중도금', '잔금']
const fmt = (n: number) => Number(n || 0).toLocaleString('ko-KR')

function firstPhone(members: Member[]): string {
  const m = (members ?? []).find(x => x && x.notify !== false && typeof x.phone === 'string' && x.phone.length > 0)
  return m?.phone ?? ''
}

export default function PaymentSchedule({ projectId }: { projectId: string }) {
  const sb = createClient()
  const { isAdmin } = usePermissions()
  const [rows, setRows] = useState<Row[]>([])
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [projName, setProjName] = useState('')
  const [clients, setClients] = useState<Member[]>([])
  const [pms, setPms] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // 발송 모달 상태
  const [sendRow, setSendRow] = useState<Row | null>(null)
  const [draft, setDraft] = useState('')
  const [recipList, setRecipList] = useState<Recip[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [{ data: proj }, { data: sched }] = await Promise.all([
        sb.from('projects').select('name, clients, pms, sms_auto_enabled').eq('id', projectId).single(),
        sb.from('payment_schedules').select('*').eq('project_id', projectId)
          .order('sort_order', { ascending: true }).order('due_date', { ascending: true }),
      ])
      setProjName(proj?.name ?? '')
      setClients(Array.isArray(proj?.clients) ? proj!.clients : [])
      setPms(Array.isArray(proj?.pms) ? proj!.pms : [])
      setAutoEnabled(proj?.sms_auto_enabled === true)
      setRows(((sched ?? []) as Row[]).map(r => ({ ...r, amount: Number(r.amount) })))
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  function buildMessage(row: Row, greetName: string): string {
    const due = row.due_date ? new Date(row.due_date + 'T00:00:00').toLocaleDateString('ko-KR') : '미정'
    const amt = fmt(row.amount)
    const contact = firstPhone(pms)
    return `[로멘토디자인스튜디오]\n안녕하세요, ${greetName || '고객'}님.\n'${projName}' ${row.label} ${amt}원의 입금 예정일은 ${due}입니다.\n입금 확인 부탁드립니다.${contact ? `\n문의: ${contact}` : ''}`
  }

  function openSend(row: Row) {
    // 수신자 초기값: 프로젝트 고객 목록(알림 ON은 체크, OFF는 해제된 채 노출)
    const init: Recip[] = (clients ?? [])
      .filter(m => m && (m.name || m.phone))
      .map(m => ({ name: m.name ?? '', phone: m.phone ?? '', include: m.notify !== false && !!m.phone }))
    const list = init.length > 0 ? init : [{ name: '', phone: '', include: true }]
    const firstName = list.find(r => r.include)?.name ?? list[0]?.name ?? ''
    setRecipList(list)
    setDraft(buildMessage(row, firstName))
    setSendRow(row)
  }

  const chosen = recipList.filter(r => r.include && r.phone.trim())

  async function doSend() {
    if (!sendRow) return
    if (chosen.length === 0) { alert('받는 사람을 한 명 이상 선택하고 전화번호를 입력하세요.'); return }
    if (!draft.trim()) { alert('메시지 내용을 입력하세요.'); return }
    setSending(true)
    try {
      const res = await fetch('/api/payment-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleId: sendRow.id,
          message: draft,
          recipients: chosen.map(r => ({ name: r.name, phone: r.phone.trim() })),
        }),
      })
      const data = await res.json()
      if (data.ok) {
        alert(data.smsConfigured === false
          ? `기록됨 (${data.sent}건). ※ 발송 설정(COOLSMS)이 없어 실제 문자는 나가지 않았습니다.`
          : `발송 완료 (${data.sent}건)`)
        setSendRow(null)
      } else {
        alert('발송 실패: ' + (data.error ?? '알 수 없는 오류'))
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  const updateRecip = (i: number, patch: Partial<Recip>) =>
    setRecipList(l => l.map((x, j) => j === i ? { ...x, ...patch } : x))

  async function toggleAuto() {
    const next = !autoEnabled
    setAutoEnabled(next)
    const { error } = await sb.from('projects').update({ sms_auto_enabled: next }).eq('id', projectId)
    if (error) { setAutoEnabled(!next); alert('설정 저장 실패: ' + error.message) }
  }

  async function addRow(label: string) {
    const now = new Date()
    const today = new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const { data, error } = await sb.from('payment_schedules').insert({
      project_id: projectId, label, amount: 0, due_date: today, sort_order: rows.length,
    }).select('*').single()
    if (error || !data) { alert('추가 실패: ' + (error?.message ?? '')); return }
    setRows(r => [...r, { ...(data as Row), amount: Number((data as Row).amount) }])
  }

  function patchLocal(id: string, patch: Partial<Row>) {
    setRows(r => r.map(x => x.id === id ? { ...x, ...patch } : x))
  }

  async function persist(id: string, patch: Partial<Row>) {
    const { error } = await sb.from('payment_schedules').update(patch).eq('id', id)
    if (error) alert('저장 실패: ' + error.message)
  }

  async function togglePaid(row: Row) {
    const paid = row.status !== 'paid'
    const patch = { status: paid ? 'paid' : 'pending', paid_at: paid ? new Date().toISOString() : null } as Partial<Row>
    patchLocal(row.id, patch)
    await persist(row.id, patch)
  }

  async function remove(id: string) {
    if (!confirm('이 항목을 삭제할까요?')) return
    setRows(r => r.filter(x => x.id !== id))
    const { error } = await sb.from('payment_schedules').delete().eq('id', id)
    if (error) alert('삭제 실패: ' + error.message)
  }

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const paidSum = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0)

  if (loading) return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-blue-500" />
          <span className="text-sm font-bold text-gray-900">입금 일정 · 문자 발송</span>
        </div>
        <button
          onClick={toggleAuto}
          title={autoEnabled ? '이 프로젝트 자동발송 ON (클릭 시 OFF)' : '이 프로젝트 자동발송 OFF (클릭 시 ON)'}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
            autoEnabled ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {autoEnabled ? <Bell size={13} /> : <BellOff size={13} />}
          자동발송 {autoEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-3">
        각 항목의 <span className="text-gray-500 font-medium">발송</span> 버튼으로 고객에게 직접 안내 문자를 보냅니다.
        (문자 발송은 <span className="text-gray-500">관리자</span>만 가능 · 자동 발송은 기본 꺼짐)
      </p>

      {/* 프리셋 추가 */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {PRESETS.map(p => (
          <button key={p} onClick={() => addRow(p)}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
            + {p}
          </button>
        ))}
        <button onClick={() => addRow('기타')}
          className="text-xs px-2.5 py-1 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors flex items-center gap-1">
          <Plus size={12} /> 직접 추가
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-6 border border-dashed border-gray-200 rounded-lg">
          등록된 입금 항목이 없습니다. 위 버튼으로 계약금/착수금 등을 추가하세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium py-2 pl-1">항목</th>
                <th className="text-right font-medium py-2">금액(원)</th>
                <th className="text-left font-medium py-2 pl-3">예정일</th>
                <th className="text-center font-medium py-2">상태</th>
                <th className="text-center font-medium py-2">문자</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(row => {
                const paid = row.status === 'paid'
                return (
                  <tr key={row.id} className={paid ? 'bg-green-50/40' : ''}>
                    <td className="py-2 pl-1">
                      <input
                        value={row.label}
                        onChange={e => patchLocal(row.id, { label: e.target.value })}
                        onBlur={e => persist(row.id, { label: e.target.value })}
                        className="w-24 border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 text-sm focus:outline-none"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <input
                        inputMode="numeric"
                        value={row.amount ? fmt(row.amount) : ''}
                        onChange={e => {
                          const n = Number(e.target.value.replace(/[^0-9]/g, '')) || 0
                          patchLocal(row.id, { amount: n })
                        }}
                        onBlur={() => persist(row.id, { amount: row.amount })}
                        placeholder="0"
                        className="w-28 text-right border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 text-sm focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pl-3">
                      <input
                        type="date"
                        value={row.due_date ?? ''}
                        onChange={e => { patchLocal(row.id, { due_date: e.target.value }); persist(row.id, { due_date: e.target.value }) }}
                        className="border border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 text-xs focus:outline-none text-gray-700"
                      />
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => togglePaid(row)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                          paid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {paid ? <><CheckCircle size={12} /> 입금완료</> : <>미입금</>}
                      </button>
                    </td>
                    <td className="py-2 text-center">
                      {isAdmin ? (
                        <button
                          onClick={() => openSend(row)}
                          title="고객에게 안내 문자 보내기"
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                        >
                          <Send size={12} /> 발송
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-300" title="문자 발송은 관리자만 가능합니다">관리자 전용</span>
                      )}
                    </td>
                    <td className="py-2 text-right pr-1">
                      <button onClick={() => remove(row.id)}
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 text-xs">
                <td className="py-2 pl-1 text-gray-500 font-medium">합계</td>
                <td className="py-2 text-right font-bold text-gray-900">{fmt(total)}</td>
                <td colSpan={4} className="py-2 pl-3 text-gray-400">
                  입금완료 {fmt(paidSum)}원 · 잔여 {fmt(total - paidSum)}원
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 발송 미리보기 모달 */}
      {sendRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !sending && setSendRow(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">문자 발송 — {sendRow.label}</h3>
              <button onClick={() => !sending && setSendRow(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            {/* 받는 사람 (수정 가능) */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">받는 사람 (체크한 사람에게 발송 · {chosen.length}명)</p>
              <button
                onClick={() => setRecipList(l => [...l, { name: '', phone: '', include: true }])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                <Plus size={12} /> 수신자 추가
              </button>
            </div>
            <div className="space-y-1.5 mb-3">
              {recipList.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked={r.include} onChange={() => updateRecip(i, { include: !r.include })}
                    className="flex-shrink-0" />
                  <input value={r.name} onChange={e => updateRecip(i, { name: e.target.value })} placeholder="이름"
                    className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                  <input value={r.phone} onChange={e => updateRecip(i, { phone: e.target.value })} placeholder="010-0000-0000"
                    className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400" />
                  <button onClick={() => setRecipList(l => l.filter((_, j) => j !== i))}
                    className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
                </div>
              ))}
              {recipList.length === 0 && (
                <p className="text-xs text-gray-400">수신자를 추가하세요.</p>
              )}
            </div>

            <p className="text-xs text-gray-500 mb-1">메시지 (수정 가능)</p>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={7}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 whitespace-pre-wrap"
            />
            <p className="text-[11px] text-gray-400 mt-1">{draft.length}자 · 같은 내용이 체크한 수신자 전원에게 발송됩니다.</p>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setSendRow(null)} disabled={sending}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                취소
              </button>
              <button onClick={doSend} disabled={sending || chosen.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
                <Send size={15} /> {sending ? '발송 중...' : '발송하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
