// QR code for the slab label: scanning it opens this title page. Rendered as an SVG data URL.

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export function QrCode({ value, size = 132 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 1, color: { dark: '#1d1b19', light: '#ffffff' } })
      .then((svg) => setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => setSrc(null))
  }, [value])
  return src ? <img src={src} width={size} height={size} alt={`QR code for ${value}`} className="rounded-lg bg-white p-1" /> : <div style={{ width: size, height: size }} className="skeleton" />
}
