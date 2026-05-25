'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, BellOff, Plus, Trash2 } from 'lucide-react'

type Member = { name: string; phone: string; notify: boolean }

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [areaSqm, setAreaSqm] = useState('')
  const [status, setStatus] = useState('draft')
  const [areaUnit, setAreaUnit] = useState<'sqm' | 'py'>('py')
  const [clients, setClients] = useState<Member[]>([{ name: '', phone: '', notify: true }])
  const [pms, setPms] = useState<Member[]>([{ name: '', phone: '', notify: true }])
  const [designers, setDesigners] = useState<Member[]>([])
  const [siteManagers, setSiteManagers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)

  const handleUnitToggle = (unit: 'sqm' | 'py') => {
    if (unit === areaUnit) return
    const val = parseFloat(areaSqm)
    if (!isNaN(val) && val > 0) {
      setAreaSqm(unit === 'py' ? (val / 3.3058).toFixed(1) : (val * 3.3058).toFixed(1))
    }
    setAreaUnit(unit)
  }

  const getAreaSqm = () => {
    const val = parseFloat(areaSqm)
    if (isNaN(val)) return null
    return areaUnit === 'py' ? parseFloat((val * 3.3058).toFixed(2)) : val
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const first = (arr: Member[]) => arr[0] ?? { name: '', phone: '', notify: true }
    const { error } = await createClient().from('projects').insert({
      name,
      address,
      area_sqm: getAreaSqm(),
      status,
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
      min_profit_rate: 15,
    })
    if (!error) router.push('/projects')
    else { alert('저장 실패: ' + error.message); setLoading(false) }
  }

  return (
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">새 프로젝트</h2>
      <form onSubmit={submit} className="space-y-5">

        {/* 기본 정보 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">기본 정보</p>
          <Field label="프로젝트명 *" value={name} onChange={setName} required />
          <Field label="현장 주소" value={address} onChange={setAddress} />

          {/* 면적 입력 - m²/평 전환 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">면적</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={areaSqm}
                onChange={e => setAreaSqm(e.target.value)}
                placeholder={areaUnit === 'sqm' ? '예) 84.5' : '예) 25.5'}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                <button type="button" onClick={() => handleUnitToggle('sqm')}
                  className={`px-3 py-2 transition-colors ${areaUnit === 'sqm' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>m²</button>
                <button type="button" onClick={() => handleUnitToggle('py')}
                  className={`px-3 py-2 transition-colors ${areaUnit === 'py' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>평</button>
              </div>
            </div>
            {areaSqm && !isNaN(parseFloat(areaSqm)) && (
              <p className="text-xs text-gray-400 mt-1">
                {areaUnit === 'sqm'
                  ? `≈ ${(parseFloat(areaSqm) / 3.3058).toFixed(1)}평`
                  : `≈ ${(parseFloat(areaSqm) * 3.3058).toFixed(1)}m²`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">작성중</option>
              <option value="active">진행중</option>
              <option value="completed">완료</option>
            </select>
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

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? '저장중...' : '저장'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200">
            취소
          </button>
        </div>
      </form>
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
            required={minOne && idx === 0}
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

function Field({ label, value, onChange, type = 'text', required = false, placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; required?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}
