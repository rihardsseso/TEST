package lv.balss.vadiba.command

import kotlin.math.roundToInt

/** Numbers, durations and clock times spoken in Latvian or English (words are already folded). */
object Numbers {

    private val ENDINGS = listOf("", "s", "i", "a", "u", "as", "os", "am", "ai", "iem")

    private val FORMS: Map<String, Int> = HashMap<String, Int>().apply {
        fun add(stem: String, value: Int) {
            for (e in ENDINGS) putIfAbsent(stem + e, value)
        }
        listOf("nulle", "nulli", "nulles").forEach { put(it, 0) }
        add("vien", 1)
        add("div", 2)
        add("trij", 3)
        put("tris", 3)
        add("cetr", 4)
        add("piec", 5)
        add("ses", 6)
        add("septin", 7)
        add("aston", 8)
        add("devin", 9)
        add("desmit", 10)
        listOf("vien", "div", "tris", "cetr", "piec", "ses", "septin", "aston", "devin")
            .forEachIndexed { i, s -> add(s + "padsmit", 11 + i) }
        listOf("div", "tris", "cetr", "piec", "ses", "septin", "aston", "devin")
            .forEachIndexed { i, s -> add(s + "desmit", 20 + 10 * i) }
        add("simt", 100)

        listOf(
            "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
            "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
        ).forEachIndexed { i, w -> put(w, i) }
        listOf("twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety")
            .forEachIndexed { i, w -> put(w, 20 + 10 * i) }
        put("hundred", 100)
    }

    private val PM = setOf("pm", "vakara", "vakaru", "vakars", "pecpusdiena", "pecpusdienu", "evening", "tonight")
    private val AM = setOf("am", "rita", "ritu", "morning")

    fun value(word: String): Int? = word.toIntOrNull() ?: FORMS[word]

    /** Number starting at [i] and how many words it used; joins "divdesmit pieci" / "twenty five". */
    fun parse(words: List<String>, i: Int): Pair<Int, Int>? {
        val word = words.getOrNull(i) ?: return null
        val first = value(word) ?: return null
        if (word.toIntOrNull() == null && first in 20..90 && first % 10 == 0) {
            val next = words.getOrNull(i + 1)
            val unit = next?.takeIf { it.toIntOrNull() == null }?.let(::value)
            if (unit != null && unit in 1..9) return (first + unit) to 2
        }
        return first to 1
    }

    fun firstNumber(words: List<String>): Int? {
        for (i in words.indices) parse(words, i)?.let { return it.first }
        return null
    }

    /** Total seconds in phrases like "5 minūtes", "pusstundu", "1 stundu un 30 minūtes". A bare number means minutes. */
    fun duration(words: List<String>): Int? {
        var total = 0.0
        var pending: Double? = null
        var found = false
        var i = 0
        while (i < words.size) {
            val w = words[i]
            when {
                w.startsWith("pusstund") -> { total += 1800; found = true; i++; continue }
                w.startsWith("pusminut") -> { total += 30; found = true; i++; continue }
                w.startsWith("ceturtdalstund") -> { total += 900; found = true; i++; continue }
                w.startsWith("pusotr") -> { pending = 1.5; i++; continue }
                w == "half" -> {
                    pending = 0.5
                    i++
                    if (words.getOrNull(i) == "an" || words.getOrNull(i) == "a") i++
                    continue
                }
                (w == "a" || w == "an") && pending == null -> { pending = 1.0; i++; continue }
            }
            val unit = unitSeconds(w)
            if (unit != null) {
                total += (pending ?: 1.0) * unit
                pending = null
                found = true
                i++
                continue
            }
            val n = parse(words, i)
            if (n != null) {
                pending = n.first.toDouble()
                i += n.second
                continue
            }
            i++
        }
        val last = pending
        if (!found && last != null) {
            total += last * 60
            found = true
        }
        val seconds = total.roundToInt()
        return if (found && seconds > 0) seconds else null
    }

    fun hasDurationUnit(words: List<String>) =
        words.any { unitSeconds(it) != null || it.startsWith("pusstund") || it.startsWith("pusminut") }

    private fun unitSeconds(w: String): Int? = when {
        w.startsWith("sekund") || w.startsWith("sekunz") || w == "sek" || w.startsWith("second") || w == "sec" -> 1
        w.startsWith("minut") || w.startsWith("minus") || w == "min" -> 60
        w.startsWith("stun") || w.startsWith("hour") || w == "h" -> 3600
        else -> null
    }

    /** Clock time from "7:30", "septiņos trīsdesmit", "pusastoņos" (7:30), "7 vakarā", "0730". */
    fun time(words: List<String>): Pair<Int, Int>? {
        var hour: Int? = null
        var minute = 0
        var i = 0
        while (i < words.size) {
            val w = words[i]
            if (w == "pus") {
                val n = words.getOrNull(i + 1)?.let(::value)
                if (n != null && n in 1..24) { hour = n - 1; minute = 30; break }
            }
            if (w.length > 4 && w.startsWith("pus")) {
                val n = value(w.substring(3))
                if (n != null && n in 1..24) { hour = n - 1; minute = 30; break }
            }
            val n = parse(words, i)
            if (n != null) {
                hour = n.first
                val m = parse(words, i + n.second)
                if (m != null && m.first in 0..59) minute = m.first
                break
            }
            i++
        }
        var h = hour ?: return null
        if (h in 100..2359 && minute == 0 && h % 100 < 60) {
            minute = h % 100
            h /= 100
        }
        val pm = words.any { it in PM } || hasPair(words, "p", "m")
        val am = words.any { it in AM } || hasPair(words, "a", "m")
        if (pm && h in 1..11) h += 12
        if (am && h == 12) h = 0
        if (h == 24) h = 0
        if (h !in 0..23 || minute !in 0..59) return null
        return h to minute
    }

    private fun hasPair(words: List<String>, a: String, b: String) =
        (0 until words.size - 1).any { words[it] == a && words[it + 1] == b }
}
