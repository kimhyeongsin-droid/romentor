'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewProjectPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '', client_name: '', address: '', area_sqm: '',
    manager_name: '', manager_phone: '', status: 'draft',
    designer_name: '', designer_phone: '',
    site_manager_name: '', site_manager_phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [areaUnit, setAreaUnit] = useState<'sqm' | 'py'>('sqm')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  // 평 <-> m² 변환
  const handleAreaChange = (v: string) => {
    set('area_sqm', v)
  }
  const handleUnitToggle = (unit: 'sqm' | 'py') => {
    if (unit === areaUnit) return
    const val = parseFloat(form.area_sqm)
    if (!isNaN(val) && val > 0) {
      if (unit === 'py') {
        // m² -> 평
        set('area_sqm', (val / 3.3058).toFixed(1))
      } else {
        // 평 -> m²
        set('area_sqm', (val * 3.3058).toFixed(1))
      }
    }
    setAreaUnit(unit)
  }

  // 저장 시 항상 m²로 변환해서 저장
  const getAreaSqm = () => {
    const val = parseFloat(form.area_sqm)
    if (isNaN(val)) return null
    if (areaUnit === 'py') return parseFloat((val * 3.3058).toFixed(2))
    return val
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient().from('projects').insert({
      ...form, area_sqm: getAreaSqm()
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
          <Field label="프로젝트명 *" value={form.name} onChange={v => set('name', v)} required />
          <Field label="고객명 *" value={form.client_name} onChange={v => set('client_name', v)} required />
          <Field label="현장 주소" value={form.address} onChange={v => set('address', v)} />

          {/* 면적 입력 - m²/평 전환 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">면적</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={form.area_sqm}
                onChange={e => handleAreaChange(e.target.value)}
                placeholder={areaUnit === 'sqm' ? '예) 84.5' : '예) 25.5'}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {/* 단위 토글 */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
                <button
                  type="button"
                  onClick={() => handleUnitToggle('sqm')}
                  className={`px-3 py-2 transition-colors ${areaUnit === 'sqm' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  m²
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitToggle('py')}
                  className={`px-3 py-2 transition-colors ${areaUnit === 'py' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                  평
                </button>
              </div>
            </div>
            {/* 변환값 미리보기 */}
            {form.area_sqm && !isNaN(parseFloat(form.area_sqm)) && (
              <p className="text-xs text-gray-400 mt-1">
                {areaUnit === 'sqm'
                  ? `≈ ${(parseFloat(form.area_sqm) / 3.3058).toFixed(1)}평`
                  : `≈ ${(parseFloat(form.area_sqm) * 3.3058).toFixed(1)}m²`
                }
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">작성중</option>
              <option value="active">진행중</option>
              <option value="completed">완료</option>
            </select>
          </div>
        </div>

        {/* 담당 PM */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">담당 PM <span className="text-xs font-normal text-gray-400">(문자 수신 + 마이너스 알람)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="담당자명 *" value={form.manager_name} onChange={v => set('manager_name', v)} required />
            <Field label="연락처 *" type="tel" value={form.manager_phone} onChange={v => set('manager_phone', v)} placeholder="010-0000-0000" required />
          </div>
        </div>

        {/* 담당 디자이너 */}
        <div className="bg-white rounded-xl border border-blue-50 shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-blue-700 mb-2">담당 디자이너 <span className="text-xs font-normal text-blue-400">(마이너스 알람 수신)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="디자이너명" value={form.designer_name} onChange={v => set('designer_name', v)} />
            <Field label="연락처" type="tel" value={form.designer_phone} onChange={v => set('designer_phone', v)} placeholder="010-0000-0000" />
          </div>
        </div>

        {/* 담당 현장팀 */}
        <div className="bg-white rounded-xl border border-amber-50 shadow-sm p-6 space-y-4">
          <p className="text-sm font-semibold text-amber-700 mb-2">담당 현장팀 <span className="text-xs font-normal text-amber-400">(마이너스 알람 수신)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="현장팀명" value={form.site_manager_name} onChange={v => set('site_manager_name', v)} />
            <Field label="연락처" type="tel" value={form.site_manager_phone} onChange={v => set('site_manager_phone', v)} placeholder="010-0000-0000" />
          </div>
        </div>

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
