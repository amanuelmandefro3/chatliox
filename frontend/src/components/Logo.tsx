import logoSrc from '@/assets/logo.svg'

interface Props {
  className?: string
  /** Use 'light' on dark backgrounds — applies CSS invert to render white */
  variant?: 'dark' | 'light'
  alt?: string
}

export default function Logo({ className = '', variant = 'dark', alt = 'Chatliox' }: Props) {
  return (
    <img
      src={logoSrc}
      alt={alt}
      className={className}
      style={variant === 'light' ? { filter: 'brightness(0) invert(1)' } : undefined}
    />
  )
}
