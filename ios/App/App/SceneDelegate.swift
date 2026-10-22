import UIKit
import Capacitor
import Network
import WebKit

/// The portal in a native web view. Apple guideline 4.2: this shell is more
/// than a bookmark. It adds pull-to-refresh, a navy offline screen, swipe
/// back, and light status-bar icons. External links leave the app for Safari
/// (Capacitor does that when the host is outside allowNavigation).
class MyDiiwaanViewController: CAPBridgeViewController {
    private let refreshControl = UIRefreshControl()
    private let refreshHaptic = UIImpactFeedbackGenerator(style: .light)
    private var loadingObservation: NSKeyValueObservation?
    private let offlineOverlay = OfflineOverlay()
    private let networkMonitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "com.mydiiwaan.app.network")
    private var showingOffline = false

    private let navy = UIColor(red: 14.0 / 255.0, green: 35.0 / 255.0, blue: 71.0 / 255.0, alpha: 1)

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Light icons on the navy chrome, before the page's own SystemBars call runs.
        statusBarStyle = .lightContent
        setNeedsStatusBarAppearanceUpdate()
        view.backgroundColor = navy

        guard let webView else { return }
        webView.backgroundColor = navy
        webView.scrollView.backgroundColor = navy
        webView.allowsBackForwardNavigationGestures = true

        refreshControl.tintColor = UIColor(red: 0.851, green: 0.741, blue: 0.455, alpha: 1)
        refreshControl.addTarget(self, action: #selector(reloadPortal), for: .valueChanged)
        refreshHaptic.prepare()
        webView.scrollView.bounces = true
        webView.scrollView.refreshControl = refreshControl
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
            if !view.isLoading {
                self?.refreshControl.endRefreshing()
            }
        }

        offlineOverlay.translatesAutoresizingMaskIntoConstraints = false
        offlineOverlay.isHidden = true
        offlineOverlay.onRetry = { [weak self] in
            self?.reloadPortal()
        }
        view.addSubview(offlineOverlay)
        NSLayoutConstraint.activate([
            offlineOverlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            offlineOverlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            offlineOverlay.topAnchor.constraint(equalTo: view.topAnchor),
            offlineOverlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        networkMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.setOffline(path.status != .satisfied)
            }
        }
        networkMonitor.start(queue: networkQueue)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if showingOffline {
            view.bringSubviewToFront(offlineOverlay)
        }
    }

    deinit {
        networkMonitor.cancel()
    }

    /// A full-screen native "no connection" view. The local offline.html page
    /// still covers the case where the phone has a network but the site does not answer.
    private func setOffline(_ offline: Bool) {
        let wasOffline = showingOffline
        showingOffline = offline
        offlineOverlay.isHidden = !offline
        if offline {
            view.bringSubviewToFront(offlineOverlay)
        } else if wasOffline {
            webView?.reload()
        }
    }

    @objc private func reloadPortal() {
        refreshHaptic.impactOccurred()
        webView?.reload()
    }
}

/// Navy full-screen notice shown when the phone has no connection.
private final class OfflineOverlay: UIView {
    var onRetry: (() -> Void)?

    private let navy = UIColor(red: 14.0 / 255.0, green: 35.0 / 255.0, blue: 71.0 / 255.0, alpha: 1)
    private let gold = UIColor(red: 217.0 / 255.0, green: 189.0 / 255.0, blue: 116.0 / 255.0, alpha: 1)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = navy

        let title = UILabel()
        title.attributedText = NSAttributedString(string: "MyDiiwaan", attributes: [
            .font: UIFont(name: "Georgia-Bold", size: 28) ?? UIFont.boldSystemFont(ofSize: 28),
            .foregroundColor: UIColor.white,
        ])
        title.textAlignment = .center

        let english = UILabel()
        english.text = "You're offline. Check your internet connection, then try again."
        english.textColor = UIColor.white.withAlphaComponent(0.82)
        english.font = .systemFont(ofSize: 16)
        english.numberOfLines = 0
        english.textAlignment = .center

        let somali = UILabel()
        somali.text = "Internetka ma lihid. Hubi xiriirkaaga, kadibna mar kale isku day."
        somali.textColor = UIColor.white.withAlphaComponent(0.82)
        somali.font = .systemFont(ofSize: 16)
        somali.numberOfLines = 0
        somali.textAlignment = .center

        let arabic = UILabel()
        arabic.text = "أنت غير متصل بالإنترنت. تحقق من اتصالك ثم حاول مرة أخرى."
        arabic.textColor = UIColor.white.withAlphaComponent(0.82)
        arabic.font = .systemFont(ofSize: 16)
        arabic.numberOfLines = 0
        arabic.textAlignment = .center

        var buttonConfig = UIButton.Configuration.filled()
        buttonConfig.title = "Try again"
        buttonConfig.baseBackgroundColor = gold
        buttonConfig.baseForegroundColor = navy
        buttonConfig.cornerStyle = .medium
        buttonConfig.contentInsets = NSDirectionalEdgeInsets(top: 14, leading: 28, bottom: 14, trailing: 28)
        buttonConfig.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { incoming in
            var outgoing = incoming
            outgoing.font = .boldSystemFont(ofSize: 16)
            return outgoing
        }
        let button = UIButton(configuration: buttonConfig)
        button.addTarget(self, action: #selector(retry), for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [title, english, somali, arabic, button])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.setCustomSpacing(22, after: arabic)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: safeAreaLayoutGuide.trailingAnchor, constant: -24),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("OfflineOverlay is built in code")
    }

    @objc private func retry() {
        onRetry?()
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MyDiiwaanViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
