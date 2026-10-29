# Būvplāns

Tiešsaistes ēku un telpu plānotājs pārlūkā. Idejas un funkciju kopums ņemts no
[Remplanner](https://remplanner.com/planner/) plānotāja; kods un dizains ir pašu rakstīts.

## Ko var darīt

| Joma | Funkcijas |
|---|---|
| 2D plāns | Sienas ar piesaisti stūriem, sienām un 15° leņķiem; garuma ievade ar tastatūru (ieraksti `350` un Enter); telpa ar vienu vilcienu; durvis un logi; izmēru līnijas; teksti; režģis; tālummaiņa ar riteni vai diviem pirkstiem |
| Telpas | Automātiski veidojas no slēgtiem sienu kontūriem (arī T un krustojuma savienojumos), tīrais laukums bez sienām; pārvietojot sienu, telpa pielāgojas |
| Katalogs | ~35 mēbeles, virtuves un santehnikas iekārtas, rozetes, slēdži, gaismekļi; priekšmets pie sienas pats pagriežas ar aizmuguri pret to |
| 3D | Automātisks modelis ar ailēm, logiem, durvīm, grīdas segumu un sienu apdares krāsām; visi stāvi vienlaikus; "zemas sienas" režīms; attēla eksports |
| Sienu skati | Katras telpas sienu attīstījumi ar ailēm, mēbelēm un elektrības punktu augstumiem |
| Aprēķini | Laukumi, perimetri, tilpumi, sienu laukums bez ailēm, griesti, grīdlīstes, palodzes, mūra apjoms, elektrības punkti, specifikācija; CSV |
| Albums | A4 lapas ar zīmoga lauku: titullapa, plāni ar izmēriem, telpu eksplikācija, 3D, sienu skati, specifikācija; drukā vai saglabā PDF |
| Stāvi un varianti | Jauns stāvs manto ārsienas; plānojuma variants ir neatkarīga stāva kopija |
| Projekti | Glabājas pārlūkā, mapes un statusi, dublēšana, JSON imports/eksports; fona attēls (skenēts plāns) pārzīmēšanai |

## Palaišana

Nav būvēšanas soļa — tikai statiski faili. ES moduļiem vajag HTTP serveri:

```bash
cd buvplans && python3 -m http.server 8000
```

Tad atver <http://localhost:8000>. Three.js tiek ielādēts no jsDelivr, tāpēc 3D skatam vajag internetu.

Mapi `buvplans/` var publicēt jebkurā statiskā hostingā (GitHub Pages, Netlify u. c.).

## Īsinājumtaustiņi

`V` atlasīt · `W` siena · `K` telpa · `D` durvis · `L` logs · `M` izmērs · `T` teksts ·
`R` pagriezt · `Del` dzēst · `Ctrl+Z` / `Ctrl+Y` · `Ctrl+D` dublēt · `0` rādīt visu · `Esc` beigt.

## Struktūra

- `js/geometry.js` — plaknes ģeometrija
- `js/model.js` — datu modelis, atsaukšana
- `js/rooms.js` — telpu noteikšana no sienām
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
