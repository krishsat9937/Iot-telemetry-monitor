import SwiftUI
import HealthKit

@main
struct HKTelemetryApp: App {
    @State private var authText = "HealthKit: Not requested"
    @State private var streamText = "Stream: idle"

    var body: some Scene {
        WindowGroup {
            ContentView(
                authText: authText,
                streamText: streamText,
                onRequestTap: request,
                onStartStream: startStream,
                onStopStream: stopStream
            )
            .onAppear { request() }
        }
    }

    private func request() {
        HKPermissions.request { granted, error in
            DispatchQueue.main.async {
                if granted {
                    authText = "HealthKit: Granted ✅"
                } else {
                    authText = "HealthKit: Denied ❌ — \(error?.localizedDescription ?? "unknown")"
                }
            }
        }
    }

    private func startStream() {
        streamText = "Stream: starting…"
        HealthKitStreamer.shared.start { samples in
            guard let s = samples.last else { return }
            let bpm = s.quantity.doubleValue(for: .count().unitDivided(by: .minute()))
            let t = DateFormatter.localizedString(from: s.endDate, dateStyle: .none, timeStyle: .medium)
            DispatchQueue.main.async {
                streamText = String(format: "Streaming tick — %.0f bpm at %@", bpm, t)
            }
            // Optional: upload to backend
            // TelemetryUploader.shared.upload(samples: samples)
        }
    }

    private func stopStream() {
        HealthKitStreamer.shared.stop()
        streamText = "Stream: stopped"
    }
}
