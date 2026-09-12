// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "MelodyNativeAudio",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "MelodyNativeAudio",
            targets: ["MelodyNativeAudio"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "MelodyNativeAudio",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/MelodyNativeAudio"
        ),
        .testTarget(
            name: "NativeAudioPluginTests",
            dependencies: ["MelodyNativeAudio"],
            path: "ios/Tests/NativeAudioPluginTests"
        )
    ]
)
