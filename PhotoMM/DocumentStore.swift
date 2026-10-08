import SwiftUI
import ImageIO

@MainActor
final class DocumentStore: ObservableObject {
    @Published private(set) var documents: [PhotoDocument] = []
    @Published var errorMessage: String?
    let root: URL

    init(root: URL? = nil) {
        self.root = root ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PhotoMM", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: self.root, withIntermediateDirectories: true)
            try reload()
        } catch { errorMessage = "저장된 기록을 읽지 못했습니다: \(error.localizedDescription)" }
    }

    func reload() throws {
        let files = try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)
            .filter { $0.pathExtension == "json" }
        var loaded: [PhotoDocument] = []
        var failures = 0
        for file in files {
            do {
                let document = try JSONDecoder().decode(PhotoDocument.self, from: Data(contentsOf: file))
                guard document.schemaVersion == 1,
                      FileManager.default.fileExists(atPath: imageURL(document.id).path) else {
                    failures += 1
                    continue
                }
                loaded.append(document)
            } catch { failures += 1 }
        }
        documents = loaded.sorted { $0.updatedAt > $1.updatedAt }
        if failures > 0 { errorMessage = "\(failures)개 기록을 읽지 못했습니다. 원본 파일은 보관되어 있습니다." }
    }

    func imageURL(_ id: UUID) -> URL { root.appendingPathComponent("\(id).photo") }

    func image(_ id: UUID, maxPixel: Int = 2400) -> UIImage? {
        guard let source = CGImageSourceCreateWithURL(imageURL(id) as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: maxPixel
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }

    func importPhoto(_ data: Data) throws -> PhotoDocument {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              CGImageSourceGetCount(source) > 0,
              CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceThumbnailMaxPixelSize: 100
              ] as CFDictionary) != nil else { throw StoreError.invalidImage }
        let document = PhotoDocument()
        try data.write(to: imageURL(document.id), options: .atomic)
        do { try save(document) }
        catch {
            try? FileManager.default.removeItem(at: imageURL(document.id))
            throw error
        }
        return document
    }

    func save(_ document: PhotoDocument) throws {
        var saved = document
        saved.updatedAt = Date()
        try JSONEncoder().encode(saved).write(
            to: root.appendingPathComponent("\(document.id).json"), options: .atomic)
        documents.removeAll { $0.id == saved.id }
        documents.insert(saved, at: 0)
    }

    enum StoreError: LocalizedError {
        case invalidImage
        var errorDescription: String? { "이 사진을 열 수 없습니다. 다른 사진을 선택해 주세요." }
    }
}
