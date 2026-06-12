// ============================================================
// TypeQuest iOS — a thin WKWebView shell around the web game.
// The whole game (index.html, css/, js/, img/) is copied into the
// app bundle's www/ folder by a build phase, so the app works
// fully offline and saves live in the WebView's localStorage.
// ============================================================

import SwiftUI
import WebKit

@main
struct TypeQuestApp: App {
    var body: some Scene {
        WindowGroup {
            GameWebView()
                .ignoresSafeArea()
                .background(Color(red: 0.043, green: 0.055, blue: 0.114)) // --bg0
        }
    }
}

struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.043, green: 0.055, blue: 0.114, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        // long pages (Pokedex, Stats) still scroll; the rubber-band
        // bounce just never fights the map's drag gesture
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) {
            // inspect from Safari ▸ Develop while debugging
            webView.isInspectable = true
        }

        if let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            webView.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    // The game's "Download backup" button creates a blob: link with a
    // download attribute. WKWebView ignores those unless we accept the
    // download ourselves — backups land in the app's Documents folder,
    // which UIFileSharingEnabled exposes in Files ▸ On My iPad ▸ TypeQuest.
    final class Coordinator: NSObject, WKNavigationDelegate, WKDownloadDelegate {
        func webView(_ webView: WKWebView,
                     decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(navigationAction.shouldPerformDownload ? .download : .allow)
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        func download(_ download: WKDownload,
                      decideDestinationUsing response: URLResponse,
                      suggestedFilename: String,
                      completionHandler: @escaping (URL?) -> Void) {
            let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let dest = docs.appendingPathComponent(suggestedFilename)
            try? FileManager.default.removeItem(at: dest)
            completionHandler(dest)
        }
    }
}
