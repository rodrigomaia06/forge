import ExpoModulesCore
import UIKit

public final class ForgeRangeKeyboardModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ForgeRangeKeyboard")
    Events("keyboardFrameChange")

    Function("dismiss") {
      DispatchQueue.main.async {
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
          scene.windows.forEach { $0.endEditing(true) }
        }
      }
    }

    View(ForgeRangeKeyboardView.self) {
      Events("onChange", "onFocus", "onBlur")
      Prop("value") { (view, value: String) in view.pendingValue = value }
      Prop("mostRecentEventCount") { (view, count: Int) in view.pendingEventCount = count }
      Prop("editable") { (view, editable: Bool) in view.field.isEnabled = editable }
      Prop("placeholder") { (view, placeholder: String) in view.placeholder = placeholder }
      Prop("textColor") { (view, color: Int?) in view.textColor = color }
      Prop("placeholderTextColor") { (view, color: Int?) in view.placeholderColor = color }
      Prop("fontSize") { (view, size: Double) in view.fontSize = CGFloat(size) }
      Prop("fontFamily") { (view, family: String) in view.fontFamily = family }
      Prop("textAlign") { (view, alignment: String) in
        view.field.textAlignment = alignment == "left" ? .left : alignment == "right" ? .right : .center
      }
      Prop("appearance") { (view, appearance: String) in view.appearance = appearance }
      Prop("accessibilityLabel") { (view, label: String) in view.field.accessibilityLabel = label }
      Prop("focusRequest") { (view, request: Int) in view.pendingFocusRequest = request }
      OnViewDidUpdateProps { (view: ForgeRangeKeyboardView) in view.applyProps() }
      AsyncFunction("focus") { (view: ForgeRangeKeyboardView) in view.field.becomeFirstResponder() }
      AsyncFunction("blur") { (view: ForgeRangeKeyboardView) in view.field.resignFirstResponder() }
    }
  }
}

final class ForgeRangeKeyboardView: ExpoView, UITextFieldDelegate {
  let onChange = EventDispatcher()
  let onFocus = EventDispatcher()
  let onBlur = EventDispatcher()
  let field = UITextField()
  var pendingValue = ""
  var pendingEventCount = 0
  var pendingFocusRequest = 0
  var placeholder = ""
  var textColor: Int?
  var placeholderColor: Int?
  var fontSize: CGFloat = 16
  var fontFamily = ""
  var appearance = "light"
  private var nativeEventCount = 0
  private var appliedFocusRequest = 0
  private var restoringSelection = false
  private lazy var keypad = ForgeRangeKeypad()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    field.delegate = self
    field.borderStyle = .none
    field.autocorrectionType = .no
    field.spellCheckingType = .no
    field.smartDashesType = .no
    field.smartQuotesType = .no
    field.textAlignment = .center
    field.keyboardType = .numbersAndPunctuation
    field.addTarget(self, action: #selector(valueChanged), for: .editingChanged)
    keypad.field = field
    field.inputView = keypad
    field.inputAccessoryView = keypad.accessory
    addSubview(field)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    field.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      keypad.stopRepeating()
      field.resignFirstResponder()
    } else {
      applyFocusRequest()
    }
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    updateFont()
  }

  func applyProps() {
    if pendingEventCount >= nativeEventCount, field.text != pendingValue {
      field.text = pendingValue
      moveCaretToEnd()
    }
    let interfaceStyle: UIUserInterfaceStyle = appearance == "dark" ? .dark : .light
    overrideUserInterfaceStyle = interfaceStyle
    keypad.overrideUserInterfaceStyle = interfaceStyle
    keypad.accessory.overrideUserInterfaceStyle = interfaceStyle
    field.keyboardAppearance = appearance == "dark" ? .dark : .light
    field.textColor = textColor.map(argbColor) ?? .label
    field.attributedPlaceholder = NSAttributedString(
      string: placeholder,
      attributes: [.foregroundColor: placeholderColor.map(argbColor) ?? UIColor.placeholderText]
    )
    updateFont()
    applyFocusRequest()
  }

  private func applyFocusRequest() {
    if pendingFocusRequest > appliedFocusRequest, field.isEnabled, window != nil {
      if field.becomeFirstResponder() { appliedFocusRequest = pendingFocusRequest }
    }
  }

  private func updateFont() {
    let size = max(1, fontSize)
    let font = UIFont(name: fontFamily, size: size) ?? UIFont.systemFont(ofSize: size)
    field.font = UIFontMetrics(forTextStyle: .body).scaledFont(
      for: font, compatibleWith: traitCollection
    )
    field.adjustsFontForContentSizeCategory = true
  }

  @objc private func valueChanged() {
    nativeEventCount += 1
    onChange(["value": field.text ?? "", "eventCount": nativeEventCount])
  }

  func textFieldDidBeginEditing(_ textField: UITextField) {
    moveCaretToEnd()
    onFocus([:])
  }

  func textFieldShouldReturn(_ textField: UITextField) -> Bool {
    field.resignFirstResponder()
    return true
  }

  func textFieldDidEndEditing(_ textField: UITextField) {
    keypad.stopRepeating()
    onBlur([:])
  }

  func textFieldDidChangeSelection(_ textField: UITextField) {
    guard !restoringSelection, let selection = field.selectedTextRange, selection.isEmpty else { return }
    if field.compare(selection.end, to: field.endOfDocument) != .orderedSame { moveCaretToEnd() }
  }

  private func moveCaretToEnd() {
    restoringSelection = true
    field.selectedTextRange = field.textRange(from: field.endOfDocument, to: field.endOfDocument)
    restoringSelection = false
  }
}

private func argbColor(_ encoded: Int) -> UIColor {
  let color = UInt32(truncatingIfNeeded: encoded)
  return UIColor(
    red: CGFloat((color >> 16) & 255) / 255,
    green: CGFloat((color >> 8) & 255) / 255,
    blue: CGFloat(color & 255) / 255,
    alpha: CGFloat((color >> 24) & 255) / 255
  )
}

final class ForgeRangeKeypad: UIInputView, UIInputViewAudioFeedback {
  weak var field: UITextField?
  let accessory = UIView(frame: CGRect(x: 0, y: 0, width: 0, height: 44))
  private let grid = UIStackView()
  private var repeatTimer: Timer?
  private let doneButton = UIButton(type: .system)
  var enableInputClicksWhenVisible: Bool { true }

  init() {
    super.init(frame: CGRect(x: 0, y: 0, width: 0, height: 216), inputViewStyle: .keyboard)
    allowsSelfSizing = true
    autoresizingMask = [.flexibleWidth]
    backgroundColor = .systemGray5
    grid.axis = .vertical
    grid.spacing = 7
    grid.distribution = .fillEqually
    grid.translatesAutoresizingMaskIntoConstraints = false
    addSubview(grid)
    NSLayoutConstraint.activate([
      grid.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
      grid.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
      grid.topAnchor.constraint(equalTo: topAnchor, constant: 7),
      grid.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -7),
    ])
    for keys in [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["-", "0", "delete"]] {
      let row = UIStackView()
      row.axis = .horizontal
      row.spacing = 6
      row.distribution = .fillEqually
      for key in keys { row.addArrangedSubview(makeKey(key)) }
      grid.addArrangedSubview(row)
    }
    accessory.backgroundColor = .systemGray5
    doneButton.setTitle("Done", for: .normal)
    doneButton.titleLabel?.font = .preferredFont(forTextStyle: .body)
    doneButton.accessibilityLabel = "Done"
    doneButton.translatesAutoresizingMaskIntoConstraints = false
    doneButton.addTarget(self, action: #selector(done), for: .touchUpInside)
    accessory.addSubview(doneButton)
    NSLayoutConstraint.activate([
      doneButton.trailingAnchor.constraint(equalTo: accessory.trailingAnchor, constant: -12),
      doneButton.topAnchor.constraint(equalTo: accessory.topAnchor),
      doneButton.bottomAnchor.constraint(equalTo: accessory.bottomAnchor),
      doneButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 60),
    ])
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  override var intrinsicContentSize: CGSize { CGSize(width: UIView.noIntrinsicMetric, height: 216) }

  private func makeKey(_ value: String) -> UIButton {
    let button = ForgeRangeKeyButton(type: .system)
    button.accessibilityIdentifier = value
    button.accessibilityLabel = value == "delete" ? "Delete" : value == "-" ? "Range separator" : value
    var configuration = UIButton.Configuration.plain()
    configuration.baseForegroundColor = .label
    configuration.background.backgroundColor = value == "delete" || value == "-" ? .clear : .secondarySystemGroupedBackground
    configuration.background.cornerRadius = 5
    if value == "delete" {
      configuration.image = UIImage(systemName: "delete.left")
    } else {
      configuration.title = value == "-" ? "−" : value
    }
    configuration.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { attributes in
      var updated = attributes
      updated.font = UIFont.systemFont(ofSize: 27, weight: .regular)
      return updated
    }
    button.configuration = configuration
    button.configurationUpdateHandler = { button in
      var updated = button.configuration
      updated?.background.backgroundColor = button.isHighlighted ? .systemGray3 :
        value == "delete" || value == "-" ? .clear : .secondarySystemGroupedBackground
      button.configuration = updated
    }
    if value == "delete" {
      button.accessibilityAction = { [weak self] in self?.deleteOnce() }
      button.addTarget(self, action: #selector(deleteDown), for: .touchDown)
      button.addTarget(self, action: #selector(stopRepeating), for: [.touchUpInside, .touchUpOutside, .touchCancel, .touchDragExit])
    } else {
      button.addTarget(self, action: #selector(insertKey(_:)), for: .touchUpInside)
    }
    return button
  }

  @objc private func insertKey(_ button: UIButton) {
    guard let field, let value = button.accessibilityIdentifier else { return }
    UIDevice.current.playInputClick()
    field.insertText(value)
  }

  @objc private func deleteDown() {
    stopRepeating()
    deleteOnce()
    let delay = Timer(timeInterval: 0.35, repeats: false) { [weak self] _ in
      MainActor.assumeIsolated {
        guard let self else { return }
        self.deleteOnce()
        let repeated = Timer(timeInterval: 0.08, repeats: true) { [weak self] _ in
          MainActor.assumeIsolated { self?.deleteOnce() }
        }
        self.repeatTimer = repeated
        RunLoop.main.add(repeated, forMode: .common)
      }
    }
    repeatTimer = delay
    RunLoop.main.add(delay, forMode: .common)
  }

  private func deleteOnce() {
    guard let field else { return }
    UIDevice.current.playInputClick()
    field.deleteBackward()
  }

  @objc func stopRepeating() {
    repeatTimer?.invalidate()
    repeatTimer = nil
  }

  @objc private func done() {
    stopRepeating()
    field?.resignFirstResponder()
  }

  deinit { repeatTimer?.invalidate() }
}

private final class ForgeRangeKeyButton: UIButton {
  var accessibilityAction: (() -> Void)?

  override func accessibilityActivate() -> Bool {
    guard let accessibilityAction else { return super.accessibilityActivate() }
    accessibilityAction()
    return true
  }
}
