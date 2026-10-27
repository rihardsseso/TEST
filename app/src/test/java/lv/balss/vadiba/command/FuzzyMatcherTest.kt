package lv.balss.vadiba.command

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FuzzyMatcherTest {

    private val contacts = listOf("Mamma", "Tētis", "Jānis Bērziņš", "Jānis Ozols", "Anna Kalniņa", "Pēteris", "Līga")

    private fun bestContact(spoken: String) = FuzzyMatcher.best(spoken, contacts) { it }

    @Test
    fun latvianCaseEndingsMatch() {
        assertEquals("Mamma", bestContact("mammai")?.first)
        assertEquals("Tētis", bestContact("tētim")?.first)
        assertEquals("Pēteris", bestContact("Pēterim")?.first)
        assertEquals("Līga", bestContact("Līgai")?.first)
        assertEquals("Anna Kalniņa", bestContact("Annai")?.first)
        assertEquals("Jānis Ozols", bestContact("Jānim Ozolam")?.first)
        assertTrue(bestContact("mammai")!!.second > 0.95)
    }

    @Test
    fun unrelatedNamesScoreLow() {
        assertTrue(FuzzyMatcher.score("Kristapam", "Mamma") < 0.6)
        assertTrue(FuzzyMatcher.score("darbs", "Līga") < 0.6)
    }

    @Test
    fun appLabels() {
        val apps = listOf("WhatsApp", "WhatsApp Business", "Kamera", "Iestatījumi", "YouTube", "YouTube Music", "Kalkulators")
        assertEquals("WhatsApp", FuzzyMatcher.best("whatsapp", apps) { it }?.first)
        assertEquals("Kamera", FuzzyMatcher.best("kameru", apps) { it }?.first)
        assertEquals("Iestatījumi", FuzzyMatcher.best("iestatījumus", apps) { it }?.first)
        assertEquals("YouTube", FuzzyMatcher.best("youtube", apps) { it }?.first)
        assertEquals("Kalkulators", FuzzyMatcher.best("kalkulatoru", apps) { it }?.first)
    }

    @Test
    fun splitsRecipientFromMessage() {
        val a = FuzzyMatcher.splitRecipient("Annai sveika, kā iet?", contacts) { it }
        assertEquals("Anna Kalniņa", a?.match)
        assertEquals("sveika, kā iet?", a?.rest)

        val b = FuzzyMatcher.splitRecipient("Jānim Bērziņam būšu vēlāk", contacts) { it }
        assertEquals("Jānis Bērziņš", b?.match)
        assertEquals("būšu vēlāk", b?.rest)

        assertNull(FuzzyMatcher.splitRecipient("Kristapam sveiks", contacts) { it })
    }
}
