import Foundation
import Observation
import CoreLocation

// Runs the context engine at launch, when the app comes back to the
// foreground, at the next mood band, the late cutoff or midnight, and when
// the plan or settings change (views call `refresh`). Never on a tight timer.

@MainActor
@Observable
final class ContextProvider {
    private(set) var context: AppContext
    /// The device's dark mode, fed in by the root view for the 'system' mood.
    var prefersDark = false { didSet { if oldValue != prefersDark { refresh() } } }
    private var store: Store?
    private var changeTimer: Timer?
    private let weather = WeatherService()

    init() {
        context = ContextEngine.build(.init(now: Date(), settings: Settings(), weather: nil, plan: [], recipes: []))
    }

    func attach(_ store: Store) {
        self.store = store
        refresh()
        scheduleNextChange()
        Task { await refreshWeather() }
    }

    func refresh() {
        guard let store else { return }
        let s = store.settings
        let plan = store.fetch(PlanEntryModel.self).map(\.value)
        let recipes = store.fetch(RecipeModel.self).map(\.value)
        let today = DateKey.key(Date())
        context = ContextEngine.build(.init(now: Date(), settings: s.value, weather: s.weatherEnabled ? s.weather : nil, plan: plan, recipes: recipes,
                                            stillTonight: s.stillTonightDate == today, prefersDark: prefersDark))
    }

    func becameActive() {
        refresh()
        scheduleNextChange()
        Task { await refreshWeather() }
    }

    var today: String { DateKey.key(context.now) }

    /// "Still eating tonight": keep Tonight on today until midnight.
    func stayTonight() {
        store?.setStillTonight(today)
        refresh()
    }

    /// Fires once at the next moment the context can change so the palette and copy follow the clock.
    private func scheduleNextChange() {
        changeTimer?.invalidate()
        let fire = ContextEngine.nextChange(after: Date())
        let t = Timer(fire: fire, interval: 0, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.refresh()
                self?.scheduleNextChange()
            }
        }
        changeTimer = t
        RunLoop.main.add(t, forMode: .common)
    }

    func refreshWeather() async {
        guard let store, store.settings.weatherEnabled else { return }
        if let cached = store.settings.weather, let at = ISO.date(cached.fetchedAt), Date().timeIntervalSince(at) < 1800 { return }
        switch await weather.fetch() {
        case .success(let w):
            store.setWeather(w)
            refresh()
        case .denied:
            // Location was refused, so the switch goes off rather than quietly doing nothing.
            store.update { $0.weatherEnabled = false; $0.weather = nil }
            refresh()
        case .failed:
            break
        }
    }
}

/// One-shot location plus Open-Meteo (free, no key). Coordinates are rounded to
/// one decimal place (about 10 km) before they leave the phone.
final class WeatherService: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    enum Result { case success(Weather), denied, failed }

    private let manager = CLLocationManager()
    /// Every caller waiting on the one in-flight location request. A second fetch joins the first.
    private var waiters: [CheckedContinuation<CLLocation?, Never>] = []
    private var denied = false

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func fetch() async -> Result {
        denied = false
        guard let loc = await location() else { return denied ? .denied : .failed }
        let r = { (n: Double) in (n * 10).rounded() / 10 }
        let url = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(r(loc.coordinate.latitude))&longitude=\(r(loc.coordinate.longitude))&current=temperature_2m,precipitation")!
        struct Reply: Decodable { struct Current: Decodable { var temperature_2m: Double?; var precipitation: Double? }; var current: Current? }
        guard let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let reply = try? JSONDecoder().decode(Reply.self, from: data),
              let temp = reply.current?.temperature_2m else { return .failed }
        return .success(Weather(tempC: temp, precipitation: (reply.current?.precipitation ?? 0) > 0, fetchedAt: ISO.now()))
    }

    private func location() async -> CLLocation? {
        await withCheckedContinuation { cont in
            waiters.append(cont)
            guard waiters.count == 1 else { return }
            switch manager.authorizationStatus {
            case .notDetermined: manager.requestWhenInUseAuthorization()
            case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
            default: denied = true; finish(nil)
            }
        }
    }

    private func finish(_ loc: CLLocation?) {
        let pending = waiters
        waiters = []
        pending.forEach { $0.resume(returning: loc) }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard !waiters.isEmpty else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
        case .notDetermined: break
        default: denied = true; finish(nil)
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) { finish(locations.first) }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { finish(nil) }
}
