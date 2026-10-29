# Balss vadība

> Repozitorijā ir arī **[Būvplāns](buvplans/)** — tiešsaistes ēku un telpu plānotājs pārlūkā (2D plāns, 3D, sienu skati, aprēķini, PDF albums).

Android lietotne, ar kuru telefonu var pārvaldīt ar balsi latviešu (vai angļu) valodā:
zvanīt, sūtīt ziņas, atvērt lietotnes, ieslēgt lukturīti, mainīt skaļumu, uzlikt modinātāju,
meklēt internetā, navigēt, vadīt mūziku un arī pašu ekrānu — “atpakaļ”, “sākums”, “ritini uz leju”,
“spied Iestatījumi”, “raksti sveiks”.

## Instalēšana

1. Telefonā atver **[Releases → latest](../../releases/latest)** un lejupielādē `BalssVadiba.apk`.
2. Atver lejupielādēto failu. Ja telefons jautā, atļauj instalēt lietotnes no pārlūka / failu pārvaldnieka.
   Google Play Protect var brīdināt par nezināmu lietotni — izvēlies “Tik un tā instalēt”.
3. Atver **Balss vadība** un atļauj mikrofonu (un, ja vēlies, zvanus un kontaktus).
4. Sadaļā *Iestatīšana* nospied **Ieslēgt** pie “Ekrāna vadība” un pieejamības iestatījumos ieslēdz
   “Balss vadība”. Tas vajadzīgs ekrāna komandām un peldošajai mikrofona pogai.
   - Android 13+: ja slēdzis ir pelēks (“Ierobežots iestatījums”), atver **Lietotnes info → ⋮ → Atļaut
     ierobežotos iestatījumus** un mēģini vēlreiz.

Runas atpazīšanu veic telefona runas pakalpojums (parasti Google lietotne), tāpēc vajag internetu un
Google lietotnē pieejamu latviešu valodu.

## Kā sākt klausīties

- Lielā mikrofona poga lietotnē.
- Peldošā mikrofona poga virs visām lietotnēm (to var pārvilkt).
- Ātro iestatījumu flīze “Balss komanda”.
- Ilgi turi lietotnes ikonu → “Klausīties”.
- Bluetooth austiņu poga (ilgi turot) vai pieejamības poga.

Iestatījumos var ieslēgt **nepārtrauktu klausīšanos** — pēc katras komandas lietotne klausās atkal,
līdz pasaki “beidz”. Tā var izpildīt komandu ķēdes: “Atver WhatsApp” → “Spied Jānis” →
“Raksti būšu pēc 10 minūtēm” → “Spied sūtīt”.

## Ko var teikt

| Joma | Piemēri |
|---|---|
| Zvani un ziņas | “Piezvani mammai”, “Zvani 26123456”, “Sūti īsziņu Jānim, ka kavēšos”, “Sūti WhatsApp Annai sveika”, “Atbildi”, “Noliec” |
| Lietotnes | “Atver WhatsApp”, “Palaid Spotify”, “Atver kalkulatoru”, “Uzņem foto”, “Uzņem video” |
| Ekrāns | “Atpakaļ”, “Sākums”, “Nesenās lietotnes”, “Paziņojumi”, “Ritini uz leju”, “Spied Iestatījumi”, “Raksti …”, “Ekrānuzņēmums”, “Bloķē ekrānu” |
| Iestatījumi | “Ieslēdz lukturīti”, “Skaļāk”, “Skaļums 50 procenti”, “Klusais režīms”, “Vibrācija”, “Ieslēdz netraucēt”, “Spilgtums 70”, “Atver Wi-Fi”, “Bluetooth” |
| Laiks | “Cik pulkstenis?”, “Kāds šodien datums?”, “Uzliec modinātāju uz 7:30”, “Pamodini mani pusastoņos”, “Taimeris 5 minūtes”, “Cik ir baterija?” |
| Internets un mūzika | “Meklē picērijas Rīgā”, “Kāds laiks rīt?”, “Meklē YouTube kaķi”, “Navigē uz Brīvības iela 1, Rīga”, “Atskaņo Prāta Vētra”, “Pauze”, “Nākamā dziesma” |

Pilns saraksts ir lietotnē sadaļā *Ko var teikt*, vai saki “palīdzība”.

## Ierobežojumi

- Nav “vienmēr klausās” atslēgvārda (kā “Hey Google”) — klausīšanos sāk ar pogu, flīzi vai austiņām.
- Android 10+ neļauj lietotnēm pašām ieslēgt Wi-Fi vai Bluetooth, tāpēc tiek atvērts attiecīgais panelis.
- Īsziņas un WhatsApp ziņas tiek sagatavotas, bet “Sūtīt” jānospiež pašam (vai jāsaka “spied sūtīt”).
- Zvana laikā mikrofonu aizņem zvans, tāpēc balss komandas tad nedarbojas.
- 8 ciparu numuri WhatsApp ziņām tiek uzskatīti par Latvijas numuriem (+371).

## Izstrāde

Kotlin, bez ārējām bibliotēkām, minSdk 26 (Android 8.0). Komandu atpazīšana (`app/src/main/java/lv/balss/vadiba/command`)
ir tīrs Kotlin kods ar vienībtestiem.

```bash
./gradlew testDebugUnitTest assembleDebug
```

Katrs `push` uz GitHub uzbūvē APK (GitHub Actions) un publicē to kā laidienu `latest`.
APK ir parakstīts ar repozitorijā esošo atkļūdošanas atslēgu (`keystore/debug.keystore`), lai jaunas versijas
varētu instalēt pāri vecajām. Tā ir publiska atslēga — izplatīšanai Google Play vajadzētu savu, slepenu atslēgu.
