package lv.balss.vadiba

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

object Prefs {
    const val KEY_BUBBLE = "bubble"
    private const val KEY_CONTINUOUS = "continuous"
    private const val KEY_SPEAK = "speak"
    private const val KEY_LANGUAGE = "language"
    private const val KEY_HISTORY = "history"
    private const val KEY_BUBBLE_X = "bubble_x"
    private const val KEY_BUBBLE_Y = "bubble_y"
    private const val KEY_ASKED_PERMISSIONS = "asked_permissions"
    private const val HISTORY_SIZE = 15

    const val LANGUAGE_LATVIAN = "lv-LV"
    const val LANGUAGE_ENGLISH = "en-US"

    data class HistoryEntry(val heard: String, val result: String)

    fun get(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences("balss", Context.MODE_PRIVATE)

    fun bubble(context: Context) = get(context).getBoolean(KEY_BUBBLE, true)
    fun setBubble(context: Context, on: Boolean) = get(context).edit().putBoolean(KEY_BUBBLE, on).apply()

    fun continuous(context: Context) = get(context).getBoolean(KEY_CONTINUOUS, false)
    fun setContinuous(context: Context, on: Boolean) = get(context).edit().putBoolean(KEY_CONTINUOUS, on).apply()

    fun speak(context: Context) = get(context).getBoolean(KEY_SPEAK, true)
    fun setSpeak(context: Context, on: Boolean) = get(context).edit().putBoolean(KEY_SPEAK, on).apply()

    fun language(context: Context): String = get(context).getString(KEY_LANGUAGE, null) ?: LANGUAGE_LATVIAN
    fun setLanguage(context: Context, tag: String) = get(context).edit().putString(KEY_LANGUAGE, tag).apply()

    fun askedPermissions(context: Context) = get(context).getBoolean(KEY_ASKED_PERMISSIONS, false)
    fun setAskedPermissions(context: Context) = get(context).edit().putBoolean(KEY_ASKED_PERMISSIONS, true).apply()

    fun bubbleX(context: Context, default: Int) = get(context).getInt(KEY_BUBBLE_X, default)
    fun bubbleY(context: Context, default: Int) = get(context).getInt(KEY_BUBBLE_Y, default)
    fun saveBubblePosition(context: Context, x: Int, y: Int) =
        get(context).edit().putInt(KEY_BUBBLE_X, x).putInt(KEY_BUBBLE_Y, y).apply()

    fun history(context: Context): List<HistoryEntry> {
        val raw = get(context).getString(KEY_HISTORY, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).map {
                val o = array.getJSONObject(it)
                HistoryEntry(o.optString("heard"), o.optString("result"))
            }
        } catch (e: org.json.JSONException) {
            emptyList()
        }
    }

    fun addHistory(context: Context, heard: String, result: String) {
        val entries = listOf(HistoryEntry(heard, result)) + history(context).take(HISTORY_SIZE - 1)
        val array = JSONArray()
        entries.forEach { array.put(JSONObject().put("heard", it.heard).put("result", it.result)) }
        get(context).edit().putString(KEY_HISTORY, array.toString()).apply()
    }
}
