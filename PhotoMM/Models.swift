import Foundation
import CoreGraphics

struct PhotoPoint: Codable, Equatable {
    var x: Double
    var y: Double

    init(x: Double, y: Double) {
        self.x = min(1, max(0, x))
        self.y = min(1, max(0, y))
    }

    func position(in size: CGSize) -> CGPoint {
        CGPoint(x: x * size.width, y: y * size.height)
    }
}

enum Ink: String, Codable, CaseIterable, Identifiable {
    case red, yellow, blue, black, white
    var id: String { rawValue }
    var title: String {
        switch self {
        case .red: return "빨강"
        case .yellow: return "노랑"
        case .blue: return "파랑"
        case .black: return "검정"
        case .white: return "흰색"
        }
    }
}

struct Annotation: Codable, Equatable, Identifiable {
    enum Kind: String, Codable { case dimension, memo }
    var id = UUID()
    var kind: Kind
    var start: PhotoPoint
    var end: PhotoPoint
    var text: String = ""
    var ink: Ink = .yellow
    // Font size relative to a 390-point-wide photo, independent of device and export size.
    var fontSize: Double = 18

    var label: String {
        guard kind == .dimension else { return text }
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        let number = NSDecimalNumber(string: text, locale: Locale(identifier: "en_US_POSIX"))
        return "\(formatter.string(from: number) ?? text) mm"
    }

    static func validMillimeters(_ input: String) -> String? {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: ",", with: ".")
        guard value.range(of: #"^\d{1,7}(\.\d{1,2})?$"#, options: .regularExpression) != nil,
              let number = Decimal(string: value, locale: Locale(identifier: "en_US_POSIX")),
              number > 0, number <= 9_999_999 else { return nil }
        return NSDecimalNumber(decimal: number).stringValue
    }
}

struct PhotoDocument: Codable, Equatable, Identifiable {
    var id = UUID()
    var title: String = "새 치수 기록"
    var updatedAt = Date()
    var annotations: [Annotation] = []
    var schemaVersion = 1
}
