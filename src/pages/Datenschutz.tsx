import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-white mb-3">{title}</h2>
      <div className="text-slate-300 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export function Datenschutz() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#080d1a] text-white px-6 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-8 transition-colors">
        <ChevronLeft size={16} /> Zurück
      </button>

      <h1 className="text-2xl font-bold mb-2">Datenschutzerklärung</h1>
      <p className="text-slate-500 text-xs mb-10">Stand: Juni 2026</p>

      <Section title="1. Verantwortlicher">
        <p>
          Herman Urban<br />
          Montleartstraße 1B/7/1, 1140 Wien<br />
          E-Mail: <a href="mailto:herman.urban@live.com" className="text-blue-400 hover:underline">herman.urban@live.com</a>
        </p>
      </Section>

      <Section title="2. Allgemeines zur Datenverarbeitung">
        <p>
          SwimBase ist eine Vereinsmanagement-Plattform für Schwimmvereine. Die Verarbeitung personenbezogener Daten erfolgt ausschließlich zum Zweck der Vereinsorganisation, Trainingsplanung, Wettkampfverwaltung und internen Kommunikation der Mitglieder.
        </p>
        <p>
          Die Server befinden sich bei Hetzner Online GmbH, Deutschland. Es werden keine Daten an weitere Drittanbieter (z. B. Analytics- oder Tracking-Dienste) weitergegeben.
        </p>
      </Section>

      <Section title="3. Welche Daten werden verarbeitet?">
        <p>Im Rahmen der Nutzung von SwimBase werden folgende Daten verarbeitet:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white">Stammdaten:</strong> Name, E-Mail-Adresse, Vereinsrolle (z. B. Schwimmer, Trainer, Elternteil)</li>
          <li><strong className="text-white">Profilbild:</strong> freiwillig hochgeladenes Foto zur Personalisierung</li>
          <li><strong className="text-white">Leistungsdaten:</strong> Trainings- und Wettkampfzeiten, Bestzeiten, Trainingspläne</li>
          <li><strong className="text-white">Kommunikationsdaten:</strong> Nachrichten im internen Chat</li>
          <li><strong className="text-white">Dokumente:</strong> hochgeladene Dateien (z. B. Einverständniserklärungen, Meldungen)</li>
          <li><strong className="text-white">Gesundheitsbezogene Dokumente:</strong> sportärztliche Atteste, sofern vom Mitglied hochgeladen (siehe Punkt 4a)</li>
          <li><strong className="text-white">Termindaten:</strong> Trainings- und Wettkampftermine</li>
          <li><strong className="text-white">Gerätekennungen:</strong> bei aktivierten Push-Benachrichtigungen (siehe Punkt 10)</li>
        </ul>
      </Section>

      <Section title="4. Zweck und Rechtsgrundlage der Verarbeitung">
        <p>Die Verarbeitung erfolgt zur Erfüllung der Vereinsorganisation auf Grundlage von:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Art. 6 Abs. 1 lit. b DSGVO – Erfüllung eines mitgliedschaftsähnlichen Verhältnisses</li>
          <li>Art. 6 Abs. 1 lit. a DSGVO – Einwilligung (z. B. bei optionalen Funktionen wie Profilbild oder Push-Nachrichten)</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO – berechtigtes Interesse an der Vereinsorganisation</li>
        </ul>
      </Section>

      <Section title="4a. Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO)">
        <p>
          Sportärztliche Atteste und ähnliche Gesundheitsdokumente stellen besondere Kategorien personenbezogener Daten im Sinne von Art. 9 DSGVO dar. Diese Daten werden nur auf ausdrückliche Veranlassung des Mitglieds – oder bei Mitgliedern unter 14 Jahren durch die Erziehungsberechtigten – hochgeladen.
        </p>
        <p>
          Die Verarbeitung erfolgt auf Grundlage der ausdrücklichen Einwilligung gemäß Art. 9 Abs. 2 lit. a DSGVO. Bei Mitgliedern, die das 14. Lebensjahr noch nicht vollendet haben, ist die Einwilligung der Erziehungsberechtigten erforderlich (§ 4 Abs. 4 DSG); ab dem vollendeten 14. Lebensjahr können Mitglieder selbst einwilligen.
        </p>
        <p>
          Die Einwilligung kann jederzeit widerrufen werden (Kontakt: <a href="mailto:herman.urban@live.com" className="text-blue-400 hover:underline">herman.urban@live.com</a>). Gesundheitsdaten sind ausschließlich für Trainer und Administratoren des jeweiligen Vereins einsehbar.
        </p>
      </Section>

      <Section title="5. Daten Minderjähriger">
        <p>
          SwimBase ermöglicht die Verwaltung von Mitgliedern unter 18 Jahren. Für die Einwilligung in die Datenverarbeitung Minderjähriger gilt nach österreichischem Recht (§ 4 Abs. 4 DSG):
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-white">Mitglieder unter 14 Jahren:</strong> Die Einwilligung ist ausschließlich durch die erziehungsberechtigten Elternteile zu erteilen. Trainer und Administratoren des Vereins können diese Einwilligung nicht stellvertretend erteilen.</li>
          <li><strong className="text-white">Mitglieder ab 14 Jahren:</strong> Diese können selbst in die Verarbeitung ihrer personenbezogenen Daten einwilligen.</li>
        </ul>
        <p>
          Daten Minderjähriger werden ausschließlich für die Vereinsorganisation verarbeitet und nicht an Dritte weitergegeben. Profilbilder von Minderjährigen sind nur innerhalb der App für Vereinsmitglieder sichtbar.
        </p>
      </Section>

      <Section title="6. Speicherdauer">
        <p>
          Personenbezogene Daten werden nur so lange gespeichert, wie dies für die genannten Zwecke erforderlich ist. Nach Beendigung der Vereinsmitgliedschaft werden personenbezogene Daten innerhalb von 12 Monaten gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Auf begründeten Antrag erfolgt die Löschung unverzüglich (Kontakt: <a href="mailto:herman.urban@live.com" className="text-blue-400 hover:underline">herman.urban@live.com</a>).
        </p>
      </Section>

      <Section title="7. Weitergabe an Dritte">
        <p>
          Eine Weitergabe der Daten an Dritte erfolgt nicht, außer dies ist gesetzlich vorgeschrieben oder zur Vertragserfüllung notwendig (z. B. Wettkampfanmeldungen bei Schwimmverbänden, sofern vom Nutzer veranlasst).
        </p>
      </Section>

      <Section title="8. Hosting">
        <p>
          Diese Anwendung wird auf Servern der Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland gehostet. Mit Hetzner besteht ein Auftragsverarbeitungsvertrag gemäß Art. 28 DSGVO.
        </p>
      </Section>

      <Section title="9. Ihre Rechte">
        <p>Sie haben jederzeit das Recht auf:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Auskunft über gespeicherte Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
          <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
          <li>Widerruf einer erteilten Einwilligung (Art. 7 Abs. 3 DSGVO)</li>
          <li>Beschwerde bei der österreichischen Datenschutzbehörde (<a href="https://www.dsb.gv.at" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">www.dsb.gv.at</a>)</li>
        </ul>
        <p>Zur Ausübung Ihrer Rechte: <a href="mailto:herman.urban@live.com" className="text-blue-400 hover:underline">herman.urban@live.com</a></p>
      </Section>

      <Section title="10. Cookies und technische Daten">
        <p>
          SwimBase verwendet ausschließlich technisch notwendige Cookies/Session-Daten zur Aufrechterhaltung der Anmeldung (Login-Sitzung). Es werden keine Tracking- oder Analyse-Cookies von Drittanbietern eingesetzt.
        </p>
      </Section>

      <Section title="11. Push-Benachrichtigungen">
        <p>
          Sofern Sie Push-Benachrichtigungen aktivieren, werden hierfür technische Gerätekennungen gespeichert, um Ihnen Benachrichtigungen (z. B. zu Trainingsterminen oder Dokumentenabläufen) zusenden zu können. Diese Funktion ist freiwillig und kann jederzeit in den App- oder Geräteeinstellungen deaktiviert werden.
        </p>
      </Section>

      <Section title="12. Änderungen dieser Datenschutzerklärung">
        <p>
          Diese Datenschutzerklärung kann bei Weiterentwicklung der App angepasst werden. Die jeweils aktuelle Version finden Sie auf dieser Seite.
        </p>
      </Section>
    </div>
  )
}
