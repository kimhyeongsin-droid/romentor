import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendCoolSms, smsConfig, notifyPhones } from '@/lib/sms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const fmtWon = (n: number) => Number(n || 0).toLocaleString('ko-KR')

// KST(UTC+9) 기준 오늘 날짜 YYYY-MM-DD. Vercel Cron이 UTC로 돌아도 한국 날짜로 계산.
function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}
function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO + 'T00:00:00Z').getTime()
  const b = new Date(toISO + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

export async function GET(req: Request) {
  // 인증: Vercel Cron은 Authorization: Bearer ${CRON_SECRET} 를 자동 전송.
  // 수동 실행 시 ?secret=... 도 허용.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    const qs = new URL(req.url).searchParams.get('secret')
    if (auth !== `Bearer ${secret}` && qs !== secret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const sb = createServiceClient()

  const { data: settings } = await sb.from('app_settings').select('*').eq('id', 1).single()
  if (settings && settings.sms_auto_enabled === false) {
    return NextResponse.json({ ok: true, skipped: 'master_off' })
  }
  const interval = Math.max(1, Number(settings?.overdue_interval_days ?? 3))
  const maxCount = Math.max(0, Number(settings?.overdue_max_count ?? 5))

  const today = kstToday()

  // 예정일이 오늘이거나 지난 미입금 건
  const { data: rows, error } = await sb
    .from('payment_schedules')
    .select('*, projects(name, clients, pms, sms_auto_enabled)')
    .eq('status', 'pending')
    .lte('due_date', today)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const cfg = smsConfig()
  const result = {
    today, reminders: 0, overdue: 0, failed: 0, skipped: 0,
    smsConfigured: !!cfg, details: [] as Array<Record<string, unknown>>,
  }

  for (const row of rows ?? []) {
    const project = (row as { projects?: { name: string; clients: unknown; pms: unknown; sms_auto_enabled?: boolean } }).projects
    if (!project || project.sms_auto_enabled === false) { result.skipped++; continue }

    const overdueDays = daysBetween(row.due_date, today) // >= 0
    let kind: 'reminder' | 'overdue' | null = null

    if (overdueDays === 0) {
      if (!row.reminder_sent_at) kind = 'reminder'
    } else if (overdueDays > 0 && row.overdue_count < maxCount) {
      const lastSent = row.last_overdue_sent_at ? String(row.last_overdue_sent_at).slice(0, 10) : null
      const okFirst = !lastSent && overdueDays >= interval
      const okRepeat = !!lastSent && daysBetween(lastSent, today) >= interval
      if (okFirst || okRepeat) kind = 'overdue'
    }
    if (!kind) { result.skipped++; continue }

    const recips = notifyPhones(project.clients)
    if (recips.length === 0) { result.skipped++; continue }

    const contact = notifyPhones(project.pms)[0]?.phone ?? ''
    const dueK = new Date(row.due_date + 'T00:00:00').toLocaleDateString('ko-KR')
    const amount = fmtWon(row.amount)

    let sentAny = false
    for (const r of recips) {
      const text = kind === 'reminder'
        ? `[로멘토 인테리어]\n안녕하세요, ${r.name || '고객'}님.\n'${project.name}' ${row.label} ${amount}원의 입금 예정일이 오늘(${dueK})입니다.\n입금 부탁드립니다.${contact ? `\n문의: ${contact}` : ''}`
        : `[로멘토 인테리어]\n안녕하세요, ${r.name || '고객'}님.\n'${project.name}' ${row.label} ${amount}원의 입금 예정일(${dueK})이 ${overdueDays}일 지났습니다.\n확인 부탁드립니다.${contact ? `\n문의: ${contact}` : ''}`

      let status: 'sent' | 'failed' = 'sent'
      if (cfg) {
        try {
          await sendCoolSms(r.phone, text, cfg)
        } catch (e) {
          status = 'failed'
          result.failed++
          result.details.push({ id: row.id, phone: r.phone, error: (e as Error).message })
        }
      }
      if (status === 'sent') sentAny = true

      await sb.from('sms_alerts').insert({
        project_id: row.project_id,
        payment_schedule_id: row.id,
        type: kind === 'reminder' ? 'payment_reminder' : 'payment_overdue',
        message: text,
        recipient_phone: r.phone,
        status,
        sent_at: new Date().toISOString(),
      })
    }

    if (sentAny) {
      if (kind === 'reminder') {
        await sb.from('payment_schedules').update({ reminder_sent_at: new Date().toISOString() }).eq('id', row.id)
        result.reminders++
      } else {
        await sb.from('payment_schedules').update({
          last_overdue_sent_at: new Date().toISOString(),
          overdue_count: (row.overdue_count ?? 0) + 1,
        }).eq('id', row.id)
        result.overdue++
      }
    }
  }

  return NextResponse.json({ ok: true, ...result })
}
