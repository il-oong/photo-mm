import SwiftUI

struct EditorView: View {
    @EnvironmentObject private var store: DocumentStore
    @Environment(\.dismiss) private var dismiss
    @State var document: PhotoDocument
    @State private var savedDocument: PhotoDocument?
    @State private var image: UIImage?
    @State private var mode: Mode = .dimension
    @State private var pending: PhotoPoint?
    @State private var editing: Annotation?
    @State private var history: [PhotoDocument] = []
    @State private var share: ExportedImage?
    @State private var error: String?
    @State private var confirmClose = false
    @State private var savedNotice = false
    @AppStorage("lastInk") private var lastInk = Ink.yellow.rawValue
    @AppStorage("lastFontSize") private var lastFontSize = 18.0

    enum Mode: String, CaseIterable {
        case dimension = "치수선", memo = "메모", select = "수정"
    }

    private var dirty: Bool { document != savedDocument }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                HStack {
                    TextField("기록 이름", text: $document.title)
                        .font(.headline).accessibilityLabel("기록 이름")
                    Text("mm").font(.caption.bold()).padding(7)
                        .background(.orange.opacity(0.15), in: Capsule())
                }.padding()
                if let image {
                    PhotoCanvas(image: image, annotations: document.annotations, pending: pending,
                                canMove: mode == .select, onTap: tapped, onMove: moved)
                } else {
                    ContentUnavailableView("사진을 열 수 없습니다", systemImage: "photo")
                }
                VStack(spacing: 12) {
                    Text(instruction).font(.caption).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Picker("편집 도구", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }.pickerStyle(.segmented)
                    HStack {
                        Button {
                            if pending != nil { pending = nil }
                            else if let previous = history.popLast() { document = previous }
                        } label: { Label("되돌리기", systemImage: "arrow.uturn.backward") }
                        .disabled(history.isEmpty && pending == nil)
                        Spacer()
                        Button(action: export) { Label("이미지 공유", systemImage: "square.and.arrow.up") }
                            .disabled(image == nil)
                    }.font(.subheadline)
                }.padding().background(.regularMaterial)
            }
            .navigationTitle("치수 기록")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("닫기") { if dirty { confirmClose = true } else { dismiss() } }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(savedNotice ? "저장됨" : "저장") { _ = save() }
                        .fontWeight(.semibold).disabled(image == nil)
                }
            }
            .onAppear {
                if savedDocument == nil { savedDocument = document }
                if image == nil { image = store.image(document.id) }
            }
            .onChange(of: mode) { _, _ in pending = nil }
            .onChange(of: document) { _, _ in savedNotice = false }
            .sheet(item: $editing) { annotation in
                AnnotationForm(annotation: annotation,
                               isExisting: document.annotations.contains { $0.id == annotation.id },
                               onSave: { updated in
                    remember()
                    if let index = document.annotations.firstIndex(where: { $0.id == updated.id }) {
                        document.annotations[index] = updated
                    } else { document.annotations.append(updated) }
                    lastInk = updated.ink.rawValue
                    lastFontSize = updated.fontSize
                }, onDelete: {
                    remember()
                    document.annotations.removeAll { $0.id == annotation.id }
                })
            }
            .sheet(item: $share) { item in ShareSheet(image: item.image) }
            .confirmationDialog("변경 내용을 저장할까요?", isPresented: $confirmClose, titleVisibility: .visible) {
                Button("저장 후 닫기") { if save() { dismiss() } }
                Button("변경 내용 버리기", role: .destructive) { dismiss() }
                Button("계속 편집", role: .cancel) { }
            }
            .alert("저장·공유 오류", isPresented: Binding(get: { error != nil }, set: { if !$0 { error = nil } })) {
                Button("확인") { error = nil }
            } message: { Text(error ?? "") }
        }.tint(.orange)
    }

    private var instruction: String {
        switch mode {
        case .dimension: return pending == nil ? "치수선의 시작점을 누르세요. 두 손가락으로 확대·이동" : "끝점을 누르면 mm 값을 입력할 수 있어요."
        case .memo: return "메모를 붙일 위치를 누르세요."
        case .select: return "글자를 눌러 수정 · 끝점이나 메모를 끌어 위치 변경"
        }
    }

    private func tapped(_ point: PhotoPoint, _ hit: UUID?) {
        switch mode {
        case .select:
            if let hit { editing = document.annotations.first { $0.id == hit } }
        case .memo:
            editing = Annotation(kind: .memo, start: point, end: point,
                                 ink: Ink(rawValue: lastInk) ?? .yellow, fontSize: lastFontSize)
        case .dimension:
            if let start = pending {
                guard let image, hypot((start.x - point.x) * image.size.width,
                                       (start.y - point.y) * image.size.height) > image.size.width * 0.015 else { return }
                pending = nil
                editing = Annotation(kind: .dimension, start: start, end: point,
                                     ink: Ink(rawValue: lastInk) ?? .yellow, fontSize: lastFontSize)
            } else { pending = point }
        }
    }

    private func moved(_ id: UUID, _ point: PhotoPoint, _ isEnd: Bool) {
        guard let index = document.annotations.firstIndex(where: { $0.id == id }) else { return }
        remember()
        if isEnd { document.annotations[index].end = point }
        else { document.annotations[index].start = point }
    }

    private func remember() {
        history.append(document)
        if history.count > 50 { history.removeFirst() }
    }

    private func save() -> Bool {
        do {
            let title = document.title.trimmingCharacters(in: .whitespacesAndNewlines)
            document.title = title.isEmpty ? "새 치수 기록" : title
            try store.save(document)
            savedDocument = document
            savedNotice = true
            return true
        } catch { self.error = error.localizedDescription; return false }
    }

    private func export() {
        guard let image, save() else { return }
        share = ExportedImage(image: PhotoDrawing.export(image: image, annotations: document.annotations))
    }
}

struct AnnotationForm: View {
    @Environment(\.dismiss) private var dismiss
    @State var annotation: Annotation
    var isExisting: Bool
    var onSave: (Annotation) -> Void
    var onDelete: () -> Void
    @FocusState private var focused: Bool

    private var validText: String? {
        if annotation.kind == .dimension { return Annotation.validMillimeters(annotation.text) }
        let text = annotation.text.trimmingCharacters(in: .whitespacesAndNewlines)
        return !text.isEmpty && text.count <= 200 ? text : nil
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(annotation.kind == .dimension ? "줄자로 잰 값" : "텍스트 메모") {
                    if annotation.kind == .dimension {
                        HStack {
                            TextField("예: 1250", text: $annotation.text).keyboardType(.decimalPad)
                                .focused($focused).accessibilityLabel("측정값")
                            Text("mm").foregroundStyle(.secondary)
                        }
                        Text("0보다 큰 숫자 · 소수점 둘째 자리까지 입력")
                            .font(.caption).foregroundStyle(.secondary)
                    } else {
                        TextField("예: 창틀 안쪽 기준", text: $annotation.text, axis: .vertical)
                            .lineLimit(3...6).focused($focused)
                        Text("\(annotation.text.count)/200자").font(.caption).foregroundStyle(.secondary)
                    }
                }
                Section("표시 스타일") {
                    Picker("선·글자 색상", selection: $annotation.ink) {
                        ForEach(Ink.allCases) { Text($0.title).tag($0) }
                    }
                    HStack {
                        Text("글자 크기")
                        Slider(value: $annotation.fontSize, in: 12...32, step: 1)
                            .accessibilityLabel("글자 크기")
                        Text("\(Int(annotation.fontSize))").monospacedDigit()
                    }
                    Text(annotation.text.isEmpty ? "1,250 mm" : annotation.label)
                        .font(.system(size: annotation.fontSize, weight: .bold))
                        .foregroundStyle(Color(uiColor: annotation.ink.uiColor))
                        .padding(12).frame(maxWidth: .infinity)
                        .background(annotation.ink == .black ? Color.white : Color.black, in: RoundedRectangle(cornerRadius: 10))
                        .accessibilityLabel("스타일 미리보기")
                }
                if isExisting {
                    Section { Button("이 표시 삭제", role: .destructive) { onDelete(); dismiss() } }
                }
            }
            .navigationTitle(annotation.kind == .dimension ? "치수 입력" : "메모 입력")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("취소") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("적용") {
                        guard let validText else { return }
                        annotation.text = validText
                        onSave(annotation)
                        dismiss()
                    }.disabled(validText == nil)
                }
            }
            .onAppear { focused = !isExisting }
        }.tint(.orange)
    }
}

struct ExportedImage: Identifiable {
    let id = UUID()
    let image: UIImage
}

struct ShareSheet: UIViewControllerRepresentable {
    let image: UIImage
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [image], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) { }
}
