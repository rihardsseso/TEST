package lv.balss.vadiba

import android.content.Intent
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import lv.balss.vadiba.command.FuzzyMatcher

/** How people say app names out loud, and everyday words that mean "the phone's default app for …". */
object AppNames {

    private val SPOKEN = mapOf(
        "whatsapp" to listOf("vatsaps", "vatsapu", "votsaps", "votsapu", "vocaps", "vocapu", "vacaps", "whatsup", "vatsapa"),
        "facebook" to listOf("feisbuks", "feisbuku", "fēsbuks", "fēsbuku", "feisbukā"),
        "youtube" to listOf("jūtubs", "jūtubu", "jūtūbs", "jūtūbu", "jutubs", "jūtjūbs"),
        "instagram" to listOf("instagrams", "instagramu", "insta", "instu"),
        "tiktok" to listOf("tiktoks", "tiktoku"),
        "spotify" to listOf("spotifajs", "spotifaju", "spotifai"),
        "telegram" to listOf("telegramma", "telegrammu", "telegrams", "telegramu"),
        "messenger" to listOf("mesendžers", "mesendžeru", "mesendžerī"),
        "viber" to listOf("vaibers", "vaiberu"),
        "chrome" to listOf("hroms", "hromu", "kroms", "kromu"),
        "gmail" to listOf("džimeils", "džimeilu", "gmeils", "gmeilu", "džīmeils"),
        "netflix" to listOf("netfliks", "netfliksu"),
        "google" to listOf("gūgle", "gūgli", "gugle"),
    )

    private val CATEGORIES = mapOf(
        Intent.CATEGORY_APP_BROWSER to listOf("pārlūks", "pārlūku", "pārlūkprogramma", "pārlūkprogrammu", "internets", "internetu", "browser"),
        Intent.CATEGORY_APP_MESSAGING to listOf("ziņas", "īsziņas", "ziņojumi", "ziņojumus", "sms", "messages"),
        Intent.CATEGORY_APP_CONTACTS to listOf("kontakti", "kontaktus", "kontaktpersonas", "contacts"),
        Intent.CATEGORY_APP_CALENDAR to listOf("kalendārs", "kalendāru", "calendar"),
        Intent.CATEGORY_APP_EMAIL to listOf("e-pasts", "e-pastu", "epasts", "epastu", "pasts", "pastu", "email", "mail"),
        Intent.CATEGORY_APP_MAPS to listOf("kartes", "karte", "karti", "maps", "map"),
        Intent.CATEGORY_APP_MUSIC to listOf("mūzika", "mūziku", "music"),
        Intent.CATEGORY_APP_GALLERY to listOf("galerija", "galeriju", "foto", "fotogrāfijas", "bildes", "attēli", "attēlus", "gallery", "photos"),
        Intent.CATEGORY_APP_CALCULATOR to listOf("kalkulators", "kalkulatoru", "calculator"),
        "android.intent.category.APP_FILES" to listOf("faili", "failus", "failu pārvaldnieks", "files"),
    )

    private val DIALER = listOf("tālrunis", "tālruni", "telefons", "telefonu", "zvanītājs", "numuru sastādītājs", "dialer", "phone")
    private val CLOCK = listOf("pulkstenis", "pulksteni", "clock")
    private val STORE = listOf("veikals", "veikalu", "play veikals", "play veikalu", "play store", "google play")
    private val SETTINGS = listOf("iestatījumi", "iestatījumus", "settings")
    private val CAMERA = listOf("kamera", "kameru", "camera")

    private fun key(s: String) = FuzzyMatcher.normalize(s).joinToString(" ")

    private val spokenKeys: Map<String, String> =
        SPOKEN.flatMap { (canonical, variants) -> variants.map { key(it) to canonical } }.toMap()

    private val intentKeys: Map<String, () -> Intent> = buildMap<String, () -> Intent> {
        CATEGORIES.forEach { (category, words) ->
            words.forEach { put(key(it)) { Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, category) } }
        }
        DIALER.forEach { put(key(it)) { Intent(Intent.ACTION_DIAL) } }
        CLOCK.forEach { put(key(it)) { Intent(AlarmClock.ACTION_SHOW_ALARMS) } }
        STORE.forEach { put(key(it)) { Intent(Intent.ACTION_MAIN).setPackage("com.android.vending").addCategory(Intent.CATEGORY_LAUNCHER) } }
        SETTINGS.forEach { put(key(it)) { Intent(Settings.ACTION_SETTINGS) } }
        CAMERA.forEach { put(key(it)) { Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA) } }
    }

    /** "vatsapu" -> "whatsapp"; anything else is returned unchanged. */
    fun canonical(spoken: String): String = spokenKeys[key(spoken)] ?: spoken

    fun intentFor(spoken: String): Intent? = intentKeys[key(spoken)]?.invoke()
}
