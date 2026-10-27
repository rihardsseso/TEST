package lv.balss.vadiba

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.SpeechRecognizer
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RadioGroup
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import lv.balss.vadiba.command.HelpContent

/** Setup, settings, recent commands and the list of things you can say. */
class MainActivity : Activity() {

    private lateinit var scroll: ScrollView
    private lateinit var setupList: LinearLayout
    private lateinit var historyList: LinearLayout
    private lateinit var helpCard: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        scroll = findViewById(R.id.scroll)
        setupList = findViewById(R.id.setup_list)
        historyList = findViewById(R.id.history_list)
        helpCard = findViewById(R.id.help_card)

        findViewById<View>(R.id.mic).setOnClickListener {
            startActivity(Intent(this, ListenActivity::class.java))
        }
        bindSettings()
        buildHelp()

        if (savedInstanceState == null && !Prefs.askedPermissions(this)) {
            Prefs.setAskedPermissions(this)
            requestPermissions(START_PERMISSIONS, REQUEST_PERMISSIONS)
        }
        if (intent.getBooleanExtra(EXTRA_SHOW_HELP, false)) showHelp()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.getBooleanExtra(EXTRA_SHOW_HELP, false)) showHelp()
    }

    override fun onResume() {
        super.onResume()
        refreshSetup()
        refreshHistory()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        refreshSetup()
        val deniedForGood = permissions.indices.any {
            grantResults.getOrNull(it) == PackageManager.PERMISSION_DENIED &&
                permissions[it] == Manifest.permission.RECORD_AUDIO &&
                !shouldShowRequestPermissionRationale(permissions[it])
        }
        if (requestCode == REQUEST_MIC && deniedForGood) {
            Toast.makeText(this, R.string.mic_denied_settings, Toast.LENGTH_LONG).show()
            open(appDetails())
        }
    }

    // ---- Setup -------------------------------------------------------------------------------

    private fun refreshSetup() {
        setupList.removeAllViews()

        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            addSetupRow(R.string.setup_recognizer_title, getString(R.string.setup_recognizer_desc), false, R.string.action_install) {
                open(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=com.google.android.googlequicksearchbox")))
            }
        }

        addSetupRow(R.string.setup_mic_title, getString(R.string.setup_mic_desc), granted(Manifest.permission.RECORD_AUDIO), R.string.action_allow) {
            requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MIC)
        }

        val a11y = VoiceAccessibilityService.isEnabled(this)
        var a11yDescription = getString(R.string.setup_a11y_desc)
        if (!a11y && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            a11yDescription += "\n\n" + getString(R.string.setup_a11y_restricted)
        }
        addSetupRow(R.string.setup_a11y_title, a11yDescription, a11y, R.string.action_enable) {
            open(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        if (!a11y && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            addSetupRow(null, null, false, R.string.action_app_info) { open(appDetails()) }
        }

        val calls = CALL_PERMISSIONS.all(::granted)
        addSetupRow(R.string.setup_calls_title, getString(R.string.setup_calls_desc), calls, R.string.action_allow) {
            requestPermissions(CALL_PERMISSIONS, REQUEST_PERMISSIONS)
        }

        val dnd = getSystemService(NotificationManager::class.java).isNotificationPolicyAccessGranted
        addSetupRow(R.string.setup_dnd_title, getString(R.string.setup_dnd_desc), dnd, R.string.action_allow) {
            open(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
        }

        addSetupRow(R.string.setup_brightness_title, getString(R.string.setup_brightness_desc), Settings.System.canWrite(this), R.string.action_allow) {
            open(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:$packageName")))
        }
    }

    private fun addSetupRow(title: Int?, description: String?, done: Boolean, action: Int, onClick: () -> Unit) {
        val row = layoutInflater.inflate(R.layout.item_setup, setupList, false)
        val titleView = row.findViewById<TextView>(R.id.setup_title)
        val descriptionView = row.findViewById<TextView>(R.id.setup_description)
        val button = row.findViewById<Button>(R.id.setup_action)
        val stateView = row.findViewById<TextView>(R.id.setup_state)
        if (title == null) titleView.visibility = View.GONE else titleView.setText(title)
        if (description == null) descriptionView.visibility = View.GONE else descriptionView.text = description
        if (done) {
            button.visibility = View.GONE
            stateView.visibility = View.VISIBLE
        } else {
            button.setText(action)
            button.setOnClickListener { onClick() }
        }
        setupList.addView(row)
    }

    // ---- Settings ----------------------------------------------------------------------------

    private fun bindSettings() {
        findViewById<Switch>(R.id.setting_bubble).apply {
            isChecked = Prefs.bubble(this@MainActivity)
            setOnCheckedChangeListener { _, on ->
                Prefs.setBubble(this@MainActivity, on)
                if (on && !VoiceAccessibilityService.isEnabled(this@MainActivity)) {
                    Toast.makeText(this@MainActivity, R.string.bubble_needs_a11y, Toast.LENGTH_LONG).show()
                }
            }
        }
        findViewById<Switch>(R.id.setting_continuous).apply {
            isChecked = Prefs.continuous(this@MainActivity)
            setOnCheckedChangeListener { _, on -> Prefs.setContinuous(this@MainActivity, on) }
        }
        findViewById<Switch>(R.id.setting_speak).apply {
            isChecked = Prefs.speak(this@MainActivity)
            setOnCheckedChangeListener { _, on -> Prefs.setSpeak(this@MainActivity, on) }
        }
        findViewById<RadioGroup>(R.id.setting_language).apply {
            check(if (Prefs.language(this@MainActivity) == Prefs.LANGUAGE_ENGLISH) R.id.language_en else R.id.language_lv)
            setOnCheckedChangeListener { _, id ->
                Prefs.setLanguage(this@MainActivity, if (id == R.id.language_en) Prefs.LANGUAGE_ENGLISH else Prefs.LANGUAGE_LATVIAN)
            }
        }
    }

    // ---- History and help --------------------------------------------------------------------

    private fun refreshHistory() {
        historyList.removeAllViews()
        val entries = Prefs.history(this)
        if (entries.isEmpty()) {
            historyList.addView(text(getString(R.string.history_empty), R.style.Body_Secondary))
            return
        }
        entries.forEach {
            historyList.addView(text("“${it.heard}”", R.style.Body_Strong))
            historyList.addView(text(it.result, R.style.Body_Secondary).apply { setPadding(0, 0, 0, dp(10)) })
        }
    }

    private fun buildHelp() {
        val list = findViewById<LinearLayout>(R.id.help_list)
        HelpContent.sections.forEach { section ->
            list.addView(text(section.title, R.style.Body_Strong).apply { setPadding(0, dp(12), 0, dp(4)) })
            section.note?.let { list.addView(text(it, R.style.Body_Secondary)) }
            section.examples.forEach { list.addView(text("•  „$it”", R.style.Body)) }
        }
    }

    private fun showHelp() {
        scroll.post { scroll.smoothScrollTo(0, helpCard.top) }
    }

    // ---- Helpers -----------------------------------------------------------------------------

    private fun text(value: String, style: Int) = TextView(this).apply {
        setTextAppearance(style)
        text = value
    }

    private fun granted(permission: String) = checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun appDetails() = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))

    private fun open(intent: Intent) {
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            Toast.makeText(this, R.string.r_no_app, Toast.LENGTH_SHORT).show()
        }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_SHOW_HELP = "show_help"
        private const val REQUEST_PERMISSIONS = 10
        private const val REQUEST_MIC = 11

        private val CALL_PERMISSIONS = arrayOf(
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.ANSWER_PHONE_CALLS,
        )
        private val START_PERMISSIONS = arrayOf(Manifest.permission.RECORD_AUDIO) + CALL_PERMISSIONS
    }
}
