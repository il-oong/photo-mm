import XCTest
import UIKit
@testable import PhotoMM

final class PhotoMMTests: XCTestCase {
    func testMillimeterValidation() {
        XCTAssertEqual(Annotation.validMillimeters(" 1250 "), "1250")
        XCTAssertEqual(Annotation.validMillimeters("12.50"), "12.5")
        XCTAssertEqual(Annotation.validMillimeters("0,25"), "0.25")
        for invalid in ["", "0", "-2", "NaN", "1e3", "12mm", "1.234", "10000000", "1,250"] {
            XCTAssertNil(Annotation.validMillimeters(invalid), invalid)
        }
    }

    func testNormalizedCoordinatesPreservePlacementAtExportSize() {
        let point = PhotoPoint(x: 0.25, y: 0.75)
        XCTAssertEqual(point.position(in: CGSize(width: 400, height: 200)), CGPoint(x: 100, y: 150))
        XCTAssertEqual(point.position(in: CGSize(width: 2400, height: 1200)), CGPoint(x: 600, y: 900))
        XCTAssertEqual(PhotoPoint(x: -1, y: 2), PhotoPoint(x: 0, y: 1))
    }

    @MainActor
    func testSaveReopenPreservesOriginalAndEditableAnnotations() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = DocumentStore(root: root)
        let data = try XCTUnwrap(UIGraphicsImageRenderer(size: CGSize(width: 200, height: 100)).image { _ in
            UIColor.white.setFill()
            UIRectFill(CGRect(x: 0, y: 0, width: 200, height: 100))
        }.pngData())
        var document = try store.importPhoto(data)
        document.title = "창문"
        document.annotations = [Annotation(kind: .dimension, start: PhotoPoint(x: 0.1, y: 0.5),
                                           end: PhotoPoint(x: 0.9, y: 0.5), text: "1250", ink: .blue, fontSize: 24)]
        try store.save(document)
        let reopened = DocumentStore(root: root)
        XCTAssertNil(reopened.errorMessage)
        XCTAssertEqual(reopened.documents.first?.annotations, document.annotations)
        XCTAssertEqual(reopened.documents.first?.title, "창문")
        XCTAssertEqual(try Data(contentsOf: reopened.imageURL(document.id)), data)
        let image = try XCTUnwrap(reopened.image(document.id))
        let exported = PhotoDrawing.export(image: image, annotations: document.annotations)
        XCTAssertEqual(exported.size, image.size)
        XCTAssertNotEqual(exported.pngData(), image.pngData())
        document.annotations[0].text = "1300"
        try reopened.save(document)
        XCTAssertEqual(DocumentStore(root: root).documents.first?.annotations.first?.text, "1300")
    }

    @MainActor
    func testInvalidImportDoesNotCreateDocuments() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = DocumentStore(root: root)
        XCTAssertThrowsError(try store.importPhoto(Data("not a photo".utf8)))
        XCTAssertTrue(store.documents.isEmpty)
        XCTAssertTrue(try FileManager.default.contentsOfDirectory(atPath: root.path).isEmpty)
    }

    @MainActor
    func testUnreadableRecordIsReportedAndPreserved() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = DocumentStore(root: root)
        defer { try? FileManager.default.removeItem(at: root) }
        let file = root.appendingPathComponent("broken.json")
        try Data("broken".utf8).write(to: file)
        try store.reload()
        XCTAssertNotNil(store.errorMessage)
        XCTAssertTrue(FileManager.default.fileExists(atPath: file.path))
    }

    func testEdgeLabelsStayInsidePhoto() {
        let size = CGSize(width: 390, height: 240)
        for point in [PhotoPoint(x: 0, y: 0), PhotoPoint(x: 1, y: 1)] {
            let note = Annotation(kind: .memo, start: point, end: point, text: "창틀 안쪽 기준", fontSize: 32)
            let rect = PhotoDrawing.labelRect(note, size: size)
            XCTAssertTrue(CGRect(origin: .zero, size: size).contains(rect))
        }
    }
}
