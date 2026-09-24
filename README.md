# AppDev Buchhaltung

Progressive Web App für die Buchhaltung von App-Entwicklern (Einzelunternehmer, EÜR, Deutschland).

## Funktionsumfang (MVP)

| Bereich | Umsetzung |
|---|---|
| Import | Apple-Finanzbericht (App Store Connect) und Google-Play-Earnings-Report, Summierung je Währung |
| Umsatzsteuer | Erlöse an Apple/Google als sonstige Leistung an EU-Unternehmer (Kz 21 + ZM), §13b für Developer-Programm/SaaS (Kz 46/47, 52/53, 67), Inlandsumsätze, Kleinunternehmer, Ist-/Sollversteuerung |
| Währungen | Monatskurse nach §16 Abs. 6 UStG für die Bemessungsgrundlage, tatsächlicher Zufluss laut Kontoauszug für die EÜR |
| Journal | Manuelle Buchungen, Storno statt Löschen, SHA-256-Hash-Kette mit Integritätsprüfung (GoBD) |
| Auswertungen | EÜR (Zufluss-/Abflussprinzip, Bruttomethode), UStVA-Kennzahlen je Monat/Quartal, Zusammenfassende Meldung |
| Export | CSV (Semikolon, Excel-kompatibel) inkl. Hashes |
| Betrieb | Installierbar, offlinefähige App-Shell (Service Worker), Cloud-Speicher über Supabase oder lokal im Browser |

Nicht enthalten: ELSTER-/BZSt-Übermittlung, Bankanbindung, Belegupload/OCR, AfA, DATEV-Export.

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Unit-Tests (Vitest)
npm run build      # Typecheck + Produktionsbuild nach dist/
```

Ohne Supabase-Konfiguration läuft die App im lokalen Modus (Daten nur in diesem Browser).

## Cloud-Betrieb (Supabase)

1. Supabase-Projekt in Region **EU (Frankfurt)** anlegen.
2. SQL aus `supabase/migrations/0001_init.sql` im SQL-Editor ausführen (oder `supabase db push`).
3. Authentication → URL Configuration: Site-URL der deployten App eintragen (Magic-Link-Login).
4. `.env.example` nach `.env` kopieren, `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` setzen.
5. `npm run build` und `dist/` auf einem statischen Hoster deployen (Cloudflare Pages, Netlify, Vercel); dort dieselben Umgebungsvariablen setzen.

Datenbankseitig ist das Journal append-only: Trigger blockieren `UPDATE`/`DELETE` und prüfen die Hash-Verkettung, Row Level Security trennt die Nutzerdaten.

## Architektur

```
src/domain/      Fachlogik ohne UI (Beträge in Cent, USt-Fälle, Hash-Kette, EÜR, UStVA/ZM)
src/importers/   Parser für Apple- und Google-Berichte, Umrechnung in Buchungen
src/storage/     Repo-Schnittstelle, LocalRepo (Browser), SupabaseRepo (Cloud)
src/pages/       React-Oberfläche
supabase/        Datenbankschema
```

## Hinweis

Keine Steuerberatung. Die steuerliche Logik ist vor produktivem Einsatz mit einem Steuerberater abzustimmen, insbesondere Kleinunternehmerregelung (ZM-Pflicht), Tax-Zeilen in Google-Berichten und die hinterlegten USt-IdNrn. von Apple und Google.
