//
//  HKHelper.swift
//  HKTelemetry
//
//  Created by Krishna on 26/09/25.
//

import HealthKit

func fetchLatestHeartRate(completion: @escaping (Double?, Date?) -> Void) {
    guard let hrType = HKObjectType.quantityType(forIdentifier: .heartRate) else {
        completion(nil, nil); return
    }
    let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
    let q = HKSampleQuery(sampleType: hrType, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
        guard error == nil,
              let s = samples?.first as? HKQuantitySample else {
            completion(nil, nil); return
        }
        let bpm = s.quantity.doubleValue(for: .count().unitDivided(by: .minute()))
        completion(bpm, s.endDate)
    }
    HKPermissions.store.execute(q)
}
