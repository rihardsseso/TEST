package lv.balss.vadiba.command

import kotlin.math.max
import kotlin.math.min

/**
 * Matches spoken names against contact names, app labels and on-screen text.
 * Latvian case endings are stripped first, so "Jānim", "Jāņa" and "Jānis" all match "Jānis".
 */
object FuzzyMatcher {

    private val ENDINGS = listOf("iem", "am", "ai", "im", "ei", "um", "us", "is", "os", "as", "es", "a", "e", "i", "u", "s")

    data class Split<T>(val match: T, val score: Double, val rest: String)

    fun stem(word: String): String {
        for (e in ENDINGS) {
            if (word.length - e.length >= 3 && word.endsWith(e)) return word.dropLast(e.length)
        }
        return word
    }

    fun normalize(s: String): List<String> = Text.words(s).map(::stem)

    /** Similarity between 0 and 1. */
    fun score(query: String, candidate: String): Double {
        val q = normalize(query)
        val c = normalize(candidate)
        if (q.isEmpty() || c.isEmpty()) return 0.0
        if (q == c) return 1.0
        val qJoined = q.joinToString("")
        val cJoined = c.joinToString("")
        if (qJoined == cJoined) return 0.98

        var sum = 0.0
        val matched = BooleanArray(c.size)
        for (qt in q) {
            var best = 0.0
            var bestIndex = -1
            c.forEachIndexed { i, ct ->
                val s = tokenSimilarity(qt, ct)
                if (s > best) {
                    best = s
                    bestIndex = i
                }
            }
            sum += best
            if (bestIndex >= 0 && best >= 0.75) matched[bestIndex] = true
        }
        val average = sum / q.size
        val coverage = matched.count { it }.toDouble() / c.size
        return max(average * 0.9 + coverage * 0.1, ratio(qJoined, cJoined) * 0.95)
    }

    /** Best candidate; ties go to the shorter label (an exact "Jānis" beats "Jānis Bērziņš"). */
    fun <T> best(query: String, candidates: List<T>, label: (T) -> String): Pair<T, Double>? {
        var best: T? = null
        var bestScore = -1.0
        var bestLength = Int.MAX_VALUE
        for (c in candidates) {
            val l = label(c)
            val s = score(query, l)
            if (s > bestScore + 1e-9 || (s > bestScore - 1e-9 && l.length < bestLength)) {
                best = c
                bestScore = s
                bestLength = l.length
            }
        }
        return best?.let { it to bestScore }
    }

    /**
     * Splits "Jānim es kavēšos" into the best matching recipient and the remaining message.
     * Longer name prefixes win when they match at least as well ("Jānim Bērziņam sveiks").
     */
    fun <T> splitRecipient(text: String, candidates: List<T>, threshold: Double = 0.75, label: (T) -> String): Split<T>? {
        val u = Utterance.of(text)
        var result: Split<T>? = null
        for (k in 1..min(3, u.size)) {
            val (match, s) = best(u.slice(0, k).text, candidates, label) ?: continue
            if (s < threshold) continue
            if (result == null || s >= result.score - 1e-9) {
                result = Split(match, s, u.slice(k, u.size).text)
            }
        }
        return result
    }

    private fun tokenSimilarity(q: String, c: String): Double = when {
        q == c -> 1.0
        q.length >= 3 && c.startsWith(q) -> 0.9
        c.length >= 3 && q.startsWith(c) -> 0.85
        else -> ratio(q, c)
    }

    private fun ratio(a: String, b: String): Double {
        val longest = max(a.length, b.length)
        return if (longest == 0) 1.0 else 1.0 - levenshtein(a, b).toDouble() / longest
    }

    private fun levenshtein(a: String, b: String): Int {
        var prev = IntArray(b.length + 1) { it }
        var cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = min(min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost)
            }
            val t = prev
            prev = cur
            cur = t
        }
        return prev[b.length]
    }
}
