'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'draft', label: '작성중' },
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' },
]

export default function ProjectEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    client_name: '',
    address: '',
    area_sqm: '',
    manager_name: '',
    manager_phone: '',
    status: 'draft',
  })

  useEffect(() => {
    createClient()
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setForm({
          name: data.name ?? '',
          client_name: data.client_name ?? '',
          address: data.address ?? '',
          area_sqm: data.area_sqm ?? '',
          manager_name: data.manager_name ?? '',
          manager_phone: data.manager_phone ?? '',
          status: data.status ?? 'draft',
        })
        setLoading(false)
      })
  }, [id])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const sb = createClient()
    const { error } = await sb.from('projects').update({
      name: form.name,
      client_name: form.client_name,
      address: form.address,
      area_sqm: form.area_sqm ? Number(form.area_sqm) : null,
      manager_name: form.manager_name,
      manager_phone: form.manager_phone,
      status: form.status,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSaving(false)
    if (!error) router.push('/projects/' + id)
    else alert('저장 중 오류가 발생했습니다: ' + error.message)
  }

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">프로젝트 수정</h2>
          <p className="text-gray-500 text-sm mt-0.5">프로젝트 정보를 수정합니다</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로젝트명 *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예) 강남구 아파트 인테리어" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">고객명 *</label>
          <input value={form.client_name} onChange={e => set('client_name', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예) 홍길동" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">현장 주소</label>
          <input value={form.address} onChange={e => set('address', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="예) 서울시 강남구 역삼동 123-4" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">면적 (m²)</label>
            <input type="number" value={form.area_sqm} onChange={e => set('area_sqm', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예) 84.5" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">상태</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">담당자명</label>
            <input value={form.manager_name} onChange={e => set('manager_name', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예) 김형신" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">연락처</label>
            <input value={form.manager_phone} onChange={e => set('manager_phone', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예) 010-1234-5678" />
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button onClick={() => router.back()}
          className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
          취소
        </button>
        <button onClick={handleSave} disabled={saving || !form.name || !form.client_name}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
          <Save size={16} />
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>
    </div>
  )
}
