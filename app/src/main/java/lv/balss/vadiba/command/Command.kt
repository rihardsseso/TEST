package lv.balss.vadiba.command

enum class GlobalAction { BACK, HOME, RECENTS, NOTIFICATIONS, QUICK_SETTINGS, LOCK_SCREEN, SCREENSHOT, POWER_DIALOG, SPLIT_SCREEN }

/** Direction the finger moves (for [Command.Scroll]) or the content moves ("ritini uz leju" = DOWN). */
enum class Direction { UP, DOWN, LEFT, RIGHT }

enum class MediaAction { PLAY, PAUSE, NEXT, PREVIOUS }

enum class Messenger { SMS, WHATSAPP }

enum class RingerMode { NORMAL, VIBRATE, SILENT }

enum class CameraMode { PHOTO, SELFIE, VIDEO }

enum class Level { UP, DOWN, MAX, MIN, SET, MUTE, UNMUTE, AUTO }

enum class SettingsPanel {
    MAIN, WIFI, BLUETOOTH, MOBILE_DATA, AIRPLANE, LOCATION, NFC, HOTSPOT,
    DISPLAY, SOUND, VOLUME, BATTERY_SAVER, APPS, LANGUAGE, ACCESSIBILITY,
}

sealed interface Command {
    data class Call(val target: String) : Command

    /** When [text] is null the recipient and the message are still joined in [recipient]. */
    data class SendMessage(val via: Messenger, val recipient: String, val text: String?) : Command
    data class OpenApp(val name: String) : Command

    /** null toggles. */
    data class Flashlight(val on: Boolean?) : Command
    data class Volume(val level: Level, val percent: Int = 0) : Command
    data class Brightness(val level: Level, val percent: Int = 0) : Command
    data class Ringer(val mode: RingerMode) : Command
    data class DoNotDisturb(val on: Boolean) : Command

    /** A null hour opens the alarm list. */
    data class Alarm(val hour: Int?, val minute: Int = 0) : Command

    /** A null length opens the timer screen. */
    data class Timer(val seconds: Int?) : Command
    data object TellTime : Command
    data object TellDate : Command
    data object TellBattery : Command
    data class WebSearch(val query: String) : Command
    data class YouTubeSearch(val query: String) : Command
    data class Navigate(val destination: String) : Command
    data class ShowMap(val query: String) : Command
    data class PlayMusic(val query: String) : Command
    data class Media(val action: MediaAction) : Command
    data class Camera(val mode: CameraMode) : Command
    data class OpenSettings(val panel: SettingsPanel) : Command
    data class Global(val action: GlobalAction) : Command
    data class Scroll(val direction: Direction) : Command
    data class Tap(val target: String) : Command
    data class TypeText(val text: String) : Command
    data object AnswerCall : Command
    data object EndCall : Command
    data object Help : Command
    data object Stop : Command
    data class Unknown(val text: String) : Command
}
