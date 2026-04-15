import { prisma } from '@/lib/prisma'

interface GoogleTokenResponse {
  access_token?: string
  error?: string
}

/**
 * Get a valid Google access_token for the given user that includes
 * the Sheets scope. Refreshes via refresh_token if expired.
 * Returns null if the user has no Google account or no Sheets scope.
 */
export async function getGoogleSheetsToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
    select: { access_token: true, refresh_token: true, expires_at: true, scope: true },
  })

  if (!account) return null
  if (!account.scope?.includes('spreadsheets')) return null
  if (!account.refresh_token) return null

  const nowSecs = Math.floor(Date.now() / 1000)
  const isExpired = !account.expires_at || account.expires_at < nowSecs + 60

  if (!isExpired && account.access_token) return account.access_token

  // Refresh the token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json() as GoogleTokenResponse
  if (!data.access_token) return null

  // Update stored token
  await prisma.account.updateMany({
    where: { userId, provider: 'google' },
    data: {
      access_token: data.access_token,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
  })

  return data.access_token
}

interface SheetValue {
  values: (string | number)[][]
}

/**
 * Create a new Google Sheet with the given title and sheets data.
 * Returns the URL of the created spreadsheet.
 */
export async function createGoogleSheet(
  accessToken: string,
  title: string,
  sheets: { sheetTitle: string; rows: (string | number)[][] }[]
): Promise<string> {
  // Build batch update request
  const sheetsData: SheetValue[] = sheets.map(s => ({ values: s.rows }))

  // Create the spreadsheet
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: sheets.map((s, i) => ({
        properties: { sheetId: i, title: s.sheetTitle },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: sheetsData[i].values.map(row => ({
            values: row.map(cell => ({
              userEnteredValue: typeof cell === 'number'
                ? { numberValue: cell }
                : { stringValue: String(cell) },
            })),
          })),
        }],
      })),
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Sheets API error: ${err}`)
  }

  const created = await createRes.json() as { spreadsheetId: string }
  return `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`
}
