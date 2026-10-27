package lv.balss.vadiba.command

/**
 * A window over the folded words of a spoken phrase. Matching happens on folded words, while
 * [text] returns the matching part of the original phrase with its case and punctuation intact.
 */
class Utterance private constructor(
    private val original: String,
    private val tokens: List<Text.Token>,
    private val from: Int,
    private val to: Int,
) {
    val words: List<String> = tokens.subList(from, to).map { it.text }

    val size: Int get() = to - from

    fun isEmpty() = size == 0

    val text: String
        get() {
            if (isEmpty()) return ""
            val end = if (to == tokens.size) original.length else tokens[to - 1].end
            return original.substring(tokens[from].start, end).trim()
        }

    fun drop(n: Int) = Utterance(original, tokens, (from + n).coerceAtMost(to), to)

    fun dropLast(n: Int) = Utterance(original, tokens, from, (to - n).coerceAtLeast(from))

    fun slice(start: Int, end: Int) = Utterance(original, tokens, from + start, from + end)

    fun startsWith(phrase: List<String>) =
        phrase.size <= size && phrase.indices.all { words[it] == phrase[it] }

    fun endsWith(phrase: List<String>) =
        phrase.size <= size && phrase.indices.all { words[size - phrase.size + it] == phrase[it] }

    /** The rest of the phrase after the longest matching prefix, or null when none matches. */
    fun after(phrases: List<List<String>>): Utterance? =
        phrases.filter { startsWith(it) }.maxByOrNull { it.size }?.let { drop(it.size) }

    fun isOneOf(phrases: List<List<String>>) = phrases.any { it == words }

    fun indexOf(phrase: List<String>): Int {
        for (i in 0..size - phrase.size) {
            if (phrase.indices.all { words[i + it] == phrase[it] }) return i
        }
        return -1
    }

    fun indexOfAny(phrases: List<List<String>>): Pair<Int, Int>? =
        phrases.mapNotNull { p -> indexOf(p).takeIf { it >= 0 }?.let { it to p.size } }.minByOrNull { it.first }

    fun contains(vararg phrase: String) = indexOf(phrase.map(Text::fold)) >= 0

    fun hasWord(vararg candidates: String): Boolean {
        val folded = candidates.map(Text::fold)
        return words.any { it in folded }
    }

    fun hasPrefix(vararg stems: String): Boolean {
        val folded = stems.map(Text::fold)
        return words.any { w -> folded.any { w.startsWith(it) } }
    }

    companion object {
        fun of(text: String): Utterance {
            val trimmed = text.trim()
            val tokens = Text.tokens(trimmed)
            return Utterance(trimmed, tokens, 0, tokens.size)
        }

        /** Phrases written naturally (with diacritics) and folded for matching. */
        fun phrases(vararg s: String): List<List<String>> = s.map(Text::words)
    }
}
