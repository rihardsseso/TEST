package lv.balss.vadiba

import android.Manifest
import android.app.Activity
import android.app.NotificationManager
import android.app.SearchManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.AlarmClock
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Settings
import android.telecom.TelecomManager
import android.view.KeyEvent
import lv.balss.vadiba.command.CameraMode
import lv.balss.vadiba.command.Command
import lv.balss.vadiba.command.FuzzyMatcher
import lv.balss.vadiba.command.GlobalAction
import lv.balss.vadiba.command.Level
import lv.balss.vadiba.command.MediaAction
import lv.balss.vadiba.command.Messenger
import lv.balss.vadiba.command.RingerMode
import lv.balss.vadiba.command.SettingsPanel
import lv.balss.vadiba.command.Text
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.roundToInt

/** Carries out a parsed [Command] on the phone. */
class CommandExecutor(private val activity: Activity) {

    private data class Contact(val name: String, val number: String)
    private data class App(val label: String, val component: ComponentName)

    private sealed class Who {
        class Found(val name: String, val number: String, val rest: String) : Who()
        class Missing(val outcome: Outcome) : Who()
    }

    fun execute(command: Command): Outcome = try {
        run(command)
    } catch (e: ActivityNotFoundException) {
        Outcome.Done(s(R.string.r_no_app))
    } catch (e: SecurityException) {
        Outcome.Done(s(R.string.r_no_permission))
    }

    private fun run(c: Command): Outcome = when (c) {
        is Command.Call -> call(c.target)
        is Command.SendMessage -> message(c)
        is Command.OpenApp -> openApp(c.name, strict = false) ?: Outcome.Done(s(R.string.r_app_not_found, c.name))
        is Command.Flashlight -> flashlight(c.on)
        is Command.Volume -> volume(c.level, c.percent)
        is Command.Brightness -> brightness(c.level, c.percent)
        is Command.Ringer -> ringer(c.mode)
        is Command.DoNotDisturb -> doNotDisturb(c.on)
        is Command.Alarm -> alarm(c.hour, c.minute)
        is Command.Timer -> timer(c.seconds)
        Command.TellTime -> Outcome.Done(s(R.string.r_time, clock(Calendar.getInstance())))
        Command.TellDate -> Outcome.Done(s(R.string.r_date, SimpleDateFormat("EEEE, d. MMMM", locale()).format(Date())))
        Command.TellBattery -> battery()
        is Command.WebSearch -> webSearch(c.query)
        is Command.YouTubeSearch -> youtube(c.query)
        is Command.Navigate -> navigate(c.destination)
        is Command.ShowMap -> launch(geo(c.query), s(R.string.r_map, c.query))
        is Command.PlayMusic -> playMusic(c.query)
        is Command.Media -> media(c.action)
        is Command.Camera -> camera(c.mode)
        is Command.OpenSettings -> launch(settingsIntent(c.panel), s(R.string.r_settings))
        is Command.Global -> global(c.action)
        is Command.Scroll -> onScreen { it.scroll(c.direction) }
        is Command.Tap -> onScreen { it.clickText(c.target) }
        is Command.TypeText -> onScreen { it.typeText(c.text) }
        Command.AnswerCall -> phoneCall(answer = true)
        Command.EndCall -> phoneCall(answer = false)
        Command.Help -> launch(
            Intent(activity, MainActivity::class.java).putExtra(MainActivity.EXTRA_SHOW_HELP, true),
            s(R.string.r_help),
        )
        Command.Stop -> Outcome.Stop
        is Command.Unknown -> unknown(c.text)
    }

    // ---- Calls and messages ----------------------------------------------------------------

    private fun call(target: String): Outcome {
        if (target.isBlank()) return launch(Intent(Intent.ACTION_DIAL), s(R.string.r_dialer))
        val who = findContact(target, splitMessage = false)
        if (who is Who.Missing) return who.outcome
        who as Who.Found
        val uri = Uri.fromParts("tel", who.number, null)
        return if (granted(Manifest.permission.CALL_PHONE)) {
            launch(Intent(Intent.ACTION_CALL, uri), s(R.string.r_calling, who.name))
        } else {
            launch(Intent(Intent.ACTION_DIAL, uri), s(R.string.r_dialed, who.name))
        }
    }

    private fun message(c: Command.SendMessage): Outcome {
        if (c.recipient.isBlank()) {
            return when (c.via) {
                Messenger.SMS -> launch(Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:")), s(R.string.r_compose))
                Messenger.WHATSAPP -> openApp("WhatsApp", strict = false) ?: Outcome.Done(s(R.string.r_app_not_found, "WhatsApp"))
            }
        }
        val who = findContact(c.recipient, splitMessage = c.text == null)
        if (who is Who.Missing) return who.outcome
        who as Who.Found
        val text = c.text ?: who.rest
        return when (c.via) {
            Messenger.SMS -> launch(
                Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(who.number))).putExtra("sms_body", text),
                s(R.string.r_sms, who.name),
            )
            Messenger.WHATSAPP -> {
                val uri = Uri.parse("https://api.whatsapp.com/send?phone=${internationalDigits(who.number)}&text=${Uri.encode(text)}")
                launch(
                    Intent(Intent.ACTION_VIEW, uri).setPackage("com.whatsapp"),
                    s(R.string.r_whatsapp, who.name),
                    fallback = Intent(Intent.ACTION_VIEW, uri),
                )
            }
        }
    }

    private fun findContact(spoken: String, splitMessage: Boolean): Who {
        phoneNumber(spoken)?.let { return Who.Found(it, it, "") }
        if (!granted(Manifest.permission.READ_CONTACTS)) {
            return Who.Missing(Outcome.NeedsPermission(s(R.string.r_contacts_permission), arrayOf(Manifest.permission.READ_CONTACTS)))
        }
        val contacts = loadContacts()
        if (contacts.isEmpty()) return Who.Missing(Outcome.Done(s(R.string.r_no_contacts)))
        val notFound = Who.Missing(Outcome.Done(s(R.string.r_contact_not_found, spoken)))
        if (splitMessage) {
            val split = FuzzyMatcher.splitRecipient(spoken, contacts) { it.name } ?: return notFound
            return Who.Found(split.match.name, split.match.number, split.rest)
        }
        val (contact, score) = FuzzyMatcher.best(spoken, contacts) { it.name } ?: return notFound
        return if (score >= CONTACT_THRESHOLD) Who.Found(contact.name, contact.number, "") else notFound
    }

    /** One number per contact: the default one, else a mobile number, else the first. */
    private fun loadContacts(): List<Contact> {
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.TYPE,
            ContactsContract.CommonDataKinds.Phone.IS_SUPER_PRIMARY,
        )
        data class Row(val name: String, val number: String, val rank: Int)
        val best = LinkedHashMap<Long, Row>()
        activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, null)?.use { cursor ->
            while (cursor.moveToNext()) {
                val id = cursor.getLong(0)
                val name = cursor.getString(1) ?: continue
                val number = cursor.getString(2) ?: continue
                val rank = when {
                    cursor.getInt(4) != 0 -> 0
                    cursor.getInt(3) == ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE -> 1
                    else -> 2
                }
                val current = best[id]
                if (current == null || rank < current.rank) best[id] = Row(name, number, rank)
            }
        }
        return best.values.map { Contact(it.name, it.number) }
    }

    private fun phoneNumber(spoken: String): String? {
        val compact = spoken.filterNot { it == ' ' || it == '-' }
        return compact.takeIf { it.length >= 3 && Text.isDigits(it) }
    }

    /** WhatsApp wants the number with country code and no "+"; 8-digit numbers are taken as Latvian. */
    private fun internationalDigits(number: String): String {
        val digits = number.filter { it.isDigit() }
        return when {
            number.trim().startsWith("+") -> digits
            digits.startsWith("00") -> digits.drop(2)
            digits.length == 8 -> "371$digits"
            else -> digits
        }
    }

    private fun phoneCall(answer: Boolean): Outcome {
        if (!granted(Manifest.permission.ANSWER_PHONE_CALLS)) {
            return Outcome.NeedsPermission(s(R.string.r_calls_permission), arrayOf(Manifest.permission.ANSWER_PHONE_CALLS))
        }
        val telecom = activity.getSystemService(TelecomManager::class.java)
        return if (answer) {
            @Suppress("DEPRECATION")
            telecom.acceptRingingCall()
            Outcome.Done(s(R.string.r_answer), speak = false)
        } else {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return Outcome.Done(s(R.string.r_needs_android_9))
            @Suppress("DEPRECATION")
            telecom.endCall()
            Outcome.Done(s(R.string.r_end_call), speak = false)
        }
    }

    // ---- Apps ----------------------------------------------------------------------------------

    private fun loadApps(): List<App> {
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        val activities = activity.packageManager.queryIntentActivities(intent, 0)
        return activities
            .filter { it.activityInfo.packageName != activity.packageName }
            .map { App(it.loadLabel(activity.packageManager).toString(), ComponentName(it.activityInfo.packageName, it.activityInfo.name)) }
    }

    /**
     * Opens an app by its spoken name: a close label match first, then common words like
     * "kalkulators" or "pārlūks" that map to the phone's default app, then a looser label match.
     */
    private fun openApp(spoken: String, strict: Boolean): Outcome? {
        val name = AppNames.canonical(spoken)
        val apps = loadApps()
        val match = FuzzyMatcher.best(name, apps) { it.label }
        if (match != null && match.second >= 0.9) return launchApp(match.first)
        AppNames.intentFor(name)?.let { intent ->
            try {
                return launch(intent, s(R.string.r_opening, spoken), reopen = true)
            } catch (e: ActivityNotFoundException) {
                // No default app for this kind on the phone; try the app labels below.
            }
        }
        if (!strict && match != null && match.second >= APP_THRESHOLD) return launchApp(match.first)
        return null
    }

    private fun launchApp(app: App): Outcome {
        val intent = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(app.component)
            .addFlags(Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        return launch(intent, s(R.string.r_opening, app.label), reopen = true)
    }

    private fun unknown(text: String): Outcome {
        if (text.isNotBlank() && Text.words(text).size <= 3) openApp(text, strict = true)?.let { return it }
        return Outcome.Done(s(R.string.r_unknown, text))
    }

    // ---- Phone settings ---------------------------------------------------------------------

    private fun flashlight(on: Boolean?): Outcome {
        val cameras = activity.getSystemService(CameraManager::class.java)
        Torch.track(cameras)
        return try {
            val id = cameras.cameraIdList.firstOrNull {
                cameras.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            } ?: return Outcome.Done(s(R.string.r_no_flash))
            val target = on ?: !Torch.isOn
            cameras.setTorchMode(id, target)
            Torch.isOn = target
            Outcome.Done(s(if (target) R.string.r_flash_on else R.string.r_flash_off))
        } catch (e: CameraAccessException) {
            Outcome.Done(s(R.string.r_flash_busy))
        }
    }

    private fun volume(level: Level, percent: Int): Outcome {
        val audio = activity.getSystemService(AudioManager::class.java)
        val stream = AudioManager.STREAM_MUSIC
        val max = audio.getStreamMaxVolume(stream)
        val current = audio.getStreamVolume(stream)
        val step = maxOf(1, (max * 0.15).roundToInt())
        val flags = AudioManager.FLAG_SHOW_UI
        when (level) {
            Level.UP -> audio.setStreamVolume(stream, minOf(max, current + step), flags)
            Level.DOWN -> audio.setStreamVolume(stream, maxOf(0, current - step), flags)
            Level.MAX -> audio.setStreamVolume(stream, max, flags)
            Level.MIN -> audio.setStreamVolume(stream, 0, flags)
            Level.SET -> audio.setStreamVolume(stream, (max * percent / 100.0).roundToInt().coerceIn(0, max), flags)
            Level.MUTE -> {
                audio.adjustStreamVolume(stream, AudioManager.ADJUST_MUTE, flags)
                return Outcome.Done(s(R.string.r_muted), speak = false)
            }
            Level.UNMUTE -> {
                audio.adjustStreamVolume(stream, AudioManager.ADJUST_UNMUTE, flags)
                try {
                    if (audio.ringerMode != AudioManager.RINGER_MODE_NORMAL) audio.ringerMode = AudioManager.RINGER_MODE_NORMAL
                } catch (e: SecurityException) {
                    // Leaving "Do not disturb" needs extra access; media sound is back anyway.
                }
                return Outcome.Done(s(R.string.r_unmuted))
            }
            Level.AUTO -> Unit
        }
        val now = if (max == 0) 0 else audio.getStreamVolume(stream) * 100 / max
        return Outcome.Done(s(R.string.r_volume, now))
    }

    private fun ringer(mode: RingerMode): Outcome {
        val audio = activity.getSystemService(AudioManager::class.java)
        return try {
            audio.ringerMode = when (mode) {
                RingerMode.NORMAL -> AudioManager.RINGER_MODE_NORMAL
                RingerMode.VIBRATE -> AudioManager.RINGER_MODE_VIBRATE
                RingerMode.SILENT -> AudioManager.RINGER_MODE_SILENT
            }
            val reply = when (mode) {
                RingerMode.NORMAL -> R.string.r_ringer_normal
                RingerMode.VIBRATE -> R.string.r_ringer_vibrate
                RingerMode.SILENT -> R.string.r_ringer_silent
            }
            Outcome.Done(s(reply), speak = mode == RingerMode.NORMAL)
        } catch (e: SecurityException) {
            doNotDisturbAccess()
        }
    }

    private fun doNotDisturb(on: Boolean): Outcome {
        val notifications = activity.getSystemService(NotificationManager::class.java)
        if (!notifications.isNotificationPolicyAccessGranted) return doNotDisturbAccess()
        notifications.setInterruptionFilter(
            if (on) NotificationManager.INTERRUPTION_FILTER_PRIORITY else NotificationManager.INTERRUPTION_FILTER_ALL,
        )
        return Outcome.Done(s(if (on) R.string.r_dnd_on else R.string.r_dnd_off), speak = false)
    }

    private fun doNotDisturbAccess() =
        Outcome.NeedsSetup(s(R.string.r_dnd_needed), Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))

    private fun brightness(level: Level, percent: Int): Outcome {
        if (!Settings.System.canWrite(activity)) {
            return Outcome.NeedsSetup(
                s(R.string.r_brightness_needed),
                Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:" + activity.packageName)),
            )
        }
        val resolver = activity.contentResolver
        if (level == Level.AUTO) {
            Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC)
            return Outcome.Done(s(R.string.r_brightness_auto))
        }
        Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
        val current = Settings.System.getInt(resolver, Settings.System.SCREEN_BRIGHTNESS, 128)
        val target = when (level) {
            Level.UP -> current + 51
            Level.DOWN -> current - 51
            Level.MAX -> 255
            Level.MIN -> 5
            else -> percent * 255 / 100
        }.coerceIn(1, 255)
        Settings.System.putInt(resolver, Settings.System.SCREEN_BRIGHTNESS, target)
        return Outcome.Done(s(R.string.r_brightness, target * 100 / 255))
    }

    private fun battery(): Outcome {
        val battery = activity.getSystemService(BatteryManager::class.java)
        val level = battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        return Outcome.Done(s(if (battery.isCharging) R.string.r_battery_charging else R.string.r_battery, level))
    }

    private fun settingsIntent(panel: SettingsPanel): Intent {
        val q = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        return Intent(
            when (panel) {
                SettingsPanel.MAIN -> Settings.ACTION_SETTINGS
                SettingsPanel.WIFI -> if (q) Settings.Panel.ACTION_WIFI else Settings.ACTION_WIFI_SETTINGS
                SettingsPanel.BLUETOOTH -> Settings.ACTION_BLUETOOTH_SETTINGS
                SettingsPanel.MOBILE_DATA -> if (q) Settings.Panel.ACTION_INTERNET_CONNECTIVITY else Settings.ACTION_WIRELESS_SETTINGS
                SettingsPanel.AIRPLANE -> Settings.ACTION_AIRPLANE_MODE_SETTINGS
                SettingsPanel.LOCATION -> Settings.ACTION_LOCATION_SOURCE_SETTINGS
                SettingsPanel.NFC -> if (q) Settings.Panel.ACTION_NFC else Settings.ACTION_NFC_SETTINGS
                SettingsPanel.HOTSPOT -> Settings.ACTION_WIRELESS_SETTINGS
                SettingsPanel.DISPLAY -> Settings.ACTION_DISPLAY_SETTINGS
                SettingsPanel.SOUND -> Settings.ACTION_SOUND_SETTINGS
                SettingsPanel.VOLUME -> if (q) Settings.Panel.ACTION_VOLUME else Settings.ACTION_SOUND_SETTINGS
                SettingsPanel.BATTERY_SAVER -> Settings.ACTION_BATTERY_SAVER_SETTINGS
                SettingsPanel.APPS -> Settings.ACTION_APPLICATION_SETTINGS
                SettingsPanel.LANGUAGE -> Settings.ACTION_LOCALE_SETTINGS
                SettingsPanel.ACCESSIBILITY -> Settings.ACTION_ACCESSIBILITY_SETTINGS
            },
        )
    }

    // ---- Time ------------------------------------------------------------------------------------

    private fun alarm(hour: Int?, minute: Int): Outcome {
        if (hour == null) return launch(Intent(AlarmClock.ACTION_SHOW_ALARMS), s(R.string.r_alarms))
        val intent = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
        return Outcome.Done(s(R.string.r_alarm, "%02d:%02d".format(hour, minute)))
    }

    private fun timer(seconds: Int?): Outcome {
        if (seconds == null) return launch(Intent(AlarmClock.ACTION_SET_TIMER), s(R.string.r_timer_open))
        val intent = Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
        return Outcome.Done(s(R.string.r_timer, duration(seconds)))
    }

    private fun duration(seconds: Int): String {
        val h = seconds / 3600
        val m = seconds % 3600 / 60
        val sec = seconds % 60
        return listOfNotNull(
            h.takeIf { it > 0 }?.let { "$it h" },
            m.takeIf { it > 0 }?.let { "$it min" },
            sec.takeIf { it > 0 }?.let { "$it s" },
        ).joinToString(" ")
    }

    private fun clock(now: Calendar) = "%d:%02d".format(now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE))

    private fun locale(): Locale = Locale.forLanguageTag(if (Prefs.language(activity) == Prefs.LANGUAGE_ENGLISH) "en" else "lv")

    // ---- Internet, maps, media ----------------------------------------------------------------

    private fun webSearch(query: String): Outcome {
        val url = Uri.parse("https://www.google.com/search?q=" + Uri.encode(query))
        if (query.isBlank()) return launch(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com")), s(R.string.r_search, ""))
        return launch(
            Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, query),
            s(R.string.r_search, query),
            fallback = Intent(Intent.ACTION_VIEW, url),
        )
    }

    private fun youtube(query: String): Outcome = launch(
        Intent(Intent.ACTION_SEARCH).setPackage("com.google.android.youtube").putExtra("query", query),
        s(R.string.r_youtube, query),
        fallback = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query))),
    )

    private fun navigate(destination: String): Outcome {
        if (destination.isBlank()) return openApp("Maps", strict = false) ?: launch(geo(""), s(R.string.r_map, ""))
        return launch(
            Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=" + Uri.encode(destination))),
            s(R.string.r_navigate, destination),
            fallback = geo(destination),
        )
    }

    private fun geo(query: String) = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(query)))

    private fun playMusic(query: String): Outcome {
        val intent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH)
            .putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/*")
            .putExtra(SearchManager.QUERY, query)
        return launch(
            intent,
            s(R.string.r_play, query),
            fallback = Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(query))),
        )
    }

    private fun media(action: MediaAction): Outcome {
        val audio = activity.getSystemService(AudioManager::class.java)
        val (code, reply) = when (action) {
            MediaAction.PLAY -> KeyEvent.KEYCODE_MEDIA_PLAY to R.string.r_media_play
            MediaAction.PAUSE -> KeyEvent.KEYCODE_MEDIA_PAUSE to R.string.r_media_pause
            MediaAction.NEXT -> KeyEvent.KEYCODE_MEDIA_NEXT to R.string.r_media_next
            MediaAction.PREVIOUS -> KeyEvent.KEYCODE_MEDIA_PREVIOUS to R.string.r_media_previous
        }
        // The recogniser holds audio focus for a moment after listening; send the key once it is released.
        Handler(Looper.getMainLooper()).postDelayed({
            audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, code))
            audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, code))
        }, MEDIA_KEY_DELAY)
        return Outcome.Done(s(reply), speak = false)
    }

    private fun camera(mode: CameraMode): Outcome = when (mode) {
        CameraMode.VIDEO -> launch(Intent(MediaStore.INTENT_ACTION_VIDEO_CAMERA), s(R.string.r_video))
        CameraMode.PHOTO -> launch(Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA), s(R.string.r_camera))
        CameraMode.SELFIE -> launch(
            Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
                .putExtra("android.intent.extras.CAMERA_FACING", 1)
                .putExtra("android.intent.extras.LENS_FACING_FRONT", 1)
                .putExtra("android.intent.extra.USE_FRONT_CAMERA", true),
            s(R.string.r_camera),
        )
    }

    // ---- Screen control ------------------------------------------------------------------------

    private fun global(action: GlobalAction): Outcome {
        val service = VoiceAccessibilityService.instance
        if (service == null && action == GlobalAction.HOME) {
            return launch(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), s(R.string.r_home))
        }
        val needsPie = action == GlobalAction.LOCK_SCREEN || action == GlobalAction.SCREENSHOT
        if (needsPie && Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return Outcome.Done(s(R.string.r_needs_android_9))
        return onScreen { it.global(action) }
    }

    private fun onScreen(action: (VoiceAccessibilityService) -> String?): Outcome {
        if (VoiceAccessibilityService.instance == null) {
            return Outcome.NeedsSetup(s(R.string.r_a11y_needed), Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        return Outcome.OnScreen("", action)
    }

    // ---- Helpers -----------------------------------------------------------------------------

    private fun launch(intent: Intent, message: String, reopen: Boolean = false, fallback: Intent? = null): Outcome {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            activity.startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            if (fallback == null) throw e
            activity.startActivity(fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        return Outcome.Launched(message, reopen)
    }

    private fun granted(permission: String) = activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    private fun s(id: Int, vararg args: Any): String =
        if (args.isEmpty()) activity.getString(id) else activity.getString(id, *args)

    /** Remembers the torch state, which the camera service reports asynchronously. */
    private object Torch {
        var isOn = false
        private var tracking = false

        fun track(cameras: CameraManager) {
            if (tracking) return
            tracking = true
            cameras.registerTorchCallback(object : CameraManager.TorchCallback() {
                override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
                    isOn = enabled
                }
            }, Handler(Looper.getMainLooper()))
        }
    }

    private companion object {
        const val CONTACT_THRESHOLD = 0.72
        const val APP_THRESHOLD = 0.72
        const val MEDIA_KEY_DELAY = 600L
    }
}
