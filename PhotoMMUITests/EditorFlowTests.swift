import XCTest

final class EditorFlowTests: XCTestCase {
    func testCreateStyleSaveReopenAndShare() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        let record = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "새 치수 기록")).firstMatch
        XCTAssertTrue(record.waitForExistence(timeout: 10))
        record.tap()
        let canvas = app.otherElements["치수 편집 사진"]
        XCTAssertTrue(canvas.waitForExistence(timeout: 10))
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.7)).tap()
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.7)).tap()
        let measurement = app.textFields["측정값"]
        XCTAssertTrue(measurement.waitForExistence(timeout: 5))
        measurement.tap()
        measurement.typeText("1250")
        app.sliders["글자 크기"].adjust(toNormalizedSliderPosition: 0.7)
        app.buttons["적용"].tap()
        app.buttons["저장"].tap()

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Photo MM — dimension editor"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        app.buttons["닫기"].tap()
        XCTAssertTrue(record.waitForExistence(timeout: 5))
        record.tap()
        app.segmentedControls.buttons["수정"].tap()
        canvas.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7)).tap()
        XCTAssertTrue(measurement.waitForExistence(timeout: 5))
        XCTAssertEqual(measurement.value as? String, "1250")
        app.buttons["취소"].tap()
        app.buttons["이미지 공유"].tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 5)
                      || app.buttons["Copy"].exists || app.buttons["복사"].exists,
                      "iOS 공유 화면이 열려야 합니다.")
    }
}
