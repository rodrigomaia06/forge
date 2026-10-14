package expo.modules.forgerangekeyboard

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.text.method.DigitsKeyListener
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import com.facebook.react.common.assets.ReactFontManager
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlin.math.min
import kotlin.math.roundToInt

class ForgeRangeKeyboardModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ForgeRangeKeyboard")
    Events("keyboardFrameChange")
    OnCreate { RangeKeyboard.frameEvent = { sendEvent("keyboardFrameChange", it) } }
    OnDestroy {
      RangeKeyboard.dismissOnMainThread()
      RangeKeyboard.frameEvent = null
    }
    Function("dismiss") { RangeKeyboard.dismissOnMainThread() }

    View(ForgeRangeKeyboardView::class) {
      Events("onChange", "onFocus", "onBlur")
      Prop("value") { view: ForgeRangeKeyboardView, value: String -> view.pendingValue = value }
      Prop("mostRecentEventCount") { view: ForgeRangeKeyboardView, value: Int -> view.incomingEventCount = value }
      Prop("editable") { view: ForgeRangeKeyboardView, value: Boolean -> view.setEditable(value) }
      Prop("placeholder") { view: ForgeRangeKeyboardView, value: String -> view.field.hint = value }
      Prop("textColor") { view: ForgeRangeKeyboardView, value: Int? -> value?.let { view.field.setTextColor(it) } }
      Prop("placeholderTextColor") { view: ForgeRangeKeyboardView, value: Int? -> value?.let { view.field.setHintTextColor(it) } }
      Prop("fontSize") { view: ForgeRangeKeyboardView, value: Double -> view.fontSize = value }
      Prop("fontFamily") { view: ForgeRangeKeyboardView, value: String ->
        view.field.typeface = ReactFontManager.getInstance().getTypeface(value, Typeface.NORMAL, view.context.assets)
      }
      Prop("textAlign") { view: ForgeRangeKeyboardView, value: String ->
        view.field.gravity = Gravity.CENTER_VERTICAL or when (value) {
          "center" -> Gravity.CENTER_HORIZONTAL
          "right" -> Gravity.RIGHT
          else -> Gravity.LEFT
        }
      }
      Prop("appearance") { view: ForgeRangeKeyboardView, value: String -> view.appearance = value }
      Prop("accessibilityLabel") { view: ForgeRangeKeyboardView, value: String -> view.field.contentDescription = value }
      Prop("focusRequest") { view: ForgeRangeKeyboardView, value: Int -> view.pendingFocusRequest = value }
      OnViewDidUpdateProps { view: ForgeRangeKeyboardView -> view.applyProps() }
      OnViewDestroys { view: ForgeRangeKeyboardView -> view.release() }
    }
  }
}

class ForgeRangeKeyboardView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  val onChange by EventDispatcher()
  val onFocus by EventDispatcher()
  val onBlur by EventDispatcher()
  private var initialized = false
  private var applyingSelection = false
  val field = object : EditText(context) {
    override fun onSelectionChanged(start: Int, end: Int) {
      super.onSelectionChanged(start, end)
      if (initialized && !applyingSelection && start == end && end >= 0 && end != length()) {
        applyingSelection = true
        setSelection(length())
        applyingSelection = false
      }
    }

    override fun onKeyPreIme(keyCode: Int, event: KeyEvent): Boolean =
      handleBack(keyCode, event) || super.onKeyPreIme(keyCode, event)

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean =
      handleBack(keyCode, event) || super.onKeyDown(keyCode, event)

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
      handleBack(keyCode, event) || super.onKeyUp(keyCode, event)

    private fun handleBack(keyCode: Int, event: KeyEvent): Boolean {
      if ((keyCode != KeyEvent.KEYCODE_BACK && keyCode != KeyEvent.KEYCODE_ESCAPE) || !RangeKeyboard.owns(this@ForgeRangeKeyboardView)) return false
      if (event.action == KeyEvent.ACTION_UP) RangeKeyboard.dismiss()
      return true
    }
  }
  var pendingValue = ""
  var incomingEventCount = 0
  var nativeEventCount = 0
  var pendingFocusRequest = 0
  var fontSize = 15.0
  var appearance = "light"
  private var appliedFocusRequest = 0
  private var applyingValue = false

  init {
    field.setSingleLine(true)
    field.keyListener = DigitsKeyListener.getInstance("0123456789.,-–—")
    field.showSoftInputOnFocus = false
    field.background = null
    field.setPadding(0, 0, 0, 0)
    field.includeFontPadding = false
    field.gravity = Gravity.CENTER
    field.isSaveEnabled = false
    field.isFocusableInTouchMode = false
    field.setOnTouchListener { _, event ->
      if (event.actionMasked == MotionEvent.ACTION_DOWN && field.isEnabled) field.isFocusableInTouchMode = true
      false
    }
    field.imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_DONE
    field.setOnEditorActionListener { _, action, event ->
      if (action == android.view.inputmethod.EditorInfo.IME_ACTION_DONE || event?.keyCode == KeyEvent.KEYCODE_ENTER) {
        RangeKeyboard.dismiss()
        true
      } else false
    }
    addView(field, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    field.addTextChangedListener(object : TextWatcher {
      override fun beforeTextChanged(text: CharSequence?, start: Int, count: Int, after: Int) = Unit
      override fun onTextChanged(text: CharSequence?, start: Int, before: Int, count: Int) = Unit
      override fun afterTextChanged(text: Editable?) {
        if (applyingValue) return
        nativeEventCount += 1
        if (field.selectionStart == field.selectionEnd) field.setSelection(field.length())
        onChange(mapOf("value" to text.toString(), "eventCount" to nativeEventCount))
      }
    })
    field.setOnFocusChangeListener { _, focused ->
      if (focused) {
        RangeKeyboard.show(this)
        onFocus(emptyMap<String, Any>())
      } else {
        RangeKeyboard.releaseAfterFocusChange(this) { onBlur(emptyMap<String, Any>()) }
      }
    }
    field.setOnClickListener {
      if (field.isEnabled) RangeKeyboard.show(this)
    }
    initialized = true
  }

  fun applyProps() {
    field.setTextSize(TypedValue.COMPLEX_UNIT_PX, (fontSize * resources.displayMetrics.density * min(resources.configuration.fontScale, 1.5f)).toFloat())
    if (incomingEventCount >= nativeEventCount && pendingValue != field.text.toString()) {
      val start = field.selectionStart
      val end = field.selectionEnd
      applyingValue = true
      field.setText(pendingValue)
      if (start >= 0 && end > start) field.setSelection(min(start, field.length()), min(end, field.length()))
      else field.setSelection(field.length())
      applyingValue = false
    }
    if (pendingFocusRequest != appliedFocusRequest) {
      post { requestPendingFocus() }
    }
    if (field.hasFocus()) RangeKeyboard.show(this)
  }

  fun setEditable(editable: Boolean) {
    field.isEnabled = editable
    field.isFocusable = editable
    if (!editable) {
      field.isFocusableInTouchMode = false
      field.clearFocus()
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyProps()
  }

  override fun onDetachedFromWindow() {
    release()
    super.onDetachedFromWindow()
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    post { requestPendingFocus() }
  }

  override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
    super.onWindowFocusChanged(hasWindowFocus)
    if (!hasWindowFocus && RangeKeyboard.owns(this)) RangeKeyboard.dismiss()
    if (hasWindowFocus) requestPendingFocus()
  }

  private fun requestPendingFocus() {
    if (pendingFocusRequest <= 0 || pendingFocusRequest == appliedFocusRequest || !isAttachedToWindow || !hasWindowFocus() || !field.isEnabled) return
    field.isFocusableInTouchMode = true
    if (field.requestFocus()) appliedFocusRequest = pendingFocusRequest
  }

  fun release() {
    if (RangeKeyboard.owns(this)) RangeKeyboard.dismiss()
  }
}

private object RangeKeyboard {
  var frameEvent: ((Map<String, Any>) -> Unit)? = null
  private val handler = Handler(Looper.getMainLooper())
  private var owner: ForgeRangeKeyboardView? = null
  private var root: ViewGroup? = null
  private var panel: LinearLayout? = null
  private var backDispatcher: OnBackInvokedDispatcher? = null
  private var backCallback: OnBackInvokedCallback? = null
  private var lastFrame: Map<String, Any>? = null
  private var repeating: Runnable? = null
  private var panelAppearance: String? = null
  private val globalLayout = ViewTreeObserver.OnGlobalLayoutListener { positionPanel() }

  fun owns(view: ForgeRangeKeyboardView) = owner === view && panel != null

  fun show(view: ForgeRangeKeyboardView) {
    if (!view.field.isEnabled || !view.isAttachedToWindow) return
    val nextRoot = view.rootView as? ViewGroup ?: return
    val appearanceChanged = panelAppearance != view.appearance
    val changedField = owner !== view
    owner = view
    if (changedField || panel == null) {
      (view.context.getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager)?.hideSoftInputFromWindow(view.field.windowToken, 0)
    }
    if (root === nextRoot && panel != null && !appearanceChanged) {
      positionPanel()
      return
    }
    removePanel(emitHidden = false)
    root = nextRoot
    panelAppearance = view.appearance
    panel = createPanel(view)
    // The focused root is the Dialog's decor for RN Modal fields, not the Activity decor.
    nextRoot.addView(panel, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
    nextRoot.viewTreeObserver.addOnGlobalLayoutListener(globalLayout)
    if (Build.VERSION.SDK_INT >= 33) {
      backDispatcher = nextRoot.findOnBackInvokedDispatcher()
      backCallback = OnBackInvokedCallback { dismiss() }
      backDispatcher?.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_OVERLAY, backCallback!!)
    }
    panel?.post { positionPanel() }
  }

  fun releaseAfterFocusChange(view: ForgeRangeKeyboardView, onBlur: () -> Unit) {
    handler.post {
      if (owner === view && !view.field.hasFocus()) dismiss()
      onBlur()
    }
  }

  fun dismissOnMainThread() {
    if (Looper.myLooper() === Looper.getMainLooper()) dismiss() else handler.post { dismiss() }
  }

  fun dismiss() {
    val previous = owner
    owner = null
    removePanel(emitHidden = true)
    previous?.field?.let {
      it.isFocusableInTouchMode = false
      it.clearFocus()
    }
  }

  private fun removePanel(emitHidden: Boolean) {
    stopRepeating()
    if (Build.VERSION.SDK_INT >= 33) backCallback?.let { backDispatcher?.unregisterOnBackInvokedCallback(it) }
    backCallback = null
    backDispatcher = null
    root?.let {
      if (it.viewTreeObserver.isAlive) it.viewTreeObserver.removeOnGlobalLayoutListener(globalLayout)
      panel?.let { content -> it.removeView(content) }
    }
    panel = null
    panelAppearance = null
    root = null
    if (emitHidden) emitFrame(mapOf("visible" to false, "height" to 0.0, "screenY" to 0.0, "screenX" to 0.0, "width" to 0.0, "duration" to 0))
  }

  private fun positionPanel() {
    val container = root ?: return
    val content = panel ?: return
    val density = container.resources.displayMetrics.density
    val bottomInset = if (Build.VERSION.SDK_INT >= 30) {
      container.rootWindowInsets?.getInsets(android.view.WindowInsets.Type.navigationBars())?.bottom ?: 0
    } else {
      @Suppress("DEPRECATION")
      val inset = container.rootWindowInsets?.systemWindowInsetBottom ?: 0
      inset
    }
    if (content.paddingBottom != bottomInset + dp(container.context, 8)) {
      content.setPadding(dp(container.context, 6), dp(container.context, 8), dp(container.context, 6), bottomInset + dp(container.context, 8))
    }
    content.measure(View.MeasureSpec.makeMeasureSpec(container.width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(container.height, View.MeasureSpec.AT_MOST))
    content.layout(0, container.height - content.measuredHeight, container.width, container.height)
    if (container.indexOfChild(content) != container.childCount - 1) content.bringToFront()
    val location = IntArray(2)
    content.getLocationOnScreen(location)
    emitFrame(mapOf("visible" to true, "height" to content.height / density.toDouble(), "screenY" to location[1] / density.toDouble(), "screenX" to 0.0, "width" to content.width / density.toDouble(), "duration" to 0))
  }

  private fun emitFrame(frame: Map<String, Any>) {
    if (frame == lastFrame) return
    lastFrame = frame
    frameEvent?.invoke(frame)
  }

  private fun createPanel(view: ForgeRangeKeyboardView): LinearLayout {
    val context = view.context
    val dark = view.appearance == "dark"
    val surface = Color.parseColor(if (dark) "#202226" else "#D4D6D5")
    val keySurface = Color.parseColor(if (dark) "#414448" else "#FFFFFF")
    val foreground = Color.parseColor(if (dark) "#F7F8F6" else "#17191C")
    val content = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(surface)
      elevation = dp(context, 12).toFloat()
      isClickable = true
      importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
    }
    val toolbar = LinearLayout(context).apply { gravity = Gravity.RIGHT }
    toolbar.addView(key(context, "Done", "Done", keySurface, foreground) { dismiss() }, LinearLayout.LayoutParams(dp(context, 80), dp(context, 44)))
    content.addView(toolbar)
    listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf("-", "0", "⌫")).forEach { rowKeys ->
      val row = LinearLayout(context)
      rowKeys.forEach { symbol ->
        val label = when (symbol) { "-" -> "Range separator"; "⌫" -> "Delete"; else -> symbol }
        val button = key(context, symbol, label, keySurface, foreground) {
          if (symbol == "⌫") delete() else insert(symbol)
        }
        if (symbol == "⌫") {
          button.setOnLongClickListener {
            delete()
            repeating = object : Runnable {
              override fun run() {
                delete()
                handler.postDelayed(this, 85)
              }
            }
            handler.postDelayed(repeating!!, 85)
            true
          }
          button.setOnTouchListener { _, event ->
            if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) stopRepeating()
            false
          }
        }
        row.addView(button, LinearLayout.LayoutParams(0, dp(context, 52), 1f).apply {
          setMargins(dp(context, 3), dp(context, 3), dp(context, 3), dp(context, 3))
        })
      }
      content.addView(row, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    }
    return content
  }

  private fun key(context: Context, text: String, label: String, surface: Int, foreground: Int, action: () -> Unit): Button = Button(context).apply {
    this.text = text
    contentDescription = label
    setTextColor(foreground)
    setTextSize(TypedValue.COMPLEX_UNIT_PX, 24 * resources.displayMetrics.density * min(resources.configuration.fontScale, 1.5f))
    isAllCaps = false
    isFocusable = false
    minWidth = 0
    minHeight = 0
    minimumWidth = 0
    minimumHeight = 0
    setPadding(0, 0, 0, 0)
    background = StateListDrawable().apply {
      addState(intArrayOf(android.R.attr.state_pressed), shape(surface, context, pressed = true))
      addState(intArrayOf(), shape(surface, context, pressed = false))
    }
    setOnClickListener { action() }
  }

  private fun shape(color: Int, context: Context, pressed: Boolean) = GradientDrawable().apply {
    cornerRadius = dp(context, 8).toFloat()
    val dark = Color.red(color) + Color.green(color) + Color.blue(color) < 384
    fun channel(value: Int) = if (dark) value + ((255 - value) * 0.2).roundToInt() else (value * 0.82).roundToInt()
    setColor(if (pressed) Color.rgb(channel(Color.red(color)), channel(Color.green(color)), channel(Color.blue(color))) else color)
  }

  private fun insert(value: String) {
    val field = owner?.field ?: return
    val start = field.selectionStart.coerceAtLeast(0)
    val end = field.selectionEnd.coerceAtLeast(start)
    field.text.replace(start, end, value)
  }

  private fun delete() {
    val field = owner?.field ?: return
    val start = field.selectionStart.coerceAtLeast(0)
    val end = field.selectionEnd.coerceAtLeast(start)
    if (end > start) field.text.delete(start, end)
    else if (start > 0) field.text.delete(start - 1, start)
  }

  private fun stopRepeating() {
    repeating?.let { handler.removeCallbacks(it) }
    repeating = null
  }

  private fun dp(context: Context, value: Int) = (value * context.resources.displayMetrics.density).roundToInt()
}
