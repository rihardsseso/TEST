package lv.balss.vadiba

import android.Manifest
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.SpeechRecognizer
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import lv.balss.vadiba.command.Command
import lv.balss.vadiba.command.CommandParser

/**
 * The small listening panel at the bottom of the screen. It is opened from the app, the floating
 * button, the Quick Settings tile, the launcher shortcut, a headset button or the assist gesture.
 */
class ListenActivity : Activity(), VoiceListener.Callback {

    private lateinit var status: TextView
    private lateinit var heard: TextView
    private lateinit var reply: TextView
    private lateinit var mic: ImageButton
    private lateinit var ring: View

    private lateinit var voice: VoiceListener
    private lateinit var executor: CommandExecutor
    private var speaker: Speaker? = null
    private val handler = Handler(Looper.getMainLooper())
    private val closeLater = Runnable { finish() }

    private var continuous = false
    private var listening = false
    private var misses = 0
    private var busyRetried = false
    private var pending: Pair<String, Command>? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_listen)
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        window.setGravity(Gravity.BOTTOM)
        keepAboveNavigationBar(findViewById(R.id.panel))

        status = findViewById(R.id.status)
        heard = findViewById(R.id.heard)
        reply = findViewById(R.id.reply)
        mic = findViewById(R.id.mic)
        ring = findViewById(R.id.ring)
        findViewById<View>(R.id.close).setOnClickListener { finish() }
        mic.setOnClickListener { if (listening) voice.stop() else startListening() }

        continuous = Prefs.continuous(this)
        voice = VoiceListener(this, this)
        executor = CommandExecutor(this)
        if (Prefs.speak(this)) speaker = Speaker(this, Prefs.language(this))

        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            showProblem(getString(R.string.err_no_recognizer))
        } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        } else {
            startListening()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!listening && checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startListening()
        }
    }

    override fun onResume() {
        super.onResume()
        VoiceAccessibilityService.instance?.setPanelShowing(true)
    }

    override fun onPause() {
        super.onPause()
        VoiceAccessibilityService.instance?.setPanelShowing(false)
    }

    override fun onStop() {
        super.onStop()
        // Leaving the panel (home button, another app) ends the session.
        if (!isFinishing) finish()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        voice.destroy()
        speaker?.shutdown()
        super.onDestroy()
    }

    private fun keepAboveNavigationBar(panel: View) {
        val basePadding = panel.paddingBottom
        panel.setOnApplyWindowInsetsListener { v, insets ->
            val bottom = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                insets.getInsets(WindowInsets.Type.navigationBars()).bottom
            } else {
                @Suppress("DEPRECATION")
                insets.systemWindowInsetBottom
            }
            v.setPadding(v.paddingLeft, v.paddingTop, v.paddingRight, basePadding + bottom)
            insets
        }
    }

    private fun startListening() {
        handler.removeCallbacks(closeLater)
        speaker?.stop()
        listening = true
        status.setText(R.string.status_listening)
        heard.text = ""
        reply.text = ""
        reply.visibility = View.GONE
        mic.isActivated = true
        voice.start(Prefs.language(this))
    }

    private fun listenAgainSoon() {
        handler.postDelayed({ if (!isFinishing) startListening() }, 250)
    }

    private fun stopped() {
        listening = false
        mic.isActivated = false
        ring.animate().scaleX(1f).scaleY(1f).setDuration(150).start()
    }

    // ---- Recogniser callbacks ------------------------------------------------------------------

    override fun onReady() {
        status.setText(R.string.status_speak_now)
    }

    override fun onRms(db: Float) {
        val scale = 1f + ((db + 2f) / 12f).coerceIn(0f, 1f) * 0.45f
        ring.scaleX = scale
        ring.scaleY = scale
    }

    override fun onPartial(text: String) {
        heard.text = text
    }

    override fun onResults(alternatives: List<String>) {
        stopped()
        if (alternatives.isEmpty()) {
            onError(SpeechRecognizer.ERROR_NO_MATCH)
            return
        }
        misses = 0
        val (text, command) = CommandParser.parseBest(alternatives)
        heard.text = text
        run(text, command)
    }

    override fun onError(code: Int) {
        stopped()
        when (code) {
            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> {
                misses++
                if (continuous && misses < MAX_MISSES) listenAgainSoon() else showProblem(getString(R.string.err_no_match))
            }
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
                requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
            SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER,
            SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> showProblem(getString(R.string.err_network))
            SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
                showProblem(getString(R.string.err_language))
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> {
                if (!busyRetried) {
                    busyRetried = true
                    voice.destroy()
                    handler.postDelayed({ startListening() }, 400)
                } else {
                    showProblem(getString(R.string.err_busy))
                }
            }
            SpeechRecognizer.ERROR_CLIENT -> status.setText(R.string.status_tap_mic)
            else -> showProblem(getString(R.string.err_generic, code))
        }
    }

    // ---- Running a command --------------------------------------------------------------------

    private fun run(text: String, command: Command) {
        status.setText(R.string.status_working)
        val outcome = executor.execute(command)
        if (outcome !is Outcome.Stop && outcome !is Outcome.NeedsPermission) {
            Prefs.addHistory(this, text, outcome.message.ifEmpty { getString(R.string.history_done) })
        }
        when (outcome) {
            is Outcome.Stop -> finish()
            is Outcome.Done -> showReply(outcome.message, outcome.speak)
            is Outcome.Launched -> {
                if (outcome.message.isNotEmpty()) toast(outcome.message, Toast.LENGTH_SHORT)
                if (continuous && outcome.reopen) VoiceAccessibilityService.instance?.reopenPanel(REOPEN_AFTER_APP)
                finish()
            }
            is Outcome.OnScreen -> {
                val service = VoiceAccessibilityService.instance
                finish()
                service?.runOnScreen(outcome.action, reopen = continuous)
            }
            is Outcome.NeedsPermission -> {
                pending = text to command
                showReply(outcome.message, speak = false, keepOpen = true)
                requestPermissions(outcome.permissions, REQUEST_COMMAND)
            }
            is Outcome.NeedsSetup -> {
                toast(outcome.message, Toast.LENGTH_LONG)
                try {
                    startActivity(outcome.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (e: ActivityNotFoundException) {
                    // Nothing to open on this phone; the message explains what is missing.
                }
                finish()
            }
        }
    }

    private fun showReply(message: String, speak: Boolean, keepOpen: Boolean = false) {
        reply.text = message
        reply.visibility = View.VISIBLE
        status.setText(R.string.status_done)
        if (keepOpen) return
        val next: () -> Unit = {
            if (continuous) listenAgainSoon() else handler.postDelayed(closeLater, CLOSE_DELAY)
        }
        val s = speaker
        if (speak && s != null) s.speak(message, next) else next()
    }

    private fun showProblem(message: String) {
        reply.text = message
        reply.visibility = View.VISIBLE
        status.setText(R.string.status_tap_mic)
    }

    private fun toast(message: String, length: Int) {
        Toast.makeText(applicationContext, message, length).show()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        when (requestCode) {
            REQUEST_MIC -> if (granted) startListening() else showProblem(getString(R.string.err_mic_permission))
            REQUEST_COMMAND -> {
                val p = pending
                pending = null
                if (p != null && granted) run(p.first, p.second) else showProblem(getString(R.string.err_permission_denied))
            }
        }
    }

    private companion object {
        const val REQUEST_MIC = 1
        const val REQUEST_COMMAND = 2
        const val CLOSE_DELAY = 2500L
        const val REOPEN_AFTER_APP = 1500L
        const val MAX_MISSES = 3
    }
}
