export function BrandLogo({ className = '', label = 'Aloca' }) {
  return <span className={`brand-logo ${className}`.trim()} role="img" aria-label={label} />
}
