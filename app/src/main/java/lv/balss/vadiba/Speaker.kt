package lv.balss.vadiba

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Speaks replies aloud. If the phone has no voice for the chosen language the reply is only shown
 * on screen, and [speak] still calls `onDone` so the caller's flow continues.
 */
class Speaker(context: Context, private val languageTag: String) : TextToSpeech.OnInitListener {

    private val main = Handler(Looper.getMainLooper())
    private val tts = TextToSpeech(context.applicationContext, this)
    private val callbacks = ConcurrentHashMap<String, () -> Unit>()
    private var pending: Pair<String, () -> Unit>? = null
    private var ready = false
    private var usable = false

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts.setLanguage(Locale.forLanguageTag(languageTag))
            usable = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}
                override fun onDone(utteranceId: String?) = finished(utteranceId)

                @Deprecated("Deprecated in Java")
                override fun onError(utteranceId: String?) = finished(utteranceId)
                override fun onError(utteranceId: String?, errorCode: Int) = finished(utteranceId)
            })
        }
        ready = true
        pending?.let { (text, onDone) -> speak(text, onDone) }
        pending = null
    }

    private fun finished(id: String?) {
        val callback = id?.let { callbacks.remove(it) } ?: return
        main.post { callback() }
    }

    fun speak(text: String, onDone: () -> Unit) {
        if (!ready) {
            pending?.second?.let { previous -> main.post { previous() } }
            pending = text to onDone
            return
        }
        if (!usable || text.isBlank()) {
            main.post { onDone() }
            return
        }
        val id = UUID.randomUUID().toString()
        callbacks[id] = onDone
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) finished(id)
    }

    fun stop() {
        if (ready) tts.stop()
        callbacks.clear()
    }

    fun shutdown() {
        callbacks.clear()
        tts.shutdown()
    }
}
