import ExpoModulesCore
import UIKit

/**
 * An in-app input view for a numeric interval. It is deliberately an input
 * view, rather than a keyboard extension: it only appears while Forge owns the
 * focused field and retains the system keyboard's appearance/accessibility.
 */
final class ForgeRangeTextInputView: ExpoView, UITextFieldDelegate {
  let onChange = EventDispatcher()
  let onFocus = EventDispatcher()
  let onBlur = EventDispatcher()

  private let textField = UITextField(frame: .zero)
  private lazy var rangeKeyboard = ForgeRangeKeyboard(textInput: textField)
  private var isApplyingProp = false
  private var placeholderColor: UIColor = .secondaryLabel

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    backgroundColor = .clear
    textField.backgroundColor = .clear
    textField.borderStyle = .none
    textField.keyboardType = .numberPad
    textField.inputView = rangeKeyboard
    textField.delegate = self
    textField.isAccessibilityElement = true
    textField.addTarget(self, action: #selector(textDidChange), for: .editingChanged)
    textField.addTarget(self, action: #selector(textDidBeginEditing), for: .editingDidBegin)
    textField.addTarget(self, action: #selector(textDidEndEditing), for: .editingDidEnd)
    textField.adjustsFontForContentSizeCategory = true

    addSubview(textField)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    textField.frame = bounds
  }

  func setValue(_ value: String) {
    guard textField.text != value else { return }
    isApplyingProp = true
    textField.text = value
    isApplyingProp = false
  }

  func setEditable(_ editable: Bool) {
    textField.isEnabled = editable
  }

  func setPlaceholder(_ placeholder: String) {
    textField.attributedPlaceholder = NSAttributedString(
      string: placeholder,
      attributes: [.foregroundColor: placeholderColor]
    )
  }

  func setTextColor(_ color: String) {
    textField.textColor = UIColor(forgeHex: color)
  }

  func setPlaceholderColor(_ color: String) {
    placeholderColor = UIColor(forgeHex: color)
    setPlaceholder(textField.placeholder ?? textField.attributedPlaceholder?.string ?? "")
  }

  func setFontSize(_ fontSize: Double) {
    textField.font = .systemFont(ofSize: fontSize)
  }

  func setTextAlign(_ align: String) {
    textField.textAlignment = align == "left" ? .left : align == "right" ? .right : .center
  }

  func setAccessibilityLabel(_ label: String) {
    textField.accessibilityLabel = label
  }

  func requestFocus() {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.textField.becomeFirstResponder()
      let end = self.textField.endOfDocument
      self.textField.selectedTextRange = self.textField.textRange(from: end, to: end)
    }
  }

  @objc private func textDidChange() {
    guard !isApplyingProp else { return }
    onChange(["value": textField.text ?? ""])
  }

  @objc private func textDidBeginEditing() {
    onFocus()
  }

  @objc private func textDidEndEditing() {
    onBlur()
  }

  func textField(
    _ textField: UITextField,
    shouldChangeCharactersIn range: NSRange,
    replacementString string: String
  ) -> Bool {
    let current = textField.text ?? ""
    guard let range = Range(range, in: current) else { return false }
    let proposed = current.replacingCharacters(in: range, with: string)
    let normalized = Self.normalizedRange(proposed)

    if proposed == normalized {
      return true
    }

    textField.text = normalized
    textDidChange()
    return false
  }

  static func normalizedRange(_ value: String) -> String {
    var separatorFound = false
    return value.reduce(into: "") { result, character in
      if character.isNumber {
        result.append(character)
      } else if (character == "-" || character == "–" || character == "—") && !separatorFound {
        separatorFound = true
        result.append("-")
      }
    }
  }
}

/**
 * This mirrors the compact iPhone number pad and adds the one domain-specific
 * key Forge needs. Dynamic UIKit colours intentionally follow the selected
 * iOS appearance instead of introducing Forge card chrome into the keyboard.
 */
final class ForgeRangeKeyboard: UIInputView, UIInputViewAudioFeedback {
  private weak var textInput: UITextField?
  private let keyRows = [
    [("1", nil), ("2", "ABC"), ("3", "DEF")],
    [("4", "GHI"), ("5", "JKL"), ("6", "MNO")],
    [("7", "PQRS"), ("8", "TUV"), ("9", "WXYZ")],
    [("−", nil), ("0", nil), ("delete", nil)]
  ]

  var enableInputClicksWhenVisible: Bool { true }

  init(textInput: UITextField) {
    self.textInput = textInput
    // Expo Fabric can ask the input view to fit before it has assigned a
    // bounds width. Start with a valid keyboard-sized frame so the grid never
    // inherits that transient zero-width measurement.
    super.init(
      frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 291),
      inputViewStyle: .keyboard
    )
    // With self sizing enabled UIKit uses systemLayoutSizeFitting(_:). This
    // lets the view retain its own row height while still accepting a real
    // responder width after attachment.
    allowsSelfSizing = true
    // UIKit exposes dynamic semantic colours, rather than the private colours
    // used by the system keyboard. These two roles track the iPhone number pad
    // closely in both appearances without freezing an app-specific palette.
    backgroundColor = UIColor { traits in
      traits.userInterfaceStyle == .dark ? .tertiarySystemBackground : .systemGray5
    }
    buildKeyboard()
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override var intrinsicContentSize: CGSize {
    CGSize(width: fallbackWidth, height: preferredHeight)
  }

  override func systemLayoutSizeFitting(_ targetSize: CGSize) -> CGSize {
    CGSize(width: validWidth(from: targetSize.width), height: preferredHeight)
  }

  override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if previousTraitCollection?.verticalSizeClass != traitCollection.verticalSizeClass {
      invalidateIntrinsicContentSize()
    }
  }

  private var preferredHeight: CGFloat {
    // These are the compact and regular heights UIKit uses for the iPhone
    // number pad. The width remains owned by UIKit, so split view, rotation,
    // and different iPhone widths retain the normal system geometry.
    traitCollection.verticalSizeClass == .compact ? 216 : 291
  }

  private var fallbackWidth: CGFloat {
    // A custom input view always occupies the responder's width once attached.
    // Before that happens, use the screen width rather than passing through a
    // zero or `noIntrinsicMetric` fitting proposal from Fabric.
    max(UIScreen.main.bounds.width, 1)
  }

  private func validWidth(from proposedWidth: CGFloat) -> CGFloat {
    proposedWidth.isFinite && proposedWidth > 1 ? proposedWidth : fallbackWidth
  }

  private func buildKeyboard() {
    let grid = UIStackView()
    grid.translatesAutoresizingMaskIntoConstraints = false
    grid.axis = .vertical
    grid.spacing = 8
    grid.distribution = .fillEqually

    for row in keyRows {
      let stack = UIStackView()
      stack.axis = .horizontal
      stack.spacing = 12
      stack.distribution = .fillEqually
      row.forEach { title, subtitle in stack.addArrangedSubview(makeKey(title: title, subtitle: subtitle)) }
      grid.addArrangedSubview(stack)
    }

    addSubview(grid)
    NSLayoutConstraint.activate([
      grid.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
      grid.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
      grid.topAnchor.constraint(equalTo: topAnchor, constant: 8),
      grid.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -8)
    ])
  }

  private func makeKey(title: String, subtitle: String?) -> UIButton {
    let button = UIButton(type: .custom)
    button.backgroundColor = UIColor { traits in
      traits.userInterfaceStyle == .dark ? .systemGray : .systemBackground
    }
    button.layer.cornerRadius = 9
    button.layer.cornerCurve = .continuous
    button.accessibilityLabel = title == "delete" ? "Delete" : title == "−" ? "Minus" : title
    button.accessibilityTraits = .keyboardKey
    button.addTarget(self, action: #selector(keyPressed(_:)), for: .touchUpInside)
    button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
    button.addTarget(self, action: #selector(keyTouchUp(_:)), for: [.touchUpInside, .touchCancel, .touchDragExit])

    if title == "delete" {
      let image = UIImage(
        systemName: "delete.left",
        withConfiguration: UIImage.SymbolConfiguration(pointSize: 28, weight: .regular)
      )
      button.setImage(image, for: .normal)
      button.tintColor = .label
      return button
    }

    let titleLabel = UILabel()
    titleLabel.text = title
    titleLabel.textColor = .label
    titleLabel.font = .systemFont(ofSize: 30, weight: .regular)
    titleLabel.textAlignment = .center
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.translatesAutoresizingMaskIntoConstraints = false
    button.addSubview(titleLabel)

    if let subtitle {
      let subtitleLabel = UILabel()
      subtitleLabel.text = subtitle
      subtitleLabel.textColor = .label
      subtitleLabel.font = .systemFont(ofSize: 11, weight: .medium)
      subtitleLabel.textAlignment = .center
      subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
      button.addSubview(subtitleLabel)
      NSLayoutConstraint.activate([
        titleLabel.centerXAnchor.constraint(equalTo: button.centerXAnchor),
        titleLabel.centerYAnchor.constraint(equalTo: button.centerYAnchor, constant: -8),
        subtitleLabel.centerXAnchor.constraint(equalTo: button.centerXAnchor),
        subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: -2)
      ])
    } else {
      NSLayoutConstraint.activate([
        titleLabel.centerXAnchor.constraint(equalTo: button.centerXAnchor),
        titleLabel.centerYAnchor.constraint(equalTo: button.centerYAnchor)
      ])
    }

    return button
  }

  @objc private func keyPressed(_ sender: UIButton) {
    UIDevice.current.playInputClick()
    switch sender.accessibilityLabel {
    case "Delete": deleteSelectionOrPreviousCharacter()
    case "Minus": replaceSelection(with: "-")
    case let key?: replaceSelection(with: key)
    case nil: break
    }
  }

  /**
   * UIButton actions do not reliably emit UITextField's editingChanged event
   * across UIKit releases. Update the selected text explicitly and emit the
   * normal control event once so React receives every key press exactly once.
   */
  private func replaceSelection(with replacement: String) {
    guard let textInput else { return }
    let current = textInput.text ?? ""
    let selection = selectedRange(in: current)
    let prefix = String(current[..<selection.lowerBound])
    let proposed = prefix + replacement + String(current[selection.upperBound...])
    let normalized = ForgeRangeTextInputView.normalizedRange(proposed)
    let normalizedPrefix = ForgeRangeTextInputView.normalizedRange(prefix + replacement)
    apply(value: normalized, caretUTF16Offset: (normalizedPrefix as NSString).length)
  }

  private func deleteSelectionOrPreviousCharacter() {
    guard let textInput else { return }
    let current = textInput.text ?? ""
    let selection = selectedRange(in: current)
    let deleteStart = selection.isEmpty && selection.lowerBound > current.startIndex
      ? current.index(before: selection.lowerBound)
      : selection.lowerBound
    let prefix = String(current[..<deleteStart])
    let next = prefix + String(current[selection.upperBound...])
    apply(value: next, caretUTF16Offset: (prefix as NSString).length)
  }

  private func selectedRange(in value: String) -> Range<String.Index> {
    guard let textInput, let selection = textInput.selectedTextRange else {
      return value.endIndex..<value.endIndex
    }
    let range = NSRange(
      location: textInput.offset(from: textInput.beginningOfDocument, to: selection.start),
      length: textInput.offset(from: selection.start, to: selection.end)
    )
    return Range(range, in: value) ?? (value.endIndex..<value.endIndex)
  }

  private func apply(value: String, caretUTF16Offset: Int) {
    guard let textInput else { return }
    textInput.text = value
    let boundedOffset = min(caretUTF16Offset, (value as NSString).length)
    if let caret = textInput.position(from: textInput.beginningOfDocument, offset: boundedOffset) {
      textInput.selectedTextRange = textInput.textRange(from: caret, to: caret)
    }
    textInput.sendActions(for: .editingChanged)
  }

  @objc private func keyTouchDown(_ sender: UIButton) {
    sender.alpha = 0.58
  }

  @objc private func keyTouchUp(_ sender: UIButton) {
    UIView.animate(withDuration: 0.08) { sender.alpha = 1 }
  }
}

private extension UIColor {
  convenience init(forgeHex value: String) {
    let hex = value.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var number: UInt64 = 0
    Scanner(string: hex).scanHexInt64(&number)
    let red, green, blue: CGFloat
    if hex.count == 6 {
      red = CGFloat((number >> 16) & 0xFF) / 255
      green = CGFloat((number >> 8) & 0xFF) / 255
      blue = CGFloat(number & 0xFF) / 255
    } else {
      red = 1
      green = 1
      blue = 1
    }
    self.init(red: red, green: green, blue: blue, alpha: 1)
  }
}

public final class ForgeRangeTextInputModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ForgeRangeTextInput")

    View(ForgeRangeTextInputView.self) {
      Events("onChange", "onFocus", "onBlur")
      Prop("value", "") { (view, value: String) in view.setValue(value) }
      Prop("editable", true) { (view, editable: Bool) in view.setEditable(editable) }
      Prop("placeholder", "") { (view, placeholder: String) in view.setPlaceholder(placeholder) }
      Prop("textColor", "#FFFFFF") { (view, color: String) in view.setTextColor(color) }
      Prop("placeholderTextColor", "#FFFFFF") { (view, color: String) in view.setPlaceholderColor(color) }
      Prop("fontSize", 16.0) { (view, size: Double) in view.setFontSize(size) }
      Prop("textAlign", "center") { (view, align: String) in view.setTextAlign(align) }
      Prop("accessibilityLabel", "") { (view, label: String) in view.setAccessibilityLabel(label) }
      Prop("focusRequest", 0) { (view, request: Int) in
        if request > 0 { view.requestFocus() }
      }
    }
  }
}
