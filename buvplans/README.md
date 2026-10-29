# Būvplāns

Tiešsaistes ēku un telpu plānotājs pārlūkā. Idejas un funkciju kopums ņemts no
[Remplanner](https://remplanner.com/planner/) plānotāja; kods un dizains ir pašu rakstīts.

## Ko var darīt

Saskarne un rīku kopums veidoti pēc Remplanner plānotāja: rīku rinda ar 2D / Sienas / 3D, 24 darba lapas,
tumša kreisā josla, kas, uzvirzot peli, izvēršas ar nosaukumiem, grupu saraksti ar saliekamām sadaļām un
priekšskatu („acs”), objektu meklēšana, panelis „Konfigurācija” aktīvajam rīkam, stāvu un variantu izvēlnes,
apakšējā josla ar mērvienībām, pārslēgiem, rīkiem un tālummaiņu. Visi rīki ir bez maksas; zīmolu preces nav iekļautas.

| Joma | Funkcijas |
|---|---|
| Lapas | Pamatplāns · Demontāža · Starpsienas · Telpas · Apkure · Mēbeles · Santehnika · Ūdensapgāde · Rozetes · Slēdži · Apgaismojums · Elektroinstalācija · Sadales skapis · Siltās grīdas · Kondicionēšana · Ventilācija · Drošība · Grīdas segumi · Sienu apdare · Griesti · Hidroizolācija · Izolācija · Apmetums · Grīdas klons; „Pievienot lapu” — sava lapa piezīmēm |
| Katalogs | ~1270 priekšmetu 67 grupās (mēbeles 15 telpu veidiem, santehnika, radiatori, rozetes, slēdži, gaismekļi, kondicionieri, ventilācija, drošība, sadalnes moduļi u. c.) |
| Pamatplāns | Sienas un balkons ar biezuma un materiāla konfigurāciju (bloki, ķieģeļi, betons, ģipškartons, koks, stikls…), logi (arī balkona bloks, franču logi), 17 durvju veidi, kolonnas, sijas, kāpnes, stāvvadi un ventilācijas šahtas, grīdas atvērumi, terase un zemes gabals |
| Demontāža | Visa siena vai posms, ailes, radiatori, sadalne; demontāžas atcelšana |
| Inženiertīkli | Kabeļi (220 V, vājstrāva, zemējums, LED), ūdens un kanalizācijas caurules, apkures caurules, gāze, gaisa vadi (plakani/apaļi ar standarta izmēriem), siltās grīdas zonas (kabelis, IR plēve, ūdens) |
| Apdare | Grīdas segumi (arī zonās), grīdlīstes, sienu apdare katrai sienas pusei, griesti un līstes, hidroizolācija, izolācija, apmetums, klons ar biezumu |
| Sadales skapis | DIN sliedes (automātisks vai fiksēts platums), automātslēdži, releji, spailes, atdalītāji, kopnes, krāsaini savienojuma vadi; moduļa grupa, nominālvērtība, komentārs |
| Grīdas un telpas | Nav atsevišķi objekti: kontūrs izriet no sienām un mainās līdzi; telpas zonējums ar virtuālām sienām |
| Izmēri un sasaiste | Izmēri katrai sienas virsmai nepazūd, dzēšot sienu; mainot ārsienu, piestiprinātās iekšsienas un ailes seko līdzi |
| Apakšējā josla | cm / mm / m / in, atsaukt/atkārtot, dzēst, dzēšgumija, padomi, magnēti, rādīt/slēpt elementus, izmērs, figūra, komentārs, attēls, centrēt, pagriezt/apgriezt projektu, notīrīt, programmas iestatījumi (rozešu un kārbu augstums, krāsas, kompakts lapu panelis) |
| 3D, sienu skati | Automātisks modelis ar ailēm un apdares krāsām; sienu attīstījumi ar elektrības un ūdens punktu augstumiem |
| Aprēķini | Laukumi, sienas bez ailēm, materiāli un bloku skaits, apdare pa materiāliem, caurules/kabeļi metros, zonas, specifikācija; CSV |
| Albums | Titullapa, plāns katrai lapai, kurā ir saturs, eksplikācija, 3D, sienu skati, specifikācija, sadales skapis; drukā vai saglabā PDF |
| Eksports | .plan fails (lejupielāde/augšupielāde), PDF albums, PNG un SVG plāns |
| Stāvi un varianti | Jauns stāvs manto nesošās sienas; plānojuma variants ir neatkarīga kopija |

## Palaišana

Nav būvēšanas soļa — tikai statiski faili. ES moduļiem vajag HTTP serveri:

```bash
cd buvplans && python3 -m http.server 8000
```

Tad atver <http://localhost:8000>. Three.js tiek ielādēts no jsDelivr, tāpēc 3D skatam vajag internetu.

Mapi `buvplans/` var publicēt jebkurā statiskā hostingā (GitHub Pages, Netlify u. c.).

## Īsinājumtaustiņi

`V` atlasīt · `W` siena · `D` durvis · `L` logs · `M` izmērs · `T` komentārs · `E` dzēšgumija ·
`R` pagriezt · `Del` dzēst · `Ctrl+Z` / `Ctrl+Y` · `Ctrl+D` kopija · `0` centrēt · `Esc` vai labā poga — izslēgt rīku.

## Struktūra

- `js/geometry.js` — plaknes ģeometrija
- `js/model.js` — datu modelis, atsaukšana, piestiprināto sienu sekošana
- `js/catalog-data.js` — ģenerēts katalogs: lapas, rīki, grupas, priekšmeti, līniju/zonu veidi, apdare
- `js/catalog.js` — priekšmetu simboli 2D un 3D
- `js/stages.js` — darba lapas un to redzamības noteikumi
- `js/leftbar.js` — kreisā josla, grupu saraksti, meklēšana, konfigurācija
- `js/shield.js` — sadales skapja konstruktors
- `js/icons.js` — rīku ikonas
- `js/rooms.js` — grīdu/telpu kontūri no sienām un automātiska sinhronizācija
- `js/dims.js` — automātiskie izmēri katrai sienas virsmai
- `js/walls.js` — sienu materiāli, standarta biezumi un šķērssvītrojumi
- `js/calc.js` — apjomu aprēķini
- `js/elevations.js` — sienu skati (SVG)
- `js/draw2d.js`, `js/editor2d.js` — plāna zīmēšana un rīki
- `js/view3d.js` — 3D skats (three.js)
- `js/album.js` — albuma lapas
- `js/main.js` — lietotnes saskarne

Testi (Node 20+):

```bash
node --test buvplans/tests/*.test.mjs
```
