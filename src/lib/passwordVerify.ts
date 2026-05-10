export async function verifyAdminPassword(input: string): Promise<boolean> {
  const envHash = process.env.NEXT_PUBLIC_FORMAT_PASSWORD_HASH
  if (!envHash) return false

  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex === envHash.toLowerCase()
}
