package lv.balss.vadiba

import android.accessibilityservice.AccessibilityButtonController
import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo
import android.widget.ImageView
import android.widget.Toast
import lv.balss.vadiba.command.Direction
import lv.balss.vadiba.command.FuzzyMatcher
import lv.balss.vadiba.command.GlobalAction
import kotlin.math.hypot
import kotlin.math.roundToInt

/**
 * Screen control: system buttons, scrolling, tapping text, typing, and the floating microphone.
 * It only reads the screen when the user gives such a command.
 */
class VoiceAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())
    private var bubble: View? = null
    private var panelShowing = false

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        if (key == Prefs.KEY_BUBBLE) updateBubble()
    }

    private val buttonCallback = object : AccessibilityButtonController.AccessibilityButtonCallback() {
        override fun onClicked(controller: AccessibilityButtonController) = openPanel()
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Prefs.get(this).registerOnSharedPreferenceChangeListener(prefsListener)
        accessibilityButtonController.registerAccessibilityButtonCallback(buttonCallback)
        updateBubble()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {}

    override fun onUnbind(intent: Intent?): Boolean {
        cleanUp()
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        cleanUp()
        super.onDestroy()
    }

    private fun cleanUp() {
        if (instance === this) instance = null
        handler.removeCallbacksAndMessages(null)
        Prefs.get(this).unregisterOnSharedPreferenceChangeListener(prefsListener)
        accessibilityButtonController.unregisterAccessibilityButtonCallback(buttonCallback)
        removeBubble()
    }

    fun openPanel() {
        startActivity(Intent(this, ListenActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun reopenPanel(delayMillis: Long) {
        handler.postDelayed({ openPanel() }, delayMillis)
    }

    /** Runs [action] once the listening panel has closed, so it acts on the app underneath. */
    fun runOnScreen(action: (VoiceAccessibilityService) -> String?, reopen: Boolean) {
        handler.postDelayed({
            val problem = action(this)
            if (problem != null) Toast.makeText(this, problem, Toast.LENGTH_LONG).show()
            if (reopen) reopenPanel(REOPEN_DELAY)
        }, PANEL_CLOSE_DELAY)
    }

    fun setPanelShowing(showing: Boolean) {
        panelShowing = showing
        bubble?.visibility = if (showing) View.GONE else View.VISIBLE
    }

    // ---- Actions ---------------------------------------------------------------------------------

    fun global(action: GlobalAction): String? {
        val id = when (action) {
            GlobalAction.BACK -> GLOBAL_ACTION_BACK
            GlobalAction.HOME -> GLOBAL_ACTION_HOME
            GlobalAction.RECENTS -> GLOBAL_ACTION_RECENTS
            GlobalAction.NOTIFICATIONS -> GLOBAL_ACTION_NOTIFICATIONS
            GlobalAction.QUICK_SETTINGS -> GLOBAL_ACTION_QUICK_SETTINGS
            GlobalAction.POWER_DIALOG -> GLOBAL_ACTION_POWER_DIALOG
            GlobalAction.SPLIT_SCREEN -> GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN
            GlobalAction.LOCK_SCREEN -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return getString(R.string.r_needs_android_9)
                GLOBAL_ACTION_LOCK_SCREEN
            }
            GlobalAction.SCREENSHOT -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return getString(R.string.r_needs_android_9)
                // Keep the floating button out of the picture.
                bubble?.visibility = View.GONE
                handler.postDelayed({
                    performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
                    handler.postDelayed({ if (!panelShowing) bubble?.visibility = View.VISIBLE }, 1500)
                }, 250)
                return null
            }
        }
        return if (performGlobalAction(id)) null else getString(R.string.action_failed)
    }

    fun scroll(direction: Direction): String? {
        val metrics = resources.displayMetrics
        val w = metrics.widthPixels.toFloat()
        val h = metrics.heightPixels.toFloat()
        val path = Path()
        when (direction) {
            Direction.DOWN -> { path.moveTo(w / 2, h * 0.70f); path.lineTo(w / 2, h * 0.30f) }
            Direction.UP -> { path.moveTo(w / 2, h * 0.30f); path.lineTo(w / 2, h * 0.70f) }
            Direction.LEFT -> { path.moveTo(w * 0.80f, h / 2); path.lineTo(w * 0.20f, h / 2) }
            Direction.RIGHT -> { path.moveTo(w * 0.20f, h / 2); path.lineTo(w * 0.80f, h / 2) }
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 350))
            .build()
        return if (dispatchGesture(gesture, null, null)) null else getString(R.string.scroll_failed)
    }

    /** Taps the on-screen element whose text or description best matches what was said. */
    fun clickText(query: String): String? {
        val root = targetRoot() ?: return getString(R.string.screen_unreadable)
        var best: AccessibilityNodeInfo? = null
        var bestScore = 0.0
        forEachNode(root) { node ->
            if (!node.isVisibleToUser) return@forEachNode
            val label = (node.text ?: node.contentDescription)?.toString()
            if (label.isNullOrBlank() || label.length > 120) return@forEachNode
            val score = FuzzyMatcher.score(query, label)
            if (score > bestScore) {
                bestScore = score
                best = node
            }
        }
        val node = best?.takeIf { bestScore >= TAP_THRESHOLD } ?: return getString(R.string.tap_not_found, query)
        var target: AccessibilityNodeInfo? = node
        while (target != null && !target.isClickable) target = target.parent
        if (target != null && target.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return null
        return if (tapAt(node)) null else getString(R.string.tap_failed, query)
    }

    /** Adds text to the focused text field (or the first one on screen). */
    fun typeText(text: String): String? {
        val root = targetRoot() ?: return getString(R.string.screen_unreadable)
        val field = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)?.takeIf { it.isEditable }
            ?: findFirst(root) { it.isEditable && it.isVisibleToUser }
            ?: return getString(R.string.type_no_field)
        val current = if (field.isShowingHintText) "" else field.text?.toString().orEmpty()
        val newText = when {
            current.isEmpty() -> text
            current.endsWith(" ") -> current + text
            else -> "$current $text"
        }
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, newText)
        }
        if (!field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) return getString(R.string.type_failed)
        val cursor = Bundle().apply {
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, newText.length)
            putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, newText.length)
        }
        field.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, cursor)
        return null
    }

    private fun tapAt(node: AccessibilityNodeInfo): Boolean {
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        if (bounds.isEmpty) return false
        val path = Path().apply { moveTo(bounds.exactCenterX(), bounds.exactCenterY()) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    /** The app the user is looking at, skipping our own listening panel. */
    private fun targetRoot(): AccessibilityNodeInfo? {
        rootInActiveWindow?.let { if (it.packageName?.toString() != packageName) return it }
        return windows
            .filter { it.type == AccessibilityWindowInfo.TYPE_APPLICATION }
            .mapNotNull { it.root }
            .firstOrNull { it.packageName?.toString() != packageName }
    }

    private fun forEachNode(root: AccessibilityNodeInfo, visit: (AccessibilityNodeInfo) -> Unit) {
        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        var seen = 0
        while (queue.isNotEmpty() && seen < MAX_NODES) {
            val node = queue.removeFirst()
            seen++
            visit(node)
            for (i in 0 until node.childCount) node.getChild(i)?.let(queue::add)
        }
    }

    private fun findFirst(root: AccessibilityNodeInfo, predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        var found: AccessibilityNodeInfo? = null
        forEachNode(root) { if (found == null && predicate(it)) found = it }
        return found
    }

    // ---- Floating microphone -------------------------------------------------------------------

    private fun updateBubble() {
        if (Prefs.bubble(this)) showBubble() else removeBubble()
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun showBubble() {
        if (bubble != null) return
        val windowManager = getSystemService(WindowManager::class.java)
        val metrics = resources.displayMetrics
        val size = dp(56)
        val view = ImageView(this).apply {
            setImageResource(R.drawable.ic_mic)
            setBackgroundResource(R.drawable.bg_bubble)
            val pad = dp(15)
            setPadding(pad, pad, pad, pad)
            contentDescription = getString(R.string.bubble_description)
        }
        val params = WindowManager.LayoutParams(
            size,
            size,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = Prefs.bubbleX(this@VoiceAccessibilityService, metrics.widthPixels - size - dp(8))
            y = Prefs.bubbleY(this@VoiceAccessibilityService, metrics.heightPixels / 3)
        }
        val slop = ViewConfiguration.get(this).scaledTouchSlop
        view.setOnTouchListener(object : View.OnTouchListener {
            var downX = 0f
            var downY = 0f
            var startX = 0
            var startY = 0
            var dragging = false

            override fun onTouch(v: View, e: MotionEvent): Boolean {
                when (e.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        downX = e.rawX
                        downY = e.rawY
                        startX = params.x
                        startY = params.y
                        dragging = false
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = e.rawX - downX
                        val dy = e.rawY - downY
                        if (!dragging && hypot(dx, dy) > slop) dragging = true
                        if (dragging) {
                            params.x = startX + dx.roundToInt()
                            params.y = startY + dy.roundToInt()
                            windowManager.updateViewLayout(v, params)
                        }
                    }
                    MotionEvent.ACTION_UP -> {
                        if (dragging) {
                            Prefs.saveBubblePosition(this@VoiceAccessibilityService, params.x, params.y)
                        } else {
                            v.performClick()
                            openPanel()
                        }
                    }
                }
                return true
            }
        })
        windowManager.addView(view, params)
        bubble = view
        if (panelShowing) view.visibility = View.GONE
    }

    private fun removeBubble() {
        val view = bubble ?: return
        bubble = null
        try {
            getSystemService(WindowManager::class.java).removeView(view)
        } catch (e: IllegalArgumentException) {
            // Already detached when the service was switched off.
        }
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).roundToInt()

    companion object {
        private const val PANEL_CLOSE_DELAY = 450L
        private const val REOPEN_DELAY = 1200L
        private const val TAP_THRESHOLD = 0.7
        private const val MAX_NODES = 3000

        @Volatile
        var instance: VoiceAccessibilityService? = null
            private set

        fun isEnabled(context: Context): Boolean {
            val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
                ?: return false
            val me = ComponentName(context, VoiceAccessibilityService::class.java)
            return enabled.split(':').any { ComponentName.unflattenFromString(it) == me }
        }
    }
}
