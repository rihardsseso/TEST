package lv.balss.vadiba

import android.content.Intent

/** What the listening panel should do after a command ran. */
sealed class Outcome(val message: String) {
    /** Answered in place (time, battery, volume…): show and speak, keep the panel. */
    class Done(message: String, val speak: Boolean = true) : Outcome(message)

    /** Another app or screen was opened: close the panel. */
    class Launched(message: String, val reopen: Boolean = false) : Outcome(message)

    /** Needs the panel out of the way first; [action] runs in the accessibility service and returns a problem or null. */
    class OnScreen(message: String, val action: (VoiceAccessibilityService) -> String?) : Outcome(message)

    class NeedsPermission(message: String, val permissions: Array<String>) : Outcome(message)

    /** A special access screen the user has to switch on first. */
    class NeedsSetup(message: String, val intent: Intent) : Outcome(message)

    object Stop : Outcome("")
}
