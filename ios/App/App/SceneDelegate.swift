import UIKit
import Capacitor
import WebKit

/// The portal in a native web view, plus a pull-to-refresh and light status-bar
/// icons over the navy splash. Apple guideline 4.2: this is more than a bookmark.
class MyDiiwaanViewController: CAPBridgeViewController {
    private let refreshControl = UIRefreshControl()
    private var loadingObservation: NSKeyValueObservation?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Light icons on the navy/charcoal chrome, before the page's own
        // SystemBars call runs.
        statusBarStyle = .lightContent
        setNeedsStatusBarAppearanceUpdate()

        guard let webView else { return }
        refreshControl.tintColor = UIColor(red: 0.851, green: 0.741, blue: 0.455, alpha: 1)
        refreshControl.addTarget(self, action: #selector(reloadPortal), for: .valueChanged)
        webView.scrollView.bounces = true
        webView.scrollView.refreshControl = refreshControl
        loadingObservation = webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
            if !view.isLoading {
                self?.refreshControl.endRefreshing()
            }
        }
    }

    @objc private func reloadPortal() {
        webView?.reload()
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
