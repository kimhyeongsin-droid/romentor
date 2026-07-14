import crypto from 'crypto'

export type Member = { name?: string; phone?: string; notify?: boolean }

// notify !== false 이고 전화번호가 있는 수신자만 반환
export function notifyPhones(arr: unknown): { name: string; phone: string }[] {
  if (!Array.isArray(arr)) return []
  return (arr as Member[])
    .filter((m) => m && m.notify !== false && typeof m.phone === 'string' && m.phone.length > 0)
    .map((m) => ({ name: m.name ?? '', phone: m.phone as string }))
}

export function smsConfig(): { apiKey: string; apiSecret: string; sender: string } | null {
  const apiKey = process.env.COOLSMS_API_KEY
  const apiSecret = process.env.COOLSMS_API_SECRET
  const sender = process.env.COOLSMS_SENDER
  if (!apiKey || !apiSecret || !sender) return null
  return { apiKey, apiSecret, sender }
}

// 솔라피(CoolSMS) 단건 발송. 실패 시 throw.
export async function sendCoolSms(
  to: string,
  text: string,
  cfg: { apiKey: string; apiSecret: string; sender: string },
): Promise<void> {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(16).toString('hex')
  const signature = crypto.createHmac('sha256', cfg.apiSecret).update(date + salt).digest('hex')

  const res = await fetch('https://api.coolsms.co.kr/messages/v4/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `HMAC-SHA256 apiKey=${cfg.apiKey}, date=${date}, salt=${salt}, signature=${signature}`,
    },
    body: JSON.stringify({
      message: { to: to.replace(/-/g, ''), from: cfg.sender.replace(/-/g, ''), text },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`coolsms ${res.status}: ${body}`)
  }
}
