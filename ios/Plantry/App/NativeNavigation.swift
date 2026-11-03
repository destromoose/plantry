#if canImport(UIKit)
import UIKit

/// SwiftUI turns the left-edge swipe back off on any screen that hides the system
/// back button (recipe detail draws its own round one) or the navigation bar.
/// Handing the gesture a delegate of our own turns it back on, so every pushed
/// screen follows your finger back to the one before, like any iPhone app.
extension UINavigationController: @retroactive UIGestureRecognizerDelegate {
    override open func viewDidLoad() {
        super.viewDidLoad()
        interactivePopGestureRecognizer?.delegate = self
    }

    public func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard gestureRecognizer === interactivePopGestureRecognizer else { return true }
        // Only with somewhere to go back to, and never halfway through another push or pop.
        return viewControllers.count > 1 && transitionCoordinator == nil
    }
}
#endif
