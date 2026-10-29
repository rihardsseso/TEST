# Būvplāns

Tiešsaistes ēku un telpu plānotājs pārlūkā. Idejas un funkciju kopums ņemts no
[Remplanner](https://remplanner.com/planner/) plānotāja; kods un dizains ir pašu rakstīts.

## Ko var darīt

Saskarne veidota pēc Remplanner plānotāja parauga: rīku rinda ar 2D / Sienas / 3D, darba stadiju cilnes,
tumša rīkjosla kreisajā pusē, stāvu un variantu izvēlnes, apakšējā josla ar mērvienībām, pārslēgiem un tālummaiņu.

| Joma | Funkcijas |
|---|---|
| Stadijas | Pamatplāns → Demontāža → Starpsienas → Telpas → Apkure → Mēbeles → Santehnika → Ūdensapgāde → Rozetes → Slēdži → Apgaismojums → Elektroinstalācija; katrai stadijai savi rīki un katalogs, pārējais plānā fonā |
| 2D plāns | Sienas ar piesaisti stūriem, sienām un 15° leņķiem; garuma ievade ar tastatūru (ieraksti `350` un Enter); telpa ar vienu vilcienu; durvis un logi; izmēru līnijas; teksti; režģis; tālummaiņa ar riteni vai diviem pirkstiem |
| Grīdas un telpas | Nav atsevišķi objekti: kontūrs vienmēr izriet no sienām (arī T un krustojuma savienojumos) un mainās līdzi, kad sienu pārvieto, pagarina, dzēš vai nojauc; telpai iestata nosaukumu, grīdas materiālu (parkets, lamināts, flīzes u. c.), sienu apdari un griestu augstumu |
| Rasējuma stils | Svītrotas nesošās sienas, baltas starpsienas, sarkanas nojaucamās, sarkanas H= / S= birkas |
| Izmēri | Rēķina katrai sienas virsmai no pašām sienām un ailēm: iekšējās virsmas — skaitļi gar sienu, ārējās — izmēru ķēde; nepazūd, ja telpa pēc sienas dzēšanas vairs nav noslēgta |
| Sienu sasaiste | Mainot ārsienas garumu vai leņķi (stūra vilkšana, sienas vilkšana, garuma ievade), tai piestiprinātās iekšsienas un ailes seko līdzi, saglabājot attālumu līdz tuvākajam stūrim; iekšsienas pārbīdās paralēli kopā ar savām piestiprinātajām sienām |
| Katalogs | ~50 priekšmeti: mēbeles, virtuve, santehnika, radiatori, ūdens izvadi, rozetes, slēdži, gaismekļi, sadalne; priekšmets pie sienas pats pagriežas ar aizmuguri pret to; elektroinstalācijas vadi |
| 3D | Automātisks modelis ar ailēm, logiem, durvīm, grīdas segumu un sienu apdares krāsām; visi stāvi vienlaikus; "zemas sienas" režīms; attēla eksports |
| Sienu skati | Katras telpas sienu attīstījumi ar ailēm, mēbelēm un elektrības punktu augstumiem |
| Aprēķini | Laukumi, perimetri, tilpumi, sienu laukums bez ailēm, griesti, grīdlīstes, palodzes, mūra apjoms, elektrības punkti, specifikācija; CSV |
| Albums | A4 lapas ar zīmoga lauku: titullapa, plāni pa stadijām (esošā situācija, demontāža, starpsienas, grīdas, mēbeles, santehnika, apkure, elektrība), telpu eksplikācija, 3D, sienu skati, specifikācija; drukā vai saglabā PDF |
| Stāvi un varianti | Izvēlnes „1. stāvs” un „1. variants”; jauns stāvs manto nesošās sienas; plānojuma variants ir neatkarīga stāva kopija |
| Projekti | Glabājas pārlūkā, mapes un statusi, dublēšana, JSON imports/eksports; fona attēls (skenēts plāns) pārzīmēšanai |

## Palaišana

Nav būvēšanas soļa — tikai statiski faili. ES moduļiem vajag HTTP serveri:

```bash
cd buvplans && python3 -m http.server 8000
```

Tad atver <http://localhost:8000>. Three.js tiek ielādēts no jsDelivr, tāpēc 3D skatam vajag internetu.

Mapi `buvplans/` var publicēt jebkurā statiskā hostingā (GitHub Pages, Netlify u. c.).

## Īsinājumtaustiņi

`V` atlasīt · `W` siena · `K` telpa · `D` durvis · `L` logs · `M` izmērs · `T` teksts · `X` demontēt · `E` vads ·
`R` pagriezt · `Del` dzēst · `Ctrl+Z` / `Ctrl+Y` · `Ctrl+D` dublēt · `0` rādīt visu · `Esc` beigt.

## Struktūra

- `js/geometry.js` — plaknes ģeometrija
- `js/model.js` — datu modelis, atsaukšana, piestiprināto sienu sekošana
- `js/stages.js` — darba stadijas un to redzamības noteikumi
- `js/rooms.js` — grīdu/telpu kontūri no sienām un automātiska sinhronizācija
- `js/dims.js` — automātiskie izmēri katrai sienas virsmai
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
