import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type Member = { name: string; phone: string; notify?: boolean }

// notify:true인 항목의 전화번호만 반환, 없으면 레거시 필드로 폴백
function getPhones(arr: any, ...fallbacks: any[]): string[] {
  if (Array.isArray(arr) && arr.length > 0) {
    return arr
      .filter((m: Member) => m.notify !== false)
      .map((m: Member) => m.phone)
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
  }
  return fallbacks.filter((p): p is string => typeof p === 'string' && p.length > 0)
}

async function sendOneSms(phone: string, message: string, apiKey: string, apiSecret: string, sender: string) {
  const crypto = await import('crypto')
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')

  const res = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({
      message: { to: phone.replace(/-/g, ''), from: sender.replace(/-/g, ''), text: message }
    }),
  })

  if (!res.ok) {
    const result = await res.json()
    throw new Error(JSON.stringify(result))
  }
}

export async function POST(req: Request) {
  const {
    quoteId, type, itemId, items: payloadItems,
    totalProfit: payloadTotalProfit,
    totalProfitRate: payloadTotalProfitRate,
    minProfitRate: payloadMinProfitRate,
    projectedProfitRate: payloadProjectedProfitRate,
    currentProfitRate: payloadCurrentProfitRate,
    completedGroups: payloadCompletedGroups,
    totalGroups: payloadTotalGroups,
  } = await req.json()
  const sb = await createClient()

  const { data: quote } = await sb
    .from('quotes')
    .select('*, projects(*)')
    .eq('id', quoteId)
    .single()

  if (!quote) return NextResponse.json({ ok: false, error: '견적을 찾을 수 없습니다.' })

  const project = quote.projects
  let phones: string[] = []
  let message = ''

  if (type === 'payment') {
    // 모든 고객에게 발송
    phones = getPhones(project.clients, quote.client_phone, project.manager_phone)
    const dueDate = quote.payment_due_date
      ? new Date(quote.payment_due_date + 'T00:00:00').toLocaleDateString('ko-KR')
      : '미정'
    const firstClientName = (project.clients as Member[] | null)?.[0]?.name ?? project.client_name ?? ''
    const contactPhone = getPhones(project.pms, project.manager_phone)[0] ?? ''
    message = `[로멘토 인테리어]\n안녕하세요, ${firstClientName}님!\n${project.name} 공사 관련 입금 예정일(${dueDate})이 다가왔습니다.\n최종 금액: ${Number(quote.final_amount).toLocaleString()}원\n문의: ${contactPhone}`
  } else if (type === 'total') {
    // PM + 디자이너 + 현장소장 전원에게 발송
    const pmPhones = getPhones(project.pms, project.manager_phone)
    const designerPhones = getPhones(project.designers, project.designer_phone)
    const sitePhones = getPhones(project.site_managers, project.site_manager_phone)
    phones = [...new Set([...pmPhones, ...designerPhones, ...sitePhones])]
    const tp = payloadTotalProfit ?? Number(quote.total_profit)
    const tpr = payloadTotalProfitRate ?? Number(quote.total_profit_rate)
    message = `[로멘토 견적알람]\n⚠️ 마이너스 발생!\n프로젝트: ${project.name}\n총 이윤: ${Number(tp).toLocaleString()}원 (${Number(tpr).toFixed(1)}%)\n즉시 확인 바랍니다.`
  } else if (type === 'item') {
    // PM + 디자이너 + 현장소장 전원에게 발송
    const { data: item } = await sb.from('quote_items').select('*').eq('id', itemId).single()
    const pmPhones = getPhones(project.pms, project.manager_phone)
    const designerPhones = getPhones(project.designers, project.designer_phone)
    const sitePhones = getPhones(project.site_managers, project.site_manager_phone)
    phones = [...new Set([...pmPhones, ...designerPhones, ...sitePhones])]
    message = `[로멘토 견적알람]\n⚠️ 마이너스 공정 발생!\n프로젝트: ${project.name}\n공종: ${item?.work_type}\n항목: ${item?.item_name}\n이윤: ${Number(item?.profit).toLocaleString()}원 (${Number(item?.profit_rate).toFixed(1)}%)\n즉시 확인 바랍니다.`
  } else if (type === 'profit_warning') {
    // PM + 디자이너 + 현장소장 전원에게 발송
    const pmPhones = getPhones(project.pms, project.manager_phone)
    const designerPhones = getPhones(project.designers, project.designer_phone)
    const sitePhones = getPhones(project.site_managers, project.site_manager_phone)
    phones = [...new Set([...pmPhones, ...designerPhones, ...sitePhones])]
    const minRate = payloadMinProfitRate ?? quote.min_profit_rate ?? project.min_profit_rate ?? 0
    const currentRate = Number(payloadTotalProfitRate ?? quote.total_profit_rate ?? 0).toFixed(1)
    message = `[로멘토 견적알람]\n⚠️ 목표이윤 미달!\n프로젝트: ${project.name}\n목표: ${minRate}% / 현재: ${currentRate}%\n즉시 확인 바랍니다.`
  } else if (type === 'item_minus') {
    const pmPhones = getPhones(project.pms, project.manager_phone)
    const designerPhones = getPhones(project.designers, project.designer_phone)
    const sitePhones = getPhones(project.site_managers, project.site_manager_phone)
    phones = [...new Set([...pmPhones, ...designerPhones, ...sitePhones])]

    const proj = Number(payloadProjectedProfitRate ?? 0)
    const min: number | null = payloadMinProfitRate ?? null
    const completed = Number(payloadCompletedGroups ?? 0)
    const total = Number(payloadTotalGroups ?? 0)
    const cur: string = payloadCurrentProfitRate != null ? `${Number(payloadCurrentProfitRate).toFixed(1)}%` : '집계 전'
    const isDeficit = proj < 0
    const header = isDeficit ? '[로멘토] ⚠️ 이윤 경고' : '[로멘토] 이윤 경고'

    let totalBlock: string
    if (min != null) {
      const statusLine = proj >= min ? '✓ 목표 달성 중' : `▼ ${(min - proj).toFixed(1)}%p 미달`
      totalBlock = `\n▣ 전체 이윤율\n 목표 ${min}%\n 현재 ${cur} / 예상 ${proj.toFixed(1)}%\n ${statusLine} (진행 ${completed}/${total})\n`
    } else {
      totalBlock = `\n▣ 전체 이윤율\n 현재 ${cur} / 예상 ${proj.toFixed(1)}% (진행 ${completed}/${total})\n`
    }

    const warnItems = (payloadItems as { name: string; rate: number; tier: string; latestExecDate?: string | null }[]) ?? []
    const sorted = [...warnItems].sort((a, b) => {
      const da = a.latestExecDate ?? '', db = b.latestExecDate ?? ''
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return db.localeCompare(da)
    })

    let warnBlock: string
    if (sorted.length > 0) {
      const top = sorted.slice(0, 3)
      const rest = sorted.length - top.length
      const lines = top.map(i => {
        const label = i.tier === 'deficit' ? '[적자]' : '[미달]'
        return ` • ${label} ${i.name} ${Number(i.rate).toFixed(1)}%`
      })
      warnBlock = '\n' + lines.join('\n') + (rest > 0 ? `\n 외 ${rest}건` : '') + '\n'
    } else {
      const belowTarget = min != null && proj < min
      warnBlock = (isDeficit || belowTarget)
        ? `\n※ 완료된 공종은 모두 정상.\n   미입력 공종 정산 시 확인 필요.\n`
        : ''
    }

    message = `${header}\n현장: ${project.name}\n${totalBlock}${warnBlock}\n확인 후 조치 바랍니다.`
  }

  if (!phones.length) return NextResponse.json({ ok: false, error: '수신 번호가 없습니다.' })

  const apiKey = process.env.COOLSMS_API_KEY
  const apiSecret = process.env.COOLSMS_API_SECRET
  const sender = process.env.COOLSMS_SENDER

  const errors: string[] = []

  for (const phone of phones) {
    let sent = true
    if (apiKey && apiSecret && sender) {
      try {
        await sendOneSms(phone, message, apiKey, apiSecret, sender)
      } catch (e: any) {
        errors.push(`${phone}: ${e.message}`)
        sent = false
      }
    }
    const { error: insertError } = await sb.from('sms_alerts').insert({
      quote_id: quoteId,
      quote_item_id: itemId || null,
      type,
      message,
      recipient_phone: phone,
      sent_at: new Date().toISOString(),
      status: sent ? 'sent' : 'failed',
    })
    if (insertError) console.error('[sms_alerts INSERT 실패]', insertError.message)
  }

  if (errors.length) return NextResponse.json({ ok: false, error: errors.join('; ') })
  return NextResponse.json({ ok: true, message, phones })
}
