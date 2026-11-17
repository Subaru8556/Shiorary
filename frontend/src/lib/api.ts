// frontend/src/lib/api.ts
// fetch の薄いラッパー。エラー時はサーバーの { error } メッセージを Error にして投げる

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `通信エラー (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* JSON 以外のレスポンス */
    }
    throw new ApiError(res.status, message)
  }
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(url, init))
}

export async function apiSend<T = unknown>(
  method: 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  return parse<T>(await fetch(url, init))
}
