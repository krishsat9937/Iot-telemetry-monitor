//
//  ContentView.swift
//  HKTelemetry
//
//  Created by Krishna on 25/09/25.
//

import SwiftUI
import HealthKit

struct ContentView: View {
    var authText: String
    var streamText: String
    var onRequestTap: () -> Void
    var onStartStream: () -> Void
    var onStopStream: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("HealthKit Telemetry").font(.title).bold()

            Text(authText).multilineTextAlignment(.center)

            HStack {
                Button("Request Health Access", action: onRequestTap)
                    .buttonStyle(.borderedProminent)
                Button("Start Stream", action: onStartStream)
                Button("Stop Stream", action: onStopStream)
            }

            Text(streamText)
                .font(.headline)
                .padding(.top, 8)

            Text("Heart Rate write-status (not relevant for read): \(statusText(HKPermissions.heartRateStatus()))")
                .font(.footnote)
                .foregroundStyle(.secondary)

            Spacer()
        }
        .padding()
    }

    private func statusText(_ s: HKAuthorizationStatus) -> String {
        switch s {
        case .sharingAuthorized: return "authorized"
        case .sharingDenied: return "denied"
        case .notDetermined: return "not determined"
        @unknown default: return "unknown"
        }
    }
}
