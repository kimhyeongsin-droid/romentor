'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Bell, BellOff, Plus, Save, Trash2 } from 'lucide-react'

type Member = { name: string; phone: string; notify: boolean }

const STATUS_OPTIONS = [
  { value: 'draft', label: '작성중' },
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' },
]

// 레거시 또는 notify 필드 없는 데이터를 정규화
function normalizeMember(m: any): Member {
  return { name: m.name ?? '', phone: m.phone ?? '', notify: m.notify !== false }
}

export default function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [basicForm, setBasicForm] = useState({ name: '', address: '', area_sqm: '', status: 'draft' })
  const [clients, setClients] = useState<Member[]>([{ name: '', phone: '', notify: true }])
  const [pms, setPms] = useState<Member[]>([{ name: '', phone: '', notify: true }])
  const [designers, setDesigners] = useState<Member[]>([])
  const [siteManagers, setSiteManagers] = useState<Member[]>([])

  useEffect(() => {
    createClient()
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setBasicForm({
            name: data.name ?? '',
            address: data.address ?? '',
            area_sqm: data.area_sqm != null ? String(data.area_sqm) : '',
            status: data.status ?? 'draft',
          })
          // JSONB 배열 우선, 없으면 레거시 필드 폴백 (notify 기본값 true)
          setClients(
            Array.isArray(data.clients) && data.clients.length > 0
              ? data.clients.map(normalizeMember)
              : data.client_name ? [{ name: data.client_name, phone: '', notify: true }]
              : [{ name: '', phone: '', notify: true }]
          )
          setPms(
            Array.isArray(data.pms) && data.pms.length > 0
              ? data.pms.map(normalizeMember)
              : data.manager_name ? [{ name: data.manager_name, phone: data.manager_phone ?? '', notify: true }]
              : [{ name: '', phone: '', notify: true }]
          )
          setDesigners(
            Array.isArray(data.designers) && data.designers.length > 0
              ? data.designers.map(normalizeMember)
              : data.designer_name ? [{ name: data.designer_name, phone: data.designer_phone ?? '', notify: true }]
              : []
          )
          setSiteManagers(
            Array.isArray(data.site_managers) && data.site_managers.length > 0
              ? data.site_managers.map(normalizeMember)
              : data.site_manager_name ? [{ name: data.site_manager_name, phone: data.site_manager_phone ?? '', notify: true }]
              : []
          )
        }
        setLoading(false)
      })
  }, [id])

  const setBasic = (k: string, v: string) => setBasicForm(f => ({ ...f, [k]: v }))

  const addMember = (setter: React.Dispatch<React.SetStateAction<Member[]>>) =>
    setter(m => m.length < 10 ? [...m, { name: '', phone: '', notify: true }] : m)

  const removeMember = (setter: React.Dispatch<React.SetStateAction<Member[]>>, idx: number) =>
    setter(m => m.filter((_, i) => i !== idx))

  const updateMember = (
    setter: React.Dispatch<React.SetStateAction<Member[]>>,
    idx: number, field: 'name' | 'phone', val: string
  ) => setter(m => m.map((item, i) => i === idx ? { ...item, [field]: val } : item))

  const toggleNotify = (setter: React.Dispatch<React.SetStateAction<Member[]>>, idx: number) =>
    setter(m => m.map((item, i) => i === idx ? { ...item, notify: !item.notify } : item))

  const handleSave = async () => {
    setSaving(true)
    const first = (arr: Member[]) => arr[0] ?? { name: '', phone: '', notify: true }
    const { error } = await createClient().from('projects').update({
      name: basicForm.name,
      address: basicForm.address,
      area_sqm: basicForm.area_sqm ? Number(basicForm.area_sqm) : null,
      status: basicForm.status,
      updated_at: new Date().toISOString(),
      // 하위 호환: 첫 번째 항목을 단일 필드에도 저장
      client_name: first(clients).name,
      manager_name: first(pms).name,
      manager_phone: first(pms).phone,
      designer_name: first(designers).name,
      designer_phone: first(designers).phone,
      site_manager_name: first(siteManagers).name,
      site_manager_phone: first(siteManagers).phone,
      // JSONB 배열 (notify 포함)
      clients: clients.filter(m => m.name),
      pms: pms.filter(m => m.name),
      designers: designers.filter(m => m.name),
      site_managers: siteManagers.filter(m => m.name),
    }).eq('id', id)
    setSaving(false)
    if (!error) router.push('/projects')
    else alert('저장 중 오류가 발생했습니다: ' + error.message)
  }

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.push('/projects')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">프로젝트 수정</h2>
          <p className="text-gray-500 text-sm mt-0.5">프로젝트 정보를 수정합니다</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* 기본 정보 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <p className="text-sm font-semibold text-gray-700">기본 정보</p>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로젝트명 *</label>
            <input value={basicForm.name} onChange={e => setBasic('name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예) 강남구 아파트 인테리어" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">현장 주소</label>
            <input value={basicForm.address} onChange={e => setBasic('address', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예) 서울시 강남구 역삼동 123-4" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">면적 (m²)</label>
              <input type="number" value={basicForm.area_sqm} onChange={e => setBasic('area_sqm', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="예) 84.5" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">상태</label>
              <select value={basicForm.status} onChange={e => setBasic('status', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* 고객님 */}
        <MemberSection
          title="고객님" subtitle="(입금 알림 수신)"
          borderColor="border-gray-100" titleColor="text-gray-700" subtitleColor="text-gray-400"
          nameLabel="고객명"
          members={clients}
          onAdd={() => addMember(setClients)}
          onRemove={idx => removeMember(setClients, idx)}
          onChange={(idx, f, v) => updateMember(setClients, idx, f, v)}
          onToggleNotify={idx => toggleNotify(setClients, idx)}
          minOne
        />

        {/* 담당 PM */}
        <MemberSection
          title="담당 PM" subtitle="(문자 수신 + 마이너스 알람)"
          borderColor="border-gray-100" titleColor="text-gray-700" subtitleColor="text-gray-400"
          nameLabel="담당자명"
          members={pms}
          onAdd={() => addMember(setPms)}
          onRemove={idx => removeMember(setPms, idx)}
          onChange={(idx, f, v) => updateMember(setPms, idx, f, v)}
          onToggleNotify={idx => toggleNotify(setPms, idx)}
          minOne
        />

        {/* 담당 디자이너 */}
        <MemberSection
          title="담당 디자이너" subtitle="(마이너스 알람 수신)"
          borderColor="border-blue-50" titleColor="text-blue-700" subtitleColor="text-blue-400"
          nameLabel="디자이너명"
          members={designers}
          onAdd={() => addMember(setDesigners)}
          onRemove={idx => removeMember(setDesigners, idx)}
          onChange={(idx, f, v) => updateMember(setDesigners, idx, f, v)}
          onToggleNotify={idx => toggleNotify(setDesigners, idx)}
        />

        {/* 담당 현장소장 */}
        <MemberSection
          title="담당 현장소장" subtitle="(마이너스 알람 수신)"
          borderColor="border-amber-50" titleColor="text-amber-700" subtitleColor="text-amber-400"
          nameLabel="현장소장명"
          members={siteManagers}
          onAdd={() => addMember(setSiteManagers)}
          onRemove={idx => removeMember(setSiteManagers, idx)}
          onChange={(idx, f, v) => updateMember(setSiteManagers, idx, f, v)}
          onToggleNotify={idx => toggleNotify(setSiteManagers, idx)}
        />

        <div className="flex gap-3 mt-2">
          <button onClick={() => router.push('/projects')}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
            취소
          </button>
          <button onClick={handleSave} disabled={saving || !basicForm.name}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
            <Save size={16} />
            {saving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberSection({ title, subtitle, borderColor, titleColor, subtitleColor, nameLabel, members, onAdd, onRemove, onChange, onToggleNotify, minOne }: {
  title: string; subtitle: string
  borderColor: string; titleColor: string; subtitleColor: string
  nameLabel: string
  members: Member[]
  onAdd: () => void
  onRemove: (idx: number) => void
  onChange: (idx: number, field: 'name' | 'phone', value: string) => void
  onToggleNotify: (idx: number) => void
  minOne?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl border ${borderColor} shadow-sm p-6 space-y-3`}>
      <div className="flex items-center justify-between mb-1">
        <p className={`text-sm font-semibold ${titleColor}`}>
          {title} <span className={`text-xs font-normal ${subtitleColor}`}>{subtitle}</span>
        </p>
        {members.length < 10 && (
          <button type="button" onClick={onAdd}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={13} /> 추가
          </button>
        )}
      </div>
      {members.length === 0 && (
        <button type="button" onClick={onAdd}
          className="w-full border border-dashed border-gray-200 rounded-lg py-2.5 text-xs text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
          + 추가
        </button>
      )}
      {members.map((m, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            type="text"
            value={m.name}
            onChange={e => onChange(idx, 'name', e.target.value)}
            placeholder={nameLabel}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="tel"
            value={m.phone}
            onChange={e => onChange(idx, 'phone', e.target.value)}
            placeholder="010-0000-0000"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onToggleNotify(idx)}
            title={m.notify ? '알림 수신 중 (클릭 시 OFF)' : '알림 수신 안 함 (클릭 시 ON)'}
            className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${m.notify ? 'text-blue-500 hover:bg-blue-50' : 'text-gray-300 hover:bg-gray-50'}`}
          >
            {m.notify ? <Bell size={14} /> : <BellOff size={14} />}
          </button>
          {(!minOne || members.length > 1) && (
            <button type="button" onClick={() => onRemove(idx)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
