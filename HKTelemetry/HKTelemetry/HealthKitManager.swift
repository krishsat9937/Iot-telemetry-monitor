//
//  HealthKitManager.swift
//  HKTelemetry
//
//  Created by Krishna on 26/09/25.
//

import Foundation
import HealthKit

enum HKPermissions {
    static let store = HKHealthStore()

    static var readTypes: Set<HKObjectType> {
        var s = Set<HKObjectType>()
        if let hr = HKObjectType.quantityType(forIdentifier: .heartRate) {
            s.insert(hr)
        }
        return s
    }

    static func request(_ completion: @escaping (Bool, Error?) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false, nil) // e.g., iPad or Health not available
            return
        }
        store.requestAuthorization(toShare: nil, read: readTypes, completion: completion)
    }

    static func heartRateStatus() -> HKAuthorizationStatus {
        guard let hr = HKObjectType.quantityType(forIdentifier: .heartRate) else { return .notDetermined }
        return store.authorizationStatus(for: hr)
    }
}
