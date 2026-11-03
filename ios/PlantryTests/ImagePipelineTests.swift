import XCTest
import ImageIO
import UniformTypeIdentifiers
@testable import Plantry

// The recipe grid relies on photos being shrunk and decoded before they are drawn.

final class ImagePipelineTests: XCTestCase {
    /// A plain JPEG of the given pixel size.
    private func jpeg(width: Int, height: Int) throws -> Data {
        let ctx = try XCTUnwrap(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        ctx.setFillColor(CGColor(red: 0.8, green: 0.4, blue: 0.2, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
        let image = try XCTUnwrap(ctx.makeImage())
        let out = NSMutableData()
        let dest = try XCTUnwrap(CGImageDestinationCreateWithData(out, UTType.jpeg.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(dest))
        return out as Data
    }

    func testDownsampleShrinksLargePhotosToTheLongestEdge() throws {
        let data = try jpeg(width: 3000, height: 2000)
        let cg = try XCTUnwrap(ImagePipeline.downsample(data, maxPixel: ImagePipeline.Size.tile.rawValue))
        XCTAssertEqual(max(cg.width, cg.height), 640)
        XCTAssertEqual(cg.width, 640)
    }

    func testDownsampleNeverEnlargesSmallPhotos() throws {
        let data = try jpeg(width: 300, height: 200)
        let cg = try XCTUnwrap(ImagePipeline.downsample(data, maxPixel: ImagePipeline.Size.full.rawValue))
        XCTAssertLessThanOrEqual(cg.width, 300)
    }

    func testDownsampleRejectsDataThatIsNotAnImage() {
        XCTAssertNil(ImagePipeline.downsample(Data("not a photo".utf8), maxPixel: 640))
    }

    func testThumbnailsPickTheSmallestSharpSize() {
        XCTAssertEqual(ImagePipeline.Size.fitting(points: 44), .tile)
        XCTAssertEqual(ImagePipeline.Size.fitting(points: 200), .tile)
        XCTAssertEqual(ImagePipeline.Size.fitting(points: 320), .full)
    }
}
