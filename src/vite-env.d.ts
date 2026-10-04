/// <reference types="vite/client" />

declare module './tools/wifi-scan.mjs' {
  export function scanWifi(): Promise<{
    networks: unknown[]
    scannedAt: string
    source: string
    notice: string
  }>
}
