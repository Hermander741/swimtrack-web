interface TypingUser { userId: string; name: string }
interface Props { users: TypingUser[] }

export function TypingIndicator({ users }: Props) {
  if (users.length === 0) return null
  const label = users.length === 1
    ? `${users[0].name} schreibt gerade…`
    : `${users.slice(0, 2).map(u => u.name).join(' und ')} schreiben gerade…`
  return <div className="px-4 py-1 text-slate-400 text-xs italic">{label}</div>
}
