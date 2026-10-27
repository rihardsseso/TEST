package lv.balss.vadiba.command

import java.text.Normalizer

/**
 * Text helpers shared by the parser and the fuzzy matcher.
 *
 * [fold] lower-cases and strips diacritics one character at a time, so the folded string has
 * exactly the same length as the original and token offsets can be mapped back onto it.
 */
object Text {

    private val LATVIAN = mapOf(
        'ā' to 'a', 'č' to 'c', 'ē' to 'e', 'ģ' to 'g', 'ī' to 'i', 'ķ' to 'k', 'ļ' to 'l',
        'ņ' to 'n', 'š' to 's', 'ū' to 'u', 'ž' to 'z', 'ō' to 'o', 'ŗ' to 'r',
    )

    private const val PUNCTUATION = ".,!?;:\"'„“”«»()…-"

    data class Token(val text: String, val start: Int, val end: Int)

    fun fold(s: String): String {
        val out = CharArray(s.length)
        for (i in s.indices) out[i] = foldChar(s[i].lowercaseChar())
        return String(out)
    }

    private fun foldChar(c: Char): Char {
        if (c.code < 128) return c
        LATVIAN[c]?.let { return it }
        if (!c.isLetter()) return c
        val base = Normalizer.normalize(c.toString(), Normalizer.Form.NFD)[0]
        return if (base.isLetter()) base else c
    }

    /** Splits [original] into folded word tokens. A leading "+" is kept on numbers ("+371"). */
    fun tokens(original: String): List<Token> {
        val f = fold(original)
        val out = ArrayList<Token>()
        var i = 0
        while (i < f.length) {
            val c = f[i]
            val plusNumber = c == '+' && i + 1 < f.length && f[i + 1].isDigit()
            if (c.isLetterOrDigit() || plusNumber) {
                val start = i++
                while (i < f.length && f[i].isLetterOrDigit()) i++
                out += Token(f.substring(start, i), start, i)
            } else {
                i++
            }
        }
        return out
    }

    fun words(s: String): List<String> = tokens(s).map { it.text }

    fun trimPunctuation(s: String): String = s.trim { it.isWhitespace() || it in PUNCTUATION }

    fun isDigits(word: String): Boolean =
        word.isNotEmpty() && word.withIndex().all { (i, c) -> c.isDigit() || (i == 0 && c == '+') }
}
