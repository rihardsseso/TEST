# Kalendāra logrīks (Windows)

Caurspīdīgs Google kalendāra logrīks darbvirsmai. Rāda tuvāko dienu notikumus, ļauj pieslēgties ar
savu Google kontu un iestatīt gan visa fona, gan katra notikuma atsevišķu caurspīdīgumu.

## Lejupielāde

**[Releases → kalendars-latest](../../../releases/tag/kalendars-latest)** → `KalendaraLogriks.exe`.
Tā ir portatīva programma — instalēšana nav vajadzīga, vienkārši palaid. Windows SmartScreen var
brīdināt par nezināmu izdevēju — spied **Vairāk informācijas → Tik un tā palaist**.

## Iespējas

- **Pieslēgšanās ar Google kontu** — atveras pārlūks, tu pieslēdzies un atļauj kalendāra lasīšanu.
  Logrīks atceras pieslēgšanos (atslēga glabājas šifrēta ar Windows DPAPI).
- **Fona caurspīdīgums** (0–100 %) — kad fons ir gandrīz caurspīdīgs, tekstam tiek pievienota ēna.
- **Notikumu caurspīdīgums** — noklusējuma vērtība visiem notikumiem un **individuāla katram
  notikumam**: uzklikšķini uz notikuma un pavelc slīdni. Atkārtotiem notikumiem var izvēlēties
  “Visiem šī atkārtotā notikuma datumiem”. Notikumi ar savu iestatījumu ir atzīmēti ar ◐.
- 1–30 dienu skats, kalendāru izvēle, tumša/gaiša tēma, “vienmēr virspusē” (📌), palaišana kopā ar
  Windows, automātiska atjaunošana ik pēc 5 min (vai F5).
- Logu var pārvilkt aiz virsraksta un mainīt izmēru ar labo apakšējo stūri; pozīcija tiek atcerēta.

## Google OAuth klients (vienreizēja iestatīšana)

Google neļauj programmām lasīt kalendāru bez reģistrēta “OAuth klienta”. Tas ir bezmaksas:

1. Atver <https://console.cloud.google.com/>, izveido jaunu projektu.
2. **APIs & Services → Library** → atrodi **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform): User type **External**,
   aizpildi nosaukumu un e-pastu. Sadaļā **Audience** pievieno savu Gmail adresi pie **Test users**
   (vai spied **Publish app**, lai pieslēgšanās nebeigtos pēc 7 dienām — tad Google rādīs brīdinājumu
   “Google hasn't verified this app”, spied **Advanced → Go to …**).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**, Application type:
   **Desktop app**. Lejupielādē JSON failu.
5. Logrīkā spied **Ielādēt client_secret…json failu** un izvēlies lejupielādēto failu
   (vai iekopē Client ID un Client secret manuāli). Tad — **Pieslēgties ar Google**.

Alternatīva: nolikt lejupielādēto failu ar nosaukumu `oauth-client.json` blakus
`KalendaraLogriks.exe` — tad logrīks to atradīs pats.

## Izstrāde

```bash
cd calendar-widget
npm install
npm start        # palaiž logrīku
npm test         # testi
npm run dist     # uzbūvē dist/KalendaraLogriks.exe (uz Windows; Linux vajag wine)
```

`.exe` automātiski būvē GitHub Actions (`.github/workflows/calendar-widget.yml`) uz Windows un
publicē relīzē `kalendars-latest`.
