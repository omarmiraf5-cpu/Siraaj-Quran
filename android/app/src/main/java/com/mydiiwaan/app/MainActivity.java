package com.mydiiwaan.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * Native shell around the live portal.
 *
 * Adds two things a browser tab does not: pull-to-refresh, and a back button
 * that walks the portal's history (and leaves the app on the first screen).
 * Staff location, the splash, and the offline page are configured elsewhere.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        styleSystemBars();
        installPullToRefresh(getBridge().getWebView());
        installBackNavigation();
    }

    /** Light status-bar icons on the navy chrome, including before the page loads. */
    private void styleSystemBars() {
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.parseColor("#0E2347"));
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(
            getWindow(),
            getWindow().getDecorView()
        );
        controller.setAppearanceLightStatusBars(false);
        controller.setAppearanceLightNavigationBars(false);
    }

    private void installPullToRefresh(WebView webView) {
        ViewParent rawParent = webView.getParent();
        if (!(rawParent instanceof ViewGroup)) {
            return;
        }
        ViewGroup parent = (ViewGroup) rawParent;
        int index = parent.indexOfChild(webView);
        ViewGroup.LayoutParams params = webView.getLayoutParams();
        parent.removeView(webView);

        SwipeRefreshLayout refresh = new SwipeRefreshLayout(this);
        refresh.setColorSchemeColors(Color.parseColor("#D9BD74"));
        refresh.setProgressBackgroundColorSchemeColor(Color.parseColor("#0E2347"));
        refresh.addView(
            webView,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        parent.addView(refresh, index, params);
        refresh.setOnRefreshListener(webView::reload);
        getBridge().addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageLoaded(WebView view) {
                    refresh.setRefreshing(false);
                }

                @Override
                public void onReceivedError(WebView view) {
                    refresh.setRefreshing(false);
                }
            }
        );
    }

    /**
     * Capacitor goes back inside the page when it can, and otherwise swallows
     * the press, so the app feels stuck on the first screen. This callback is
     * registered later, so it runs first: history when there is some, and
     * otherwise the app moves to the background with the session kept.
     */
    private void installBackNavigation() {
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = getBridge().getWebView();
                    if (webView != null && webView.canGoBack()) {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                        setEnabled(true);
                    } else {
                        moveTaskToBack(true);
                    }
                }
            }
        );
    }
}
