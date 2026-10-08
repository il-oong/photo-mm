import SwiftUI
import PhotosUI

@main
struct PhotoMMApp: App {
    @StateObject private var store = DocumentStore()
    var body: some Scene {
        WindowGroup { LibraryView().environmentObject(store) }
    }
}

struct LibraryView: View {
    @EnvironmentObject private var store: DocumentStore
    @State private var photo: PhotosPickerItem?
    @State private var opened: PhotoDocument?
    @State private var isLoading = false

    var body: some View {
        NavigationStack {
            Group {
                if store.documents.isEmpty {
                    ContentUnavailableView {
                        Label("사진에 치수를 남겨보세요", systemImage: "ruler")
                    } description: {
                        Text("줄자로 잰 값을 mm로 기록하고\n사진 위에 메모를 더하세요.")
                    } actions: { picker }
                } else {
                    List(store.documents) { document in
                        Button { opened = document } label: {
                            HStack(spacing: 14) {
                                if let image = store.image(document.id, maxPixel: 180) {
                                    Image(uiImage: image).resizable().scaledToFill()
                                        .frame(width: 64, height: 64).clipped().cornerRadius(10)
                                }
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(document.title).font(.headline).foregroundStyle(.primary)
                                    Text("표시 \(document.annotations.count)개 · \(document.updatedAt.formatted(date: .abbreviated, time: .omitted))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }.padding(.vertical, 4)
                        }
                    }
                }
            }
            .navigationTitle("Photo MM")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { picker } }
            .overlay { if isLoading { ProgressView("사진 불러오는 중…").padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12)) } }
            .disabled(isLoading)
            .task(id: photo) {
                guard let selected = photo else { return }
                isLoading = true
                defer { isLoading = false; photo = nil }
                do {
                    guard let data = try await selected.loadTransferable(type: Data.self) else {
                        throw DocumentStore.StoreError.invalidImage
                    }
                    try Task.checkCancellation()
                    opened = try store.importPhoto(data)
                } catch is CancellationError { }
                catch { store.errorMessage = error.localizedDescription }
            }
            .fullScreenCover(item: $opened) { document in
                EditorView(document: document).environmentObject(store)
            }
            .alert("알림", isPresented: Binding(get: { store.errorMessage != nil }, set: { if !$0 { store.errorMessage = nil } })) {
                Button("확인") { store.errorMessage = nil }
            } message: { Text(store.errorMessage ?? "") }
        }.tint(.orange)
    }

    private var picker: some View {
        PhotosPicker(selection: $photo, matching: .images) {
            Label("사진 선택", systemImage: "photo.badge.plus")
        }.disabled(isLoading)
    }
}
