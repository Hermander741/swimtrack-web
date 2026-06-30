import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function Impressum() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#080d1a] text-white px-6 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-8 transition-colors">
        <ChevronLeft size={16} /> Zurück
      </button>

      <h1 className="text-2xl font-bold mb-8">Impressum</h1>

      <p className="text-slate-400 text-xs mb-6">Angaben gemäß § 5 ECG (E-Commerce-Gesetz)</p>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Diensteanbieter</h2>
        <p className="text-slate-300 leading-relaxed">
          Herman Urban<br />
          Montleartstraße 1B/7/1<br />
          1140 Wien<br />
          Österreich
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Kontakt</h2>
        <p className="text-slate-300">
          E-Mail: <a href="mailto:herman.urban@live.com" className="text-blue-400 hover:underline">herman.urban@live.com</a>
        </p>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">Verantwortlich für den Inhalt</h2>
        <p className="text-slate-300">Herman Urban</p>
      </section>

      <section className="pt-6 border-t border-white/10">
        <p className="text-slate-500 text-sm leading-relaxed">
          Diese Website wird als privates Projekt betrieben und ist derzeit für den Schwimmverein "The Mermaids Wien" kostenfrei zugänglich. Es werden keine Werbeeinnahmen erzielt.
        </p>
        <p className="text-slate-500 text-sm leading-relaxed mt-3">
          Die Inhalte dieser Website wurden mit größtmöglicher Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden.
        </p>
      </section>
    </div>
  )
}
