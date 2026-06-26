import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`glass rounded-2xl p-4 ${onClick ? 'cursor-pointer active:scale-98 transition-transform duration-200' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
