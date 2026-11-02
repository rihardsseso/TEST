# C4D kameras kalibrācija – `maja.jpg`

| Parametrs | Vērtība |
|---|---|
| Izšķirtspēja | 1581 × 1186 px |
| Sensors (Film Gate) | 36 mm |
| Fokusa attālums | **22.5 mm** (988 px, HFOV ≈ 77°) |
| Kameras pozīcija | X 0, **Y 160 cm**, Z −795 cm |
| Rotācija | H ≈ 31.5° (pret sienas normāli), P ≈ 0°, B 0° |
| Izzušanas punkti | VP1 (−824, 596), VP2 (1395, 596) |

Pasaule: zeme Y=0, garā siena plaknē Z=0 (iet pa X asi). Mērogs pieņemts pēc kameras
augstuma 160 cm – pārbaudei logs sanāk ~124 cm augsts. Ja zini reālu izmēru, mērogo visu ainu.

Lietošana: Cinema 4D → Extensions → Script Manager → atver `c4d_kamera_kalibracija.py` → Execute.
Skripts izveido kameru, uzstāda render izmēru, foto fonu un sienas/zemes palīgplaknes.

`parbaude_rezgis.jpg` – 1 m režģis uz sienas (ciāns) un zemes (violets), projicēts ar šo kameru.
`aprekins_solve.py` – aprēķins (numpy + Pillow).
