import { BASE } from '../../api/client'

interface AvatarProps {
  name: string
  color?: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Avatar({ name, color = '#0EA5E9', imageUrl, size = 'md' }: AvatarProps) {
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-xl' }
  const fullUrl = imageUrl ? `${BASE}${imageUrl}` : null
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-bold text-white shrink-0 overflow-hidden`}
      style={fullUrl ? undefined : { backgroundColor: color }}
    >
      {fullUrl
        ? <img src={fullUrl} alt={name} className="w-full h-full object-cover" />
        : initials}
    </div>
  )
}
