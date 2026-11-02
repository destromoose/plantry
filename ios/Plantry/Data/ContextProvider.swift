import Foundation
import Observation
import CoreLocation

// Runs the context engine at launch, when the app comes back to the
// foreground, when the hour band changes, and when the plan or settings
// change (views call `refresh`). Never on a tight timer.

@MainActor
@Observable
final class ContextProvider {
    private(set) var context: AppContext
    private var store: Store?
    private var bandTimer: Timer?
    private let weather = WeatherService()

    init() {
        context = ContextEngine.build(.init(now: Date(), settings: Settings(), weather: nil, plan: [], recipes: []))
    }

    func attach(_ store: Store) {
        self.store = store
        refresh()
        scheduleBandChange()
        Task { await refreshWeather() }
    }

    func refresh() {
        guard let store else { return }
        let s = store.settings
        let plan = store.fetch(PlanEntryModel.self).map(\.value)
        let recipes = store.fetch(RecipeModel.self).map(\.value)
        context = ContextEngine.build(.init(now: Date(), settings: s.value, weather: s.weatherEnabled ? s.weather : nil, plan: plan, recipes: recipes))
    }

    func becameActive() {
        refresh()
        scheduleBandChange()
        Task { await refreshWeather() }
    }

    var today: String { DateKey.key(context.now) }

    /// Fires once at the next mood boundary (5, 10, 17, 21) so the palette and copy follow the clock.
    private func scheduleBandChange() {
        bandTimer?.invalidate()
        let cal = DateKey.calendar
        let now = Date()
        let hour = cal.component(.hour, from: now)
        let bounds = [5, 10, 17, 21]
        let nextHour = bounds.first { $0 > hour }
        var comps = cal.dateComponents([.year, .month, .day], from: now)
        if let nextHour { comps.hour = nextHour } else {
            comps = cal.dateComponents([.year, .month, .day], from: cal.date(byAdding: .day, value: 1, to: now) ?? now)
            comps.hour = 0
        }
        comps.minute = 0; comps.second = 1
        guard let fire = cal.date(from: comps) else { return }
        let t = Timer(fire: fire, interval: 0, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.refresh()
                self?.scheduleBandChange()
            }
        }
        bandTimer = t
        RunLoop.main.add(t, forMode: .common)
    }

    func refreshWeather() async {
        guard let store, store.settings.weatherEnabled else { return }
        if let cached = store.settings.weather, let at = ISO.date(cached.fetchedAt), Date().timeIntervalSince(at) < 1800 { return }
        if let w = await weather.fetch() {
            store.setWeather(w)
            refresh()
        }
    }
}

/// One-shot location plus Open-Meteo (free, no key). Returns nil on any failure.
final class WeatherService: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocation?, Never>?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func fetch() async -> Weather? {
        guard let loc = await location() else { return nil }
        let url = URL(string: "https://api.open-meteo.com/v1/forecast?latitude=\(loc.coordinate.latitude)&longitude=\(loc.coordinate.longitude)&current=temperature_2m,precipitation")!
        struct Reply: Decodable { struct Current: Decodable { var temperature_2m: Double?; var precipitation: Double? }; var current: Current? }
        guard let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200,
              let reply = try? JSONDecoder().decode(Reply.self, from: data),
              let temp = reply.current?.temperature_2m else { return nil }
        return Weather(tempC: temp, precipitation: (reply.current?.precipitation ?? 0) > 0, fetchedAt: ISO.now())
    }

    private func location() async -> CLLocation? {
        await withCheckedContinuation { cont in
            continuation = cont
            switch manager.authorizationStatus {
            case .notDetermined: manager.requestWhenInUseAuthorization()
            case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
            default: finish(nil)
            }
        }
    }

    private func finish(_ loc: CLLocation?) {
        continuation?.resume(returning: loc)
        continuation = nil
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard continuation != nil else { return }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: manager.requestLocation()
        case .notDetermined: break
        default: finish(nil)
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) { finish(locations.first) }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { finish(nil) }
}
