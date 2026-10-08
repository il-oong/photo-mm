import SwiftUI
import UIKit

extension Ink {
    var uiColor: UIColor {
        switch self {
        case .red: return .systemRed
        case .yellow: return .systemYellow
        case .blue: return .systemBlue
        case .black: return .black
        case .white: return .white
        }
    }
}

enum PhotoDrawing {
    static func labelRect(_ annotation: Annotation, size: CGSize) -> CGRect {
        let scale = size.width / 390
        let font = UIFont.boldSystemFont(ofSize: annotation.fontSize * scale)
        let bounds = (annotation.label as NSString).boundingRect(
            with: CGSize(width: max(1, size.width - 16 * scale), height: .greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: [.font: font], context: nil)
        let a = annotation.start.position(in: size)
        let b = annotation.end.position(in: size)
        let center = annotation.kind == .memo ? a : CGPoint(x: (a.x + b.x) / 2, y: (a.y + b.y) / 2)
        let width = min(size.width, ceil(bounds.width) + 12 * scale)
        let height = min(size.height, ceil(bounds.height) + 8 * scale)
        return CGRect(x: min(max(0, center.x - width / 2), size.width - width),
                      y: min(max(0, center.y - height / 2), size.height - height), width: width, height: height)
    }

    static func draw(_ annotation: Annotation, size: CGSize, context: CGContext) {
        let scale = size.width / 390
        let color = annotation.ink.uiColor
        context.saveGState()
        defer { context.restoreGState() }
        if annotation.kind == .dimension {
            let a = annotation.start.position(in: size)
            let b = annotation.end.position(in: size)
            context.setStrokeColor(color.cgColor)
            context.setLineWidth(2 * scale)
            context.setLineCap(.round)
            context.setShadow(offset: .zero, blur: 2 * scale, color: UIColor.black.withAlphaComponent(0.6).cgColor)
            context.move(to: a); context.addLine(to: b)
            let angle = atan2(b.y - a.y, b.x - a.x)
            for (point, direction) in [(a, angle), (b, angle + .pi)] {
                for offset in [-CGFloat.pi / 6, CGFloat.pi / 6] {
                    context.move(to: point)
                    context.addLine(to: CGPoint(x: point.x + cos(direction + offset) * 10 * scale,
                                               y: point.y + sin(direction + offset) * 10 * scale))
                }
            }
            context.strokePath()
            context.setShadow(offset: .zero, blur: 0)
        }
        let rect = labelRect(annotation, size: size)
        let background: UIColor = annotation.ink == .black ? UIColor.white.withAlphaComponent(0.92) : UIColor.black.withAlphaComponent(0.78)
        background.setFill()
        UIBezierPath(roundedRect: rect, cornerRadius: 4 * scale).fill()
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        (annotation.label as NSString).draw(
            with: rect.insetBy(dx: 6 * scale, dy: 4 * scale),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: UIFont.boldSystemFont(ofSize: annotation.fontSize * scale),
                         .foregroundColor: color, .paragraphStyle: paragraph], context: nil)
    }

    static func export(image: UIImage, annotations: [Annotation]) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: image.size, format: format).image { renderer in
            image.draw(in: CGRect(origin: .zero, size: image.size))
            for annotation in annotations { draw(annotation, size: image.size, context: renderer.cgContext) }
        }
    }
}

struct PhotoCanvas: UIViewRepresentable {
    var image: UIImage
    var annotations: [Annotation]
    var pending: PhotoPoint?
    var canMove: Bool
    var onTap: (PhotoPoint, UUID?) -> Void
    var onMove: (UUID, PhotoPoint, Bool) -> Void

    func makeUIView(context: Context) -> ZoomCanvas {
        ZoomCanvas()
    }

    func updateUIView(_ view: ZoomCanvas, context: Context) {
        view.canvas.image = image
        view.canvas.annotations = annotations
        view.canvas.pending = pending
        view.canvas.canMove = canMove
        view.canvas.onTap = onTap
        view.canvas.onMove = onMove
        view.canvas.setNeedsDisplay()
        view.setNeedsLayout()
    }
}

final class ZoomCanvas: UIScrollView, UIScrollViewDelegate {
    let canvas = DrawingView()
    private var previousSize: CGSize = .zero

    init() {
        super.init(frame: .zero)
        delegate = self
        minimumZoomScale = 1
        maximumZoomScale = 5
        backgroundColor = .black
        panGestureRecognizer.minimumNumberOfTouches = 2
        addSubview(canvas)
        canvas.isAccessibilityElement = true
        canvas.accessibilityLabel = "치수 편집 사진"
        canvas.accessibilityHint = "치수선 모드에서 두 지점을 누르세요. 두 손가락으로 확대하고 이동할 수 있습니다."
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard let image = canvas.image, bounds.width > 0, bounds.height > 0 else { return }
        if previousSize != bounds.size {
            previousSize = bounds.size
            setZoomScale(1, animated: false)
            let scale = min(bounds.width / image.size.width, bounds.height / image.size.height)
            canvas.frame = CGRect(origin: .zero, size: CGSize(width: image.size.width * scale, height: image.size.height * scale))
            contentSize = canvas.bounds.size
        }
        centerCanvas()
    }

    private func centerCanvas() {
        contentInset = UIEdgeInsets(top: max(0, (bounds.height - contentSize.height) / 2),
                                   left: max(0, (bounds.width - contentSize.width) / 2),
                                   bottom: 0, right: 0)
    }
    func viewForZooming(in scrollView: UIScrollView) -> UIView? { canvas }
    func scrollViewDidZoom(_ scrollView: UIScrollView) { centerCanvas() }
}

final class DrawingView: UIView, UIGestureRecognizerDelegate {
    var image: UIImage?
    var annotations: [Annotation] = []
    var pending: PhotoPoint?
    var canMove = false
    var onTap: ((PhotoPoint, UUID?) -> Void)?
    var onMove: ((UUID, PhotoPoint, Bool) -> Void)?
    private var dragging: (UUID, Bool)?
    private var preview: PhotoPoint?

    init() {
        super.init(frame: .zero)
        contentMode = .redraw
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tap(_:))))
        let pan = UIPanGestureRecognizer(target: self, action: #selector(pan(_:)))
        pan.maximumNumberOfTouches = 1
        pan.delegate = self
        addGestureRecognizer(pan)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func draw(_ rect: CGRect) {
        guard let context = UIGraphicsGetCurrentContext() else { return }
        image?.draw(in: bounds)
        for var annotation in annotations {
            if let dragging, dragging.0 == annotation.id, let preview {
                if dragging.1 { annotation.end = preview } else { annotation.start = preview }
            }
            PhotoDrawing.draw(annotation, size: bounds.size, context: context)
            if canMove {
                for point in annotation.kind == .dimension ? [annotation.start, annotation.end] : [annotation.start] {
                    let p = point.position(in: bounds.size)
                    UIColor.white.setStroke()
                    let circle = UIBezierPath(ovalIn: CGRect(x: p.x - 5, y: p.y - 5, width: 10, height: 10))
                    circle.lineWidth = 2
                    circle.stroke()
                }
            }
        }
        if let pending {
            let point = pending.position(in: bounds.size)
            UIColor.systemOrange.setFill()
            UIBezierPath(ovalIn: CGRect(x: point.x - 6, y: point.y - 6, width: 12, height: 12)).fill()
        }
    }

    private func normalized(_ point: CGPoint) -> PhotoPoint {
        PhotoPoint(x: point.x / max(1, bounds.width), y: point.y / max(1, bounds.height))
    }

    private func handle(at point: CGPoint) -> (UUID, Bool)? {
        let radius: CGFloat = 26 / max(1, transform.a)
        for annotation in annotations.reversed() {
            let a = annotation.start.position(in: bounds.size)
            if hypot(point.x - a.x, point.y - a.y) < radius { return (annotation.id, false) }
            if annotation.kind == .dimension {
                let b = annotation.end.position(in: bounds.size)
                if hypot(point.x - b.x, point.y - b.y) < radius { return (annotation.id, true) }
            }
            if annotation.kind == .memo && PhotoDrawing.labelRect(annotation, size: bounds.size).contains(point) {
                return (annotation.id, false)
            }
        }
        return nil
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        canMove && handle(at: gestureRecognizer.location(in: self)) != nil
    }

    @objc private func tap(_ gesture: UITapGestureRecognizer) {
        let point = gesture.location(in: self)
        guard bounds.contains(point) else { return }
        let hit = annotations.reversed().first { PhotoDrawing.labelRect($0, size: bounds.size).insetBy(dx: -8, dy: -8).contains(point) }?.id
            ?? handle(at: point)?.0
        onTap?(normalized(point), hit)
    }

    @objc private func pan(_ gesture: UIPanGestureRecognizer) {
        let point = gesture.location(in: self)
        switch gesture.state {
        case .began: dragging = handle(at: point)
        case .changed: preview = normalized(point); setNeedsDisplay()
        case .ended:
            if let dragging { onMove?(dragging.0, normalized(point), dragging.1) }
            dragging = nil; preview = nil; setNeedsDisplay()
        case .cancelled, .failed:
            dragging = nil; preview = nil; setNeedsDisplay()
        default: break
        }
    }
}
