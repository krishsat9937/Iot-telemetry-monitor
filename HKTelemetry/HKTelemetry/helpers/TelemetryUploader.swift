//
//  TelemetryUploader.swift
//  HKTelemetry
//
//  Created by Krishna on 26/09/25.
//

import Foundation
import HealthKit
import Network
import UIKit

struct TelemetryPayload: Codable {
    let deviceId: String
    let metric: String
    let value: Double
    let unit: String
    let timestamp: String
}

final class TelemetryUploader {
    static let shared = TelemetryUploader()

    // CHANGE to your backend (use your Mac LAN IP during dev)
    private let endpoint = URL(string: "https://iot-telemetry-monitor.onrender.com/api/telemetry")!
    private let apiKey = "dev-demo-key" // replace or inject securely

    private let session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = 10
        cfg.timeoutIntervalForResource = 20
        cfg.waitsForConnectivity = true
        return URLSession(configuration: cfg)
    }()

    private let iso: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    private let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? "ios-unknown"

    // offline queue persisted as JSONL under Library/Caches
    private let queueURL: URL = {
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return dir.appendingPathComponent("telemetry-queue.jsonl")
    }()
    private let monitor = NWPathMonitor()
    private var isOnline = true
    private let io = DispatchQueue(label: "telemetry.uploader.io")

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            self?.isOnline = (path.status == .satisfied)
            if path.status == .satisfied { self?.drainQueue() }
        }
        monitor.start(queue: DispatchQueue(label: "telemetry.net"))
    }

    func upload(samples: [HKQuantitySample]) {
        for s in samples {
            guard let metric = metricName(for: s.quantityType) else { continue }
            let (value, unit) = valueAndUnit(for: s)
            let payload = TelemetryPayload(
                deviceId: deviceId,
                metric: metric,
                value: value,
                unit: unit,
                timestamp: iso.string(from: s.endDate)
            )
            sendOrEnqueue(payload)
        }
    }

    // MARK: - internals

    private func metricName(for type: HKQuantityType) -> String? {
        if type == HKQuantityType.quantityType(forIdentifier: .heartRate) { return "heart_rate" }
        return nil
    }
    private func valueAndUnit(for s: HKQuantitySample) -> (Double, String) {
        if s.quantityType == HKQuantityType.quantityType(forIdentifier: .heartRate) {
            let unit = HKUnit.count().unitDivided(by: .minute())
            return (s.quantity.doubleValue(for: unit), "count/min")
        }
        return (0, "unknown")
    }

    private func sendOrEnqueue(_ payload: TelemetryPayload, attempt: Int = 0) {
        guard isOnline else { enqueue(payload); return }

        var req = URLRequest(url: endpoint)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        req.httpBody = try? JSONEncoder().encode(payload)

        session.dataTask(with: req) { [weak self] _, resp, err in
            guard let self = self else { return }
            if let err = err {
                // network error → backoff or enqueue
                if attempt < 3 {
                    let delay = pow(2.0, Double(attempt)) // 1s, 2s, 4s
                    DispatchQueue.global().asyncAfter(deadline: .now() + delay) {
                        self.sendOrEnqueue(payload, attempt: attempt + 1)
                    }
                } else {
                    self.enqueue(payload)
                }
                print("POST error:", err.localizedDescription)
                return
            }
            let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            if !(200...299).contains(status) {
                // 4xx might be auth/config → keep one copy for inspection
                print("POST non-2xx: \(status). Enqueue fallback.")
                self.enqueue(payload)
            }
        }.resume()
    }

    private func enqueue(_ payload: TelemetryPayload) {
        io.async {
            do {
                let line = try String(data: JSONEncoder().encode(payload), encoding: .utf8)! + "\n"
                if FileManager.default.fileExists(atPath: self.queueURL.path) {
                    let handle = try FileHandle(forWritingTo: self.queueURL)
                    handle.seekToEndOfFile()
                    handle.write(Data(line.utf8))
                    try handle.close()
                } else {
                    try line.write(to: self.queueURL, atomically: true, encoding: .utf8)
                }
            } catch {
                print("Enqueue failed:", error.localizedDescription)
            }
        }
    }

    private func drainQueue() {
        io.async {
            guard let data = try? Data(contentsOf: self.queueURL),
                  let text = String(data: data, encoding: .utf8),
                  !text.isEmpty else { return }

            // Try sending all lines; truncate file only if all succeed
            let lines = text.split(separator: "\n").map(String.init)
            var remaining = [String]()
            let group = DispatchGroup()

            for line in lines {
                guard let d = line.data(using: .utf8),
                      let payload = try? JSONDecoder().decode(TelemetryPayload.self, from: d) else {
                    continue
                }
                group.enter()
                self.sendOrEnqueue(payload, attempt: 0) // will re-enqueue on failure
                group.leave()
            }

            group.wait()
            // best-effort cleanup (file may still be repopulated by failures)
            try? FileManager.default.removeItem(at: self.queueURL)
        }
    }
}
