package lv.balss.vadiba.command

import lv.balss.vadiba.command.Utterance.Companion.phrases

/**
 * Turns a recognised phrase (Latvian or English) into a [Command].
 *
 * Pure Kotlin with no Android APIs, so it is unit tested on the JVM. Matching happens in stages:
 * whole-phrase controls ("atpakaļ"), commands introduced by a verb ("zvani …", "meklē …"),
 * keyword commands ("ieslēdz lukturīti"), and finally "atver <lietotne>".
 */
object CommandParser {

    fun parse(text: String): Command {
        val u = stripFillers(Utterance.of(text))
        if (u.isEmpty()) return Command.Unknown(text.trim())
        return control(u) ?: introduced(u) ?: keywords(u) ?: openApp(u) ?: question(u) ?: Command.Unknown(u.text)
    }

    /** Recognisers return several guesses; take the first one that means something. */
    fun parseBest(alternatives: List<String>): Pair<String, Command> {
        for (alt in alternatives) {
            val command = parse(alt)
            if (command !is Command.Unknown) return alt to command
        }
        val first = alternatives.firstOrNull().orEmpty()
        return first to parse(first)
    }

    // ---- Fillers -------------------------------------------------------------------------

    private val LEADING_FILLERS = phrases(
        "lūdzu", "please", "hei", "hey", "ok", "okei", "labi", "nu", "klau", "telefon", "telefons",
        "vai tu vari", "vai tu varētu", "vai vari", "tu vari", "es gribu", "es gribētu", "gribu", "man vajag",
        "can you", "could you", "would you", "i want to",
    )
    private val TRAILING_FILLERS = phrases("lūdzu", "please", "paldies", "thanks", "thank you")

    private fun stripFillers(input: Utterance): Utterance {
        var u = input
        while (true) {
            val lead = LEADING_FILLERS.filter { u.startsWith(it) && u.size > it.size }.maxByOrNull { it.size }
            val trail = TRAILING_FILLERS.filter { u.endsWith(it) && u.size > it.size }.maxByOrNull { it.size }
            if (lead == null && trail == null) return u
            if (lead != null) u = u.drop(lead.size)
            if (trail != null && u.endsWith(trail) && u.size > trail.size) u = u.dropLast(trail.size)
        }
    }

    // ---- Whole-phrase controls -------------------------------------------------------------

    private val STOP = phrases(
        "beidz", "beigt", "beigas", "stop", "stopp", "pietiek", "atcel", "atcelt", "nevajag", "aizver", "aizvērt",
        "viss", "tas ir viss", "paldies", "cancel", "never mind", "exit", "close",
    )
    private val HELP = phrases(
        "palīdzība", "palīdzi", "palīgs", "ko tu proti", "ko tu vari", "ko tu māki", "ko es varu teikt",
        "ko var teikt", "komandas", "help", "what can you do", "commands",
    )
    private val ANSWER = phrases(
        "atbildi", "atbildēt", "atbildi uz zvanu", "pacel", "pacelt", "pacel klausuli", "pieņem zvanu",
        "answer", "answer call", "answer the call", "pick up",
    )
    private val END_CALL = phrases(
        "noliec", "nolikt", "noliec klausuli", "noliec zvanu", "beidz zvanu", "beigt zvanu", "pārtrauc zvanu",
        "noraidi", "noraidīt", "noraidi zvanu", "hang up", "end call", "end the call", "decline", "reject call",
    )
    private val GLOBAL = mapOf(
        GlobalAction.BACK to phrases(
            "atpakaļ", "ej atpakaļ", "iet atpakaļ", "atgriezies", "atgriezties", "solis atpakaļ", "back", "go back",
        ),
        GlobalAction.HOME to phrases(
            "sākums", "uz sākumu", "ej uz sākumu", "sākuma ekrāns", "sākumekrāns", "mājas", "uz mājām",
            "galvenais ekrāns", "home", "go home", "home screen",
        ),
        GlobalAction.RECENTS to phrases(
            "nesenās lietotnes", "nesenie", "pēdējās lietotnes", "atvērtās lietotnes", "pārslēdz lietotni",
            "recent apps", "recents", "switch apps",
        ),
        GlobalAction.NOTIFICATIONS to phrases(
            "paziņojumi", "paziņojumus", "parādi paziņojumus", "atver paziņojumus",
            "notifications", "show notifications", "open notifications",
        ),
        GlobalAction.QUICK_SETTINGS to phrases(
            "ātrie iestatījumi", "ātros iestatījumus", "atver ātros iestatījumus", "quick settings",
        ),
        GlobalAction.LOCK_SCREEN to phrases(
            "bloķē ekrānu", "bloķēt ekrānu", "bloķē telefonu", "aizslēdz ekrānu", "aizslēdz telefonu",
            "izslēdz ekrānu", "lock", "lock screen", "lock the screen", "lock phone", "lock the phone",
        ),
        GlobalAction.SCREENSHOT to phrases(
            "ekrānuzņēmums", "uzņem ekrānuzņēmumu", "ekrānšāviņš", "ekrāna attēls", "nofotografē ekrānu",
            "screenshot", "take a screenshot", "take screenshot",
        ),
        GlobalAction.POWER_DIALOG to phrases("barošanas izvēlne", "izslēgšanas izvēlne", "power menu"),
        GlobalAction.SPLIT_SCREEN to phrases("sadali ekrānu", "sadalīt ekrānu", "dalītais ekrāns", "split screen"),
    )
    private val SCROLL = mapOf(
        Direction.DOWN to phrases(
            "ritini uz leju", "ritini lejup", "ritini", "ritināt uz leju", "uz leju", "lejup", "lejā", "tālāk",
            "scroll down", "scroll", "down",
        ),
        Direction.UP to phrases(
            "ritini uz augšu", "ritini augšup", "ritināt uz augšu", "uz augšu", "augšup", "augšā", "scroll up", "up",
        ),
        Direction.LEFT to phrases("velc pa kreisi", "pavelc pa kreisi", "pa kreisi", "swipe left"),
        Direction.RIGHT to phrases("velc pa labi", "pavelc pa labi", "pa labi", "swipe right"),
    )
    private val MEDIA = mapOf(
        MediaAction.PAUSE to phrases(
            "pauze", "pauzi", "pauzē", "apturi", "apturēt", "apturi mūziku", "apturi dziesmu", "apstādini",
            "apstādini mūziku", "izslēdz mūziku", "pause", "pause music", "stop music", "stop the music",
        ),
        MediaAction.PLAY to phrases(
            "turpini", "turpināt", "turpini atskaņot", "atskaņo", "atskaņot", "spēlē", "ieslēdz mūziku",
            "play", "resume", "play music",
        ),
        MediaAction.NEXT to phrases(
            "nākamā", "nākamo", "nākamais", "nākamā dziesma", "nākamo dziesmu", "izlaid", "izlaid dziesmu", "pārlec",
            "next", "next song", "next track", "skip",
        ),
        MediaAction.PREVIOUS to phrases(
            "iepriekšējā", "iepriekšējo", "iepriekšējā dziesma", "iepriekšējo dziesmu",
            "previous", "previous song", "previous track",
        ),
    )

    private fun control(u: Utterance): Command? {
        if (u.isOneOf(STOP)) return Command.Stop
        if (u.isOneOf(HELP)) return Command.Help
        if (u.isOneOf(ANSWER)) return Command.AnswerCall
        if (u.isOneOf(END_CALL)) return Command.EndCall
        globalAction(u)?.let { return Command.Global(it) }
        SCROLL.forEach { (direction, p) -> if (u.isOneOf(p)) return Command.Scroll(direction) }
        MEDIA.forEach { (action, p) -> if (u.isOneOf(p)) return Command.Media(action) }
        return null
    }

    private fun globalAction(u: Utterance): GlobalAction? =
        GLOBAL.entries.firstOrNull { u.isOneOf(it.value) }?.key

    // ---- Commands introduced by a verb -----------------------------------------------------

    private fun introduced(u: Utterance): Command? =
        message(u) ?: navigation(u) ?: search(u) ?: play(u) ?: tap(u) ?: type(u) ?: call(u)

    private val SEND_VERBS = phrases(
        "sūti", "nosūti", "aizsūti", "sūtīt", "nosūtīt", "uzraksti", "raksti", "uzrakstīt",
        "send", "send a", "write", "write a",
    )
    private val SEND_ONLY = Text.words("sūti nosūti aizsūti sūtīt nosūtīt send").toSet()
    private val SMS_WORDS = Text.words("īsziņu īsziņa īsziņas sms esemesu ziņu ziņa ziņojumu message text").toSet()
    private val CHANNEL_FIRST = Text.words("sms īsziņa īsziņu text message").toSet()
    private val MESSAGE_SEPARATORS = phrases("ka", "lai", "ar tekstu", "ar ziņu", "teksts", "saying", "that")
    private val TO_WORDS = Text.words("uz to for priekš").toSet()

    private fun isWhatsApp(w: String) =
        w.startsWith("whatsap") || w.startsWith("vatsap") || w.startsWith("votsap") ||
            w.startsWith("vocap") || w.startsWith("vacap") || w == "whatsup"

    private fun message(u: Utterance): Command? {
        val afterVerb = u.after(SEND_VERBS)
        var rest = afterVerb ?: u
        var via: Messenger? = null
        while (!rest.isEmpty()) {
            val w = rest.words[0]
            val firstWord = afterVerb == null && via == null
            when {
                isWhatsApp(w) -> via = Messenger.WHATSAPP
                firstWord && w in CHANNEL_FIRST -> via = Messenger.SMS
                !firstWord && w in SMS_WORDS -> if (via == null) via = Messenger.SMS
                via != null && (w == "teksta" || w == "zinu" || w == "zina") -> Unit
                else -> break
            }
            rest = rest.drop(1)
        }
        // "Sūti Jānim, ka kavēšos" has no channel word: a plain "send" means a text message.
        if (via == null && afterVerb != null && u.words[0] in SEND_ONLY) via = Messenger.SMS
        if (via == null) return null
        if (rest.isEmpty()) return if (afterVerb != null) Command.SendMessage(via, "", null) else null
        if (rest.words[0] in TO_WORDS && rest.size > 1) rest = rest.drop(1)

        if (Text.isDigits(rest.words[0])) {
            var n = 0
            while (n < rest.size && Text.isDigits(rest.words[n])) n++
            val number = rest.slice(0, n).words.joinToString("")
            var text = rest.drop(n)
            if (text.startsWith(Text.words("ka")) || text.startsWith(Text.words("that"))) text = text.drop(1)
            return Command.SendMessage(via, number, text.text)
        }

        val separator = rest.indexOfAny(MESSAGE_SEPARATORS)
        if (separator != null && separator.first > 0) {
            val (at, length) = separator
            val recipient = Text.trimPunctuation(rest.slice(0, at).text)
            return Command.SendMessage(via, recipient, rest.drop(at + length).text)
        }
        val whole = rest.text
        val colon = whole.indexOf(':')
        if (colon > 0 && colon < whole.length - 1 && !whole[colon + 1].isDigit()) {
            return Command.SendMessage(via, Text.trimPunctuation(whole.substring(0, colon)), whole.substring(colon + 1).trim())
        }
        return Command.SendMessage(via, Text.trimPunctuation(whole), null)
    }

    private val NAVIGATE = phrases(
        "navigē uz", "navigē", "navigēt uz", "navigācija uz", "navigācija", "aizved mani uz", "aizved mani",
        "aizved uz", "aizvest uz", "brauc uz", "braucam uz", "braukt uz", "ved uz", "ceļš uz", "maršruts uz",
        "maršrutu uz", "kā nokļūt uz", "kā nokļūt līdz", "kā nokļūt", "kā aizbraukt uz", "kā aizbraukt",
        "navigate to", "navigate", "directions to", "take me to", "drive to", "how do i get to", "how to get to",
    )
    private val SHOW_MAP = phrases(
        "parādi kartē", "parādi uz kartes", "atrodi kartē", "kartē", "kur atrodas",
        "show on map", "show on the map", "show map of", "map of", "where is",
    )

    private fun navigation(u: Utterance): Command? {
        u.after(NAVIGATE)?.let { return Command.Navigate(Text.trimPunctuation(it.text)) }
        u.after(SHOW_MAP)?.takeUnless { it.isEmpty() }?.let { return Command.ShowMap(Text.trimPunctuation(it.text)) }
        return null
    }

    private val SEARCH = phrases(
        "meklē", "meklē internetā", "pameklē", "pameklē internetā", "sameklē", "meklēt", "atrodi", "atrast",
        "google", "googlē", "pagooglē", "search", "search for", "look up", "find", "google search",
    )
    private val QUESTION = phrases("kas ir", "kas bija", "kas tas ir", "kāpēc", "who is", "what is", "who was", "what was", "why")
    private val SEARCH_PLACE = Text.words("internetā googlē google tīmeklī on in for un and").toSet()

    private fun isYouTube(w: String) = w.startsWith("youtub") || w.startsWith("jutub") || w.startsWith("jutjub")

    private fun search(u: Utterance): Command? {
        if (u.size >= 2 && isYouTube(u.words[0])) return youtube(u.drop(1))
        val rest = u.after(SEARCH)
        if (rest != null) {
            var r: Utterance = rest
            if (!r.isEmpty() && isYouTube(r.words[0])) return youtube(r.drop(1))
            if (r.size >= 2 && isYouTube(r.words.last())) {
                r = r.dropLast(1)
                if (r.size > 1 && r.words.last() in SEARCH_PLACE) r = r.dropLast(1)
                return Command.YouTubeSearch(Text.trimPunctuation(r.text))
            }
            while (r.size > 1 && r.words[0] in SEARCH_PLACE) r = r.drop(1)
            return Command.WebSearch(Text.trimPunctuation(r.text))
        }
        return null
    }

    /** Questions nothing else understood ("Kas ir …?") go to a web search. */
    private fun question(u: Utterance): Command? =
        if (u.after(QUESTION)?.isEmpty() == false) Command.WebSearch(u.text) else null

    private fun youtube(rest: Utterance): Command {
        var r = rest
        while (r.size > 1 && r.words[0] in SEARCH_PLACE) r = r.drop(1)
        return if (r.isEmpty()) Command.OpenApp("YouTube") else Command.YouTubeSearch(Text.trimPunctuation(r.text))
    }

    private val PLAY = phrases(
        "atskaņo", "atskaņot", "spēlē", "spēlēt", "uzliec dziesmu", "uzliec mūziku", "ieslēdz dziesmu",
        "palaid dziesmu", "play", "play song", "play the song",
    )
    private val PLAY_FILLER = Text.words("dziesmu mūziku albumu grupu song music").toSet()

    private fun play(u: Utterance): Command? {
        var r = u.after(PLAY) ?: return null
        if (r.isEmpty()) return Command.Media(MediaAction.PLAY)
        while (r.size > 1 && r.words[0] in PLAY_FILLER) r = r.drop(1)
        if (isYouTube(r.words[0])) return youtube(r.drop(1))
        if (r.size >= 2 && isYouTube(r.words.last())) {
            r = r.dropLast(1)
            if (r.size > 1 && r.words.last() in SEARCH_PLACE) r = r.dropLast(1)
            return Command.YouTubeSearch(Text.trimPunctuation(r.text))
        }
        return Command.PlayMusic(Text.trimPunctuation(r.text))
    }

    private val TAP = phrases(
        "spied", "nospied", "piespied", "uzspied", "spiest", "nospiest", "klikšķini", "noklikšķini", "uzklikšķini",
        "pieskaries", "izvēlies", "atzīmē", "tap", "click", "press", "select",
    )
    private val TAP_FILLER = Text.words("uz pie pogu pogai on the button").toSet()

    private fun tap(u: Utterance): Command? {
        var r = u.after(TAP) ?: return null
        while (r.size > 1 && r.words[0] in TAP_FILLER) r = r.drop(1)
        if (r.isEmpty()) return null
        globalAction(r)?.let { return Command.Global(it) }
        return Command.Tap(Text.trimPunctuation(r.text))
    }

    private val TYPE = phrases(
        "raksti", "uzraksti", "ieraksti", "ievadi", "rakstīt", "ierakstīt", "ievadīt", "diktē", "type", "write", "enter",
    )

    private fun type(u: Utterance): Command? {
        val r = u.after(TYPE) ?: return null
        if (r.isEmpty()) return null
        if (r.words == listOf("video")) return Command.Camera(CameraMode.VIDEO)
        return Command.TypeText(r.text)
    }

    private val CALL = phrases(
        "piezvani", "piezvanīt", "zvani", "zvanīt", "izsauc", "izsaukt", "sazvani",
        "call", "phone", "dial", "make a call to",
    )
    private val CALL_FILLER = Text.words("uz numuru numurs to number").toSet()

    private fun call(u: Utterance): Command? {
        var r = u.after(CALL) ?: return null
        while (!r.isEmpty() && r.words[0] in CALL_FILLER) r = r.drop(1)
        if (!r.isEmpty() && Text.isDigits(r.words[0])) {
            return Command.Call(r.words.takeWhile(Text::isDigits).joinToString(""))
        }
        // "piezvani mammai pa WhatsApp / pa telefonu" – the channel is not needed for a normal call.
        if (r.size > 2 && r.words[r.size - 2] == "pa") r = r.dropLast(2)
        return Command.Call(Text.trimPunctuation(r.text))
    }

    // ---- Keyword commands ----------------------------------------------------------------

    private fun keywords(u: Utterance): Command? =
        timerOrAlarm(u) ?: weather(u) ?: clock(u) ?: battery(u) ?: flashlight(u) ?: doNotDisturb(u) ?: ringer(u) ?:
            volume(u) ?: brightness(u) ?: camera(u) ?: settings(u)

    private val ON = Text.words("ieslēdz ieslēgt ieslēdziet iededz iedegt on enable activate").toSet()
    private val OFF = Text.words("izslēdz izslēgt izslēdziet nodzēs nodzēst off disable deactivate").toSet()

    /** true = on, false = off, null = not said. */
    private fun onOff(u: Utterance): Boolean? = when {
        u.words.any { it in OFF } -> false
        u.words.any { it in ON } -> true
        else -> null
    }

    private fun timerOrAlarm(u: Utterance): Command? {
        val w = u.words
        val timer = u.hasPrefix("taimer", "timer", "atskait")
        val wake = u.hasPrefix("modinātāj", "modināt", "alarm") || u.hasWord("pamodini", "modini") || u.contains("wake", "me")
        val remind = u.hasPrefix("atgādin", "remind")
        if (!timer && !wake && !remind) return null
        if (timer) return Command.Timer(Numbers.duration(w))

        val inAt = w.indexOfFirst { it == "pec" || it == "in" || it == "after" }
        if (inAt >= 0) Numbers.duration(w.drop(inAt + 1))?.let { return Command.Timer(it) }
        if (!wake) return null
        if (Numbers.hasDurationUnit(w)) Numbers.duration(w)?.let { return Command.Timer(it) }
        val time = Numbers.time(w) ?: return Command.Alarm(null)
        return Command.Alarm(time.first, time.second)
    }

    private fun weather(u: Utterance): Command? {
        val asked = u.hasPrefix("laikapstākļ", "prognoz", "weather", "forecast") ||
            u.contains("kāds", "laiks") || u.contains("kāds", "būs", "laiks") || u.contains("kāds", "šodien", "laiks")
        return if (asked) Command.WebSearch(u.text) else null
    }

    private val TIME_ALONE = phrases("pulkstenis", "laiks", "time", "cik ir laiks", "cik laiks", "cik tagad ir")

    private fun clock(u: Utterance): Command? {
        if (u.contains("cik", "pulkstenis") || u.contains("cik", "pulksten") || u.contains("cik", "ir", "pulkstenis") ||
            u.isOneOf(TIME_ALONE) || u.contains("what", "time") || u.contains("the", "time")
        ) return Command.TellTime
        val dayAsked = u.hasWord("diena", "dienu") && u.hasWord("kāda", "kura", "kas", "šodien")
        if (u.hasPrefix("datum") || u.hasWord("date") || dayAsked || u.contains("what", "day")) return Command.TellDate
        return null
    }

    private fun battery(u: Utterance): Command? {
        if (!u.hasPrefix("baterij", "akumulator", "uzlād", "battery", "charge")) return null
        if (u.hasPrefix("iestatījum", "taupī", "saver", "settings")) return null
        return Command.TellBattery
    }

    private fun flashlight(u: Utterance): Command? {
        val light = u.hasPrefix("luktur", "zibspuldz", "lampiņ") || u.hasWord("flashlight", "torch") ||
            (u.hasPrefix("gaism") && onOff(u) != null)
        return if (light) Command.Flashlight(onOff(u)) else null
    }

    private fun doNotDisturb(u: Utterance): Command? {
        val dnd = u.hasPrefix("netrauc") || u.contains("do", "not", "disturb") || u.hasWord("dnd")
        return if (dnd) Command.DoNotDisturb(onOff(u) ?: true) else null
    }

    /** "<adjective> režīms" in any case: "klusais režīms", "kluso režīmu", "klusā režīmā". */
    private fun mode(u: Utterance, vararg adjectives: String): Boolean {
        val first = adjectives.map(Text::fold)
        return (0 until u.size - 1).any { u.words[it] in first && u.words[it + 1].startsWith("rezim") }
    }

    private fun ringer(u: Utterance): Command? {
        val off = onOff(u) == false
        if (u.hasPrefix("vibr")) return Command.Ringer(if (off) RingerMode.NORMAL else RingerMode.VIBRATE)
        val silent = mode(u, "klusais", "kluso", "klusā", "kluss", "klusuma") ||
            u.isOneOf(phrases("klusais", "kluss", "silent", "klusais telefons")) || u.contains("silent", "mode")
        if (silent) return Command.Ringer(if (off) RingerMode.NORMAL else RingerMode.SILENT)
        val normal = mode(u, "zvana", "normālais", "normālo", "parastais", "parasto", "skaņas") ||
            u.contains("ring", "mode") || u.contains("normal", "mode")
        return if (normal) Command.Ringer(RingerMode.NORMAL) else null
    }

    private val MUTE = phrases("izslēdz skaņu", "apklusini", "apklusini telefonu", "bez skaņas", "skaņu nost", "mute", "mute sound")
    private val UNMUTE = phrases("ieslēdz skaņu", "ieslēgt skaņu", "atjauno skaņu", "skaņu atpakaļ", "unmute", "sound on")

    private fun volume(u: Utterance): Command? {
        if (u.isOneOf(MUTE)) return Command.Volume(Level.MUTE)
        if (u.isOneOf(UNMUTE)) return Command.Volume(Level.UNMUTE)
        if (u.hasPrefix("skaļāk") || u.hasWord("louder") || u.contains("volume", "up") || u.contains("turn", "up")) {
            return Command.Volume(Level.UP)
        }
        if (u.hasPrefix("klusāk") || u.hasWord("quieter") || u.contains("volume", "down") || u.contains("turn", "down")) {
            return Command.Volume(Level.DOWN)
        }
        if (!u.hasPrefix("skaļum", "volume")) return null
        return level(u)?.let { (level, percent) -> Command.Volume(level, percent) }
            ?: Command.OpenSettings(SettingsPanel.VOLUME)
    }

    private fun brightness(u: Utterance): Command? {
        if (u.hasPrefix("spilgtāk", "gaišāk") || u.hasWord("brighter")) return Command.Brightness(Level.UP)
        if (u.hasPrefix("tumšāk") || u.hasWord("darker", "dimmer")) return Command.Brightness(Level.DOWN)
        if (!u.hasPrefix("spilgtum", "gaišum", "spožum", "brightness")) return null
        if (u.hasPrefix("automātisk", "auto")) return Command.Brightness(Level.AUTO)
        return level(u)?.let { (level, percent) -> Command.Brightness(level, percent) }
            ?: Command.OpenSettings(SettingsPanel.DISPLAY)
    }

    /** Shared "… 50 procenti / maksimāls / palielini / uz pusi" handling for volume and brightness. */
    private fun level(u: Utterance): Pair<Level, Int>? {
        val n = Numbers.firstNumber(u.words)
        if (n != null) {
            val percent = if (n <= 10 && !u.hasPrefix("procent", "percent")) n * 10 else n
            return Level.SET to percent.coerceIn(0, 100)
        }
        return when {
            u.hasPrefix("maksimāl", "maksimum", "max", "pilns", "pilnu", "visskaļāk") -> Level.MAX to 100
            u.hasPrefix("minimāl", "minimum", "min") -> Level.MIN to 0
            u.hasWord("pusi", "pusei", "half") -> Level.SET to 50
            u.hasPrefix("palielin", "lielāk", "augstāk", "increase", "raise") || u.hasWord("up") -> Level.UP to 0
            u.hasPrefix("samazin", "mazāk", "zemāk", "decrease", "lower") || u.hasWord("down") -> Level.DOWN to 0
            else -> null
        }
    }

    private fun camera(u: Utterance): Command? {
        val video = u.contains("uzņem", "video") || u.contains("ieraksti", "video") || u.hasPrefix("filmē") ||
            u.contains("record", "video") || u.hasWord("videokamera") || u.contains("video", "kamera")
        if (video) return Command.Camera(CameraMode.VIDEO)
        if (u.size > 4) return null
        if (u.hasPrefix("selfij", "selfi")) return Command.Camera(CameraMode.SELFIE)
        val photo = u.hasPrefix("kamer", "camera") || u.hasWord("nofotografē", "fotografē", "nobildē") ||
            (u.hasWord("uzņem", "take") && u.hasPrefix("foto", "bild", "attēl", "photo", "picture"))
        return if (photo) Command.Camera(CameraMode.PHOTO) else null
    }

    private val SETTINGS_VERBS = Text.words(
        "atver atvērt ieslēdz izslēdz ieslēgt izslēgt parādi pārslēdz open turn switch enable disable show",
    ).toSet()

    private fun settings(u: Utterance): Command? {
        val settingsWord = u.hasPrefix("iestatījum", "uzstādījum") || u.hasWord("settings")
        val context = u.size <= 3 || u.words[0] in SETTINGS_VERBS || settingsWord
        if (!context) return null
        val toggle = onOff(u) != null
        val panel = when {
            u.hasWord("wifi", "wlan") || u.contains("wi", "fi") || u.hasPrefix("vaifai", "bezvad") -> SettingsPanel.WIFI
            u.hasPrefix("bluetooth", "blūtūt", "blutus", "blūtus", "bluto") -> SettingsPanel.BLUETOOTH
            u.contains("mobilie", "dati") || u.contains("mobilos", "datus") || u.contains("mobilo", "datu") ||
                u.contains("mobile", "data") || (u.hasPrefix("internet") && (toggle || settingsWord)) -> SettingsPanel.MOBILE_DATA
            u.hasPrefix("lidmašīn", "lidojum", "airplane", "aeroplane", "flight") -> SettingsPanel.AIRPLANE
            u.hasPrefix("atrašanās", "lokācij", "gps", "location") -> SettingsPanel.LOCATION
            u.hasWord("nfc") -> SettingsPanel.NFC
            u.hasPrefix("hotspot", "tīklāj") || u.contains("piekļuves", "punkts") -> SettingsPanel.HOTSPOT
            mode(u, "tumšais", "tumšo", "tumšā") || u.contains("dark", "mode") || u.hasPrefix("displej", "display") ||
                (u.hasPrefix("ekrān") && settingsWord) -> SettingsPanel.DISPLAY
            u.hasPrefix("taupīšan", "taupības") || u.contains("battery", "saver") ||
                (u.hasPrefix("baterij", "akumulator") && settingsWord) -> SettingsPanel.BATTERY_SAVER
            u.hasPrefix("skaņ", "sound") && settingsWord -> SettingsPanel.SOUND
            u.hasPrefix("lietotņ", "lietotn", "apps") && settingsWord -> SettingsPanel.APPS
            u.hasPrefix("valod", "language") -> SettingsPanel.LANGUAGE
            u.hasPrefix("pieejamīb", "accessibility") -> SettingsPanel.ACCESSIBILITY
            settingsWord -> SettingsPanel.MAIN
            else -> return null
        }
        return Command.OpenSettings(panel)
    }

    // ---- Open an app -------------------------------------------------------------------------

    private val OPEN = phrases(
        "atver", "atvērt", "atveri", "atveriet", "palaid", "palaist", "palaidiet", "startē", "startēt",
        "ieslēdz lietotni", "ieslēdz aplikāciju", "ej uz", "aiziet uz", "pārej uz",
        "open", "launch", "start", "run", "go to", "open up",
    )
    private val APP_WORDS = Text.words("lietotni lietotne lietotnes aplikāciju aplikācija programmu app application the").toSet()

    private fun openApp(u: Utterance): Command? {
        var r = u.after(OPEN) ?: return null
        while (r.size > 1 && r.words[0] in APP_WORDS) r = r.drop(1)
        while (r.size > 1 && r.words.last() in APP_WORDS) r = r.dropLast(1)
        if (r.isEmpty()) return null
        return Command.OpenApp(Text.trimPunctuation(r.text))
    }
}
