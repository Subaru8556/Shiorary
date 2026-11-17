// frontend/src/lib/storage.ts
// localStorage に端末ごとの表示設定を保存する（プライベートモード等で失敗しても動作は継続）

export function loadPref<T>(key: string, fallback: T): T {
  try {
    // 旧名（Readoria）時代の設定も引き継ぐ
    const raw = localStorage.getItem(`shiorary:${key}`) ?? localStorage.getItem(`readoria:${key}`)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function savePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`shiorary:${key}`, JSON.stringify(value))
  } catch {
    /* 保存できなくても致命的ではない */
  }
}
