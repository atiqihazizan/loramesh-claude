// Shared product logo from /public/logo.png

import { publicAsset } from '../../lib/baseUrl.js';

export default function AppLogo({ className = 'h-8 w-auto max-w-[120px] object-contain', alt = 'LoRa Mesh' }) {
  return (
    <img
      src={publicAsset('logo.png')}
      alt={alt}
      className={className}
      width={120}
      height={32}
    />
  );
}
