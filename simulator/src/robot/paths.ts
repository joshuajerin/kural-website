const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export function simulatorAsset(path: string): string {
  return `${base}/${path.replace(/^\//, '')}`
}
