import ExpoModulesCore
import Foundation
import UIKit
import UniformTypeIdentifiers

/// Errors reach JavaScript as `<kind>: <detail>`, where kind is one of
/// unavailable, no-space, not-downloaded or unknown.
final class ForgeBackupStorageException: GenericException<(kind: String, detail: String)> {
  override var reason: String { "\(param.kind): \(param.detail)" }
}

private func storageError(_ kind: String, _ detail: String) -> ForgeBackupStorageException {
  ForgeBackupStorageException((kind: kind, detail: detail))
}

/// Backups live in two roots:
/// - `icloud`: `<ubiquity container>/ForgeBackups`, outside the container's Documents
///   folder, so it never appears in the Files app.
/// - `folder`: a folder the user picked in Files (for example On My iPhone ›
///   Forge Backups). It is outside the app, so deleting Forge keeps it. Access
///   across launches comes from a security-scoped bookmark.
/// Paths from JavaScript are relative to the root and may not climb out of it.
final class ForgeBackupStorage {
  static let shared = ForgeBackupStorage()
  private static let bookmarkKey = "forge.backupFolderBookmark"
  private static let subfolder = "Forge Backups"
  private var cachedICloudRoot: URL?
  private let lock = NSLock()

  // MARK: Roots

  /// `url(forUbiquityContainerIdentifier:)` can block, so it only runs on the
  /// module's background queue, and the result is cached.
  func iCloudRoot() throws -> URL {
    lock.lock()
    defer { lock.unlock() }
    if let cachedICloudRoot { return cachedICloudRoot }
    guard FileManager.default.ubiquityIdentityToken != nil else {
      throw storageError("unavailable", "iCloud is signed out or iCloud Drive is off.")
    }
    guard let container = FileManager.default.url(forUbiquityContainerIdentifier: nil) else {
      throw storageError("unavailable", "This build has no iCloud container.")
    }
    let root = container.appendingPathComponent("ForgeBackups", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    cachedICloudRoot = root
    return root
  }

  /// The picked folder, resolved from its bookmark. A stale bookmark (the folder
  /// moved or was renamed) is refreshed; a missing folder reports unavailable.
  func pickedFolder() throws -> URL {
    guard let data = UserDefaults.standard.data(forKey: Self.bookmarkKey) else {
      throw storageError("unavailable", "No backup folder is chosen.")
    }
    var stale = false
    guard let url = try? URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale) else {
      throw storageError("unavailable", "The backup folder can no longer be found.")
    }
    if stale, let fresh = try? withAccess(url, { try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) }) {
      UserDefaults.standard.set(fresh, forKey: Self.bookmarkKey)
    }
    return url
  }

  func folderName() -> String? {
    guard let url = try? pickedFolder() else { return nil }
    return (try? withAccess(url) { FileManager.default.fileExists(atPath: url.path) }) == true ? url.lastPathComponent : nil
  }

  func saveFolder(_ url: URL) throws -> String {
    let data = try withAccess(url) { try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) }
    UserDefaults.standard.set(data, forKey: Self.bookmarkKey)
    return url.lastPathComponent
  }

  func clearFolder() {
    UserDefaults.standard.removeObject(forKey: Self.bookmarkKey)
  }

  private func withAccess<T>(_ url: URL, _ work: () throws -> T) throws -> T {
    let accessing = url.startAccessingSecurityScopedResource()
    defer { if accessing { url.stopAccessingSecurityScopedResource() } }
    return try work()
  }

  /// Runs `work` with the root's base URL, holding folder access for its duration.
  private func withRoot<T>(_ root: String, _ work: (URL) throws -> T) throws -> T {
    switch root {
    case "icloud":
      return try work(try iCloudRoot())
    case "folder":
      let folder = try pickedFolder()
      return try withAccess(folder) {
        // Keep backups together: write into "Forge Backups" unless that is the picked folder.
        let base = folder.lastPathComponent == Self.subfolder ? folder : folder.appendingPathComponent(Self.subfolder, isDirectory: true)
        try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return try work(base)
      }
    default:
      throw storageError("unknown", "Unknown backup location.")
    }
  }

  private func resolve(_ base: URL, _ path: String) throws -> URL {
    let parts = path.split(separator: "/").map(String.init)
    if parts.contains(where: { $0 == ".." || $0 == "." }) {
      throw storageError("unknown", "Invalid backup path.")
    }
    return parts.reduce(base) { $0.appendingPathComponent($1) }
  }

  // MARK: Files

  func list(_ root: String, _ directory: String) throws -> [String] {
    try withRoot(root) { base in
      let url = try resolve(base, directory)
      guard FileManager.default.fileExists(atPath: url.path) else { return [] }
      let names = try FileManager.default.contentsOfDirectory(atPath: url.path)
      // iCloud files not yet downloaded appear as `.<name>.icloud` placeholders.
      return Array(Set(names.compactMap { name -> String? in
        if name.hasPrefix(".") && name.hasSuffix(".icloud") {
          return String(name.dropFirst().dropLast(".icloud".count))
        }
        return name.hasPrefix(".") ? nil : name
      })).sorted()
    }
  }

  func read(_ root: String, _ path: String) throws -> String {
    try withRoot(root) { base in
      let url = try resolve(base, path)
      try ensureDownloaded(url)
      var result: Result<String, Error> = .failure(storageError("unknown", "Read did not run."))
      var coordinationError: NSError?
      NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &coordinationError) { readURL in
        result = Result { try String(contentsOf: readURL, encoding: .utf8) }
      }
      if let coordinationError { throw mapped(coordinationError) }
      do { return try result.get() } catch { throw mapped(error as NSError) }
    }
  }

  func write(_ root: String, _ path: String, _ text: String) throws {
    try withRoot(root) { base in
      let url = try resolve(base, path)
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      var writeError: Error?
      var coordinationError: NSError?
      NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { writeURL in
        do { try Data(text.utf8).write(to: writeURL, options: .atomic) } catch { writeError = error }
      }
      if let coordinationError { throw mapped(coordinationError) }
      if let writeError { throw mapped(writeError as NSError) }
    }
  }

  func remove(_ root: String, _ path: String) throws {
    try withRoot(root) { base in
      let url = try resolve(base, path)
      var removeError: Error?
      var coordinationError: NSError?
      NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forDeleting, error: &coordinationError) { deleteURL in
        do {
          if FileManager.default.fileExists(atPath: deleteURL.path) { try FileManager.default.removeItem(at: deleteURL) }
        } catch { removeError = error }
      }
      if let coordinationError { throw mapped(coordinationError) }
      if let removeError { throw mapped(removeError as NSError) }
    }
  }

  /// Copies a local file (a `.sqlite` backup in the app cache) into the root.
  func importFile(_ root: String, _ path: String, from source: URL) throws {
    try withRoot(root) { base in
      let url = try resolve(base, path)
      try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
      var copyError: Error?
      var coordinationError: NSError?
      NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { writeURL in
        do { try Data(contentsOf: source).write(to: writeURL, options: .atomic) } catch { copyError = error }
      }
      if let coordinationError { throw mapped(coordinationError) }
      if let copyError { throw mapped(copyError as NSError) }
    }
  }

  /// Copies a file from the root to a local destination (the app cache), downloading it first if needed.
  func exportFile(_ root: String, _ path: String, to destination: URL) throws {
    try withRoot(root) { base in
      let url = try resolve(base, path)
      try ensureDownloaded(url)
      var copyError: Error?
      var coordinationError: NSError?
      NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &coordinationError) { readURL in
        do { try Data(contentsOf: readURL).write(to: destination, options: .atomic) } catch { copyError = error }
      }
      if let coordinationError { throw mapped(coordinationError) }
      if let copyError { throw mapped(copyError as NSError) }
    }
  }

  /// Writes into the iCloud container succeed locally even when the account is
  /// full; the quota error appears later, on upload. Report what iCloud did with
  /// one file: uploaded, pending, no-space or error.
  func uploadState(_ root: String, _ path: String) throws -> String {
    try withRoot(root) { base in
      var url = try resolve(base, path)
      url.removeAllCachedResourceValues()
      let values = try url.resourceValues(forKeys: [
        .isUbiquitousItemKey, .ubiquitousItemIsUploadedKey, .ubiquitousItemUploadingErrorKey,
      ])
      if values.isUbiquitousItem != true { return "error" }
      if let error = values.ubiquitousItemUploadingError {
        return error.code == NSUbiquitousFileNotUploadedDueToQuotaError ? "no-space" : "error"
      }
      return values.ubiquitousItemIsUploaded == true ? "uploaded" : "pending"
    }
  }

  /// A file restored on a new phone may exist only in iCloud (the hidden
  /// container, or a picked folder inside iCloud Drive). Ask for it and wait up
  /// to 60 seconds for the system to bring it down.
  private func ensureDownloaded(_ url: URL) throws {
    let values = try? url.resourceValues(forKeys: [.isUbiquitousItemKey, .ubiquitousItemDownloadingStatusKey])
    if values?.isUbiquitousItem != true || values?.ubiquitousItemDownloadingStatus == .current { return }
    do { try FileManager.default.startDownloadingUbiquitousItem(at: url) } catch { throw mapped(error as NSError) }
    let deadline = Date().addingTimeInterval(60)
    while Date() < deadline {
      var fresh = url
      fresh.removeAllCachedResourceValues()
      if (try? fresh.resourceValues(forKeys: [.ubiquitousItemDownloadingStatusKey]))?.ubiquitousItemDownloadingStatus == .current {
        return
      }
      Thread.sleep(forTimeInterval: 0.25)
    }
    throw storageError("not-downloaded", "The backup is still downloading from iCloud.")
  }

  private func mapped(_ error: NSError) -> Error {
    if error is ForgeBackupStorageException { return error }
    if error.domain == NSCocoaErrorDomain && error.code == NSFileWriteOutOfSpaceError {
      return storageError("no-space", "The storage is full.")
    }
    if error.domain == NSPOSIXErrorDomain && error.code == Int(ENOSPC) {
      return storageError("no-space", "The storage is full.")
    }
    if error.domain == NSCocoaErrorDomain && (error.code == NSUbiquitousFileUnavailableError || error.code == NSUbiquitousFileUbiquityServerNotAvailable) {
      return storageError("unavailable", error.localizedDescription)
    }
    if error.domain == NSCocoaErrorDomain && (error.code == NSFileReadNoPermissionError || error.code == NSFileWriteNoPermissionError) {
      return storageError("unavailable", "Forge no longer has access to the backup folder.")
    }
    if error.domain == NSCocoaErrorDomain && error.code == NSFileReadNoSuchFileError {
      return storageError("not-downloaded", "The file is not there.")
    }
    return storageError("unknown", error.localizedDescription)
  }
}

/// Presents the Files folder picker and keeps itself alive until it finishes.
private final class FolderPicker: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  private var promise: Promise?
  private var retainSelf: FolderPicker?

  init(promise: Promise) {
    self.promise = promise
    super.init()
    retainSelf = self
  }

  func present(from controller: UIViewController) {
    let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
    picker.delegate = self
    picker.presentationController?.delegate = self
    picker.allowsMultipleSelection = false
    controller.present(picker, animated: true)
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else { return finish(nil) }
    DispatchQueue.global(qos: .userInitiated).async {
      do { self.finish(try ForgeBackupStorage.shared.saveFolder(url)) } catch { self.fail(error) }
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { finish(nil) }
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) { finish(nil) }

  private func finish(_ name: String?) {
    promise?.resolve(name)
    promise = nil
    retainSelf = nil
  }

  private func fail(_ error: Error) {
    promise?.reject(storageError("unavailable", error.localizedDescription))
    promise = nil
    retainSelf = nil
  }
}

public final class ForgeBackupStorageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ForgeBackupStorage")

    AsyncFunction("isICloudAvailableAsync") { () -> Bool in
      (try? ForgeBackupStorage.shared.iCloudRoot()) != nil
    }

    /// Resolves the folder name, or null when the person cancels.
    AsyncFunction("pickFolderAsync") { (promise: Promise) in
      guard let controller = self.appContext?.utilities?.currentViewController() else {
        promise.reject(storageError("unavailable", "Forge could not open the folder picker."))
        return
      }
      FolderPicker(promise: promise).present(from: controller)
    }.runOnQueue(.main)

    /// The chosen folder's name, or null when none is chosen or it is gone.
    AsyncFunction("folderNameAsync") { () -> String? in
      ForgeBackupStorage.shared.folderName()
    }

    AsyncFunction("clearFolderAsync") {
      ForgeBackupStorage.shared.clearFolder()
    }

    AsyncFunction("listAsync") { (root: String, directory: String) -> [String] in
      try ForgeBackupStorage.shared.list(root, directory)
    }

    AsyncFunction("readAsync") { (root: String, path: String) -> String in
      try ForgeBackupStorage.shared.read(root, path)
    }

    AsyncFunction("writeAsync") { (root: String, path: String, text: String) in
      try ForgeBackupStorage.shared.write(root, path, text)
    }

    AsyncFunction("importFileAsync") { (root: String, path: String, sourceUri: String) in
      guard let source = URL(string: sourceUri) else { throw storageError("unknown", "Invalid file link.") }
      try ForgeBackupStorage.shared.importFile(root, path, from: source)
    }

    AsyncFunction("exportFileAsync") { (root: String, path: String, destinationUri: String) in
      guard let destination = URL(string: destinationUri) else { throw storageError("unknown", "Invalid file link.") }
      try ForgeBackupStorage.shared.exportFile(root, path, to: destination)
    }

    AsyncFunction("uploadStateAsync") { (root: String, path: String) -> String in
      try ForgeBackupStorage.shared.uploadState(root, path)
    }

    /// Reads a document another app handed over in place (security-scoped URL),
    /// for example a `.forge` file opened from Files or Mail.
    AsyncFunction("readExternalTextAsync") { (uri: String) -> String in
      guard let url = URL(string: uri) else { throw storageError("unknown", "Invalid file link.") }
      let accessing = url.startAccessingSecurityScopedResource()
      defer { if accessing { url.stopAccessingSecurityScopedResource() } }
      var result: Result<String, Error> = .failure(storageError("unknown", "Read did not run."))
      var coordinationError: NSError?
      NSFileCoordinator(filePresenter: nil).coordinate(readingItemAt: url, options: [], error: &coordinationError) { readURL in
        result = Result { try String(contentsOf: readURL, encoding: .utf8) }
      }
      if let coordinationError { throw storageError("unavailable", coordinationError.localizedDescription) }
      return try result.get()
    }

    AsyncFunction("removeAsync") { (root: String, path: String) in
      try ForgeBackupStorage.shared.remove(root, path)
    }
  }
}
