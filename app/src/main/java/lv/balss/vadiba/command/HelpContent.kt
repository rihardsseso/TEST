package lv.balss.vadiba.command

/** Example commands shown in the app. Every example is checked by the unit tests. */
object HelpContent {

    data class Section(val title: String, val examples: List<String>, val note: String? = null)

    val sections = listOf(
        Section(
            "Zvani un ziņas",
            listOf(
                "Piezvani mammai", "Zvani 26123456", "Sūti īsziņu Jānim, ka kavēšos",
                "Sūti WhatsApp Annai sveika, kā iet?", "Atbildi", "Noliec",
            ),
        ),
        Section(
            "Lietotnes",
            listOf("Atver WhatsApp", "Palaid Spotify", "Atver kalkulatoru", "Atver kartes", "Uzņem foto", "Uzņem video"),
        ),
        Section(
            "Ekrāna vadība",
            listOf(
                "Atpakaļ", "Sākums", "Nesenās lietotnes", "Paziņojumi", "Ritini uz leju", "Ritini uz augšu",
                "Spied Iestatījumi", "Raksti sveiks, kā iet?", "Ekrānuzņēmums", "Bloķē ekrānu",
            ),
            note = "Vajag ieslēgt ekrāna vadību (pieejamības pakalpojumu).",
        ),
        Section(
            "Telefona iestatījumi",
            listOf(
                "Ieslēdz lukturīti", "Izslēdz lukturīti", "Skaļāk", "Klusāk", "Skaļums 50 procenti",
                "Klusais režīms", "Vibrācija", "Ieslēdz netraucēt", "Spilgtums 70", "Atver Wi-Fi", "Bluetooth",
            ),
        ),
        Section(
            "Laiks un atgādinājumi",
            listOf(
                "Cik pulkstenis?", "Kāds šodien datums?", "Uzliec modinātāju uz 7:30", "Pamodini mani pusastoņos",
                "Taimeris 5 minūtes", "Atgādini man pēc 20 minūtēm", "Cik ir baterija?",
            ),
        ),
        Section(
            "Internets, kartes un mūzika",
            listOf(
                "Meklē picērijas Rīgā", "Kāds laiks rīt?", "Kas ir Rīgas Doms?", "Meklē YouTube kaķi",
                "Navigē uz Brīvības iela 1, Rīga", "Parādi kartē Siguldu", "Atskaņo Prāta Vētra",
                "Pauze", "Nākamā dziesma",
            ),
        ),
        Section("Cits", listOf("Palīdzība", "Beidz")),
    )
}
