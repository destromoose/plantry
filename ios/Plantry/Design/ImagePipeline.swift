import SwiftUI
import ImageIO

/// Loads remote recipe photos so they are ready before a card scrolls into view.
///
/// Each photo is downloaded once (URLCache keeps the bytes on disk), shrunk to
/// the size it is shown at and decoded off the main thread, then kept in memory.
/// Drawing a cached photo costs nothing, so a card that scrolls back in shows
/// its picture on the first frame instead of a blank tile.
final class ImagePipeline: @unchecked Sendable {
    static let shared = ImagePipeline()

    /// The longest edge, in pixels, an image is decoded at.
    enum Size: Int, Sendable {
        /// Recipe grid tiles and thumbnails. About 210 points at 3x.
        case tile = 640
        /// Heroes and the recipe page, full phone width at 3x.
        case full = 1400

        /// The smallest size that stays sharp at this many points on a 3x screen.
        static func fitting(points: CGFloat) -> Size { points * 3 <= CGFloat(Size.tile.rawValue) ? .tile : .full }
    }

    static let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.urlCache = URLCache(memoryCapacity: 16 << 20, diskCapacity: 200 << 20)
        c.requestCachePolicy = .returnCacheDataElseLoad
        c.httpMaximumConnectionsPerHost = 6
        c.timeoutIntervalForRequest = 20
        return URLSession(configuration: c)
    }()

    private final class Box { let image: Image; init(_ i: Image) { image = i } }

    private let memory: NSCache<NSString, Box> = {
        let c = NSCache<NSString, Box>()
        c.totalCostLimit = 120 << 20 // decoded bytes; NSCache also empties itself under memory pressure
        return c
    }()
    private let lock = NSLock()
    private var inflight: [String: Task<Image?, Never>] = [:]

    private static func key(_ url: URL, _ size: Size) -> String { "\(size.rawValue)|\(url.absoluteString)" }

    /// The decoded image if it is already in memory. Safe to call while building a view.
    func cached(_ url: URL, _ size: Size) -> Image? {
        memory.object(forKey: Self.key(url, size) as NSString)?.image
    }

    /// The best image in memory for this size: the exact one, or a stand-in at the other size.
    func bestCached(_ url: URL, _ size: Size) -> (image: Image, exact: Bool)? {
        if let hit = cached(url, size) { return (hit, true) }
        let other: Size = size == .tile ? .full : .tile
        if let stand = cached(url, other) { return (stand, other == .full) }
        return nil
    }

    /// Downloads, downsamples and decodes one image. Callers asking for the same
    /// image at once share one download. Returns nil when it cannot be loaded.
    func load(_ url: URL, _ size: Size) async -> Image? {
        if let hit = cached(url, size) { return hit }
        if size == .tile, let full = cached(url, .full) { return full }
        let key = Self.key(url, size)
        let task: Task<Image?, Never> = lock.withLock {
            if let running = inflight[key] { return running }
            // Not tied to the caller: a card that scrolls away keeps its download,
            // so the picture is ready if it scrolls back.
            let t = Task.detached(priority: .userInitiated) { [weak self] () -> Image? in
                defer { self?.finish(key) }
                guard let cg = await Self.fetch(url, maxPixel: size.rawValue) else { return nil }
                let image = Image(decorative: cg, scale: 1)
                self?.memory.setObject(Box(image), forKey: key as NSString, cost: cg.bytesPerRow * cg.height)
                return image
            }
            inflight[key] = t
            return t
        }
        return await task.value
    }

    /// Starts loading images that are about to be needed. Already cached or loading ones are skipped.
    func prefetch(_ urls: [String?], _ size: Size) {
        for case let raw? in urls {
            guard let url = URL(string: raw), url.scheme?.hasPrefix("http") == true else { continue }
            if cached(url, size) != nil { continue }
            if lock.withLock({ inflight[Self.key(url, size)] != nil }) { continue }
            Task.detached(priority: .utility) { _ = await self.load(url, size) }
        }
    }

    private func finish(_ key: String) {
        lock.withLock { inflight[key] = nil }
    }

    private static func fetch(_ url: URL, maxPixel: Int) async -> CGImage? {
        var req = URLRequest(url: url)
        req.cachePolicy = .returnCacheDataElseLoad
        guard let (data, response) = try? await session.data(for: req) else { return nil }
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) { return nil }
        return downsample(data, maxPixel: maxPixel)
    }

    /// Shrinks and fully decodes the image now, so the main thread never decodes a full-size JPEG mid-scroll.
    static func downsample(_ data: Data, maxPixel: Int) -> CGImage? {
        guard let src = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { return nil }
        let opts: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        return CGImageSourceCreateThumbnailAtIndex(src, 0, opts as CFDictionary)
    }
}
