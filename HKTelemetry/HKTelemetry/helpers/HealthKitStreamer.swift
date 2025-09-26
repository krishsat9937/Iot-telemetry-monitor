import Foundation
import HealthKit

final class HealthKitStreamer {
    static let shared = HealthKitStreamer()

    private let store = HKHealthStore()
    private let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
    private var anchor: HKQueryAnchor?
    private var anchoredQuery: HKAnchoredObjectQuery?
    private var observerQuery: HKObserverQuery?
    private var pollTimer: Timer?
    private var lastEndDate: Date = .distantPast

    /// Start passive streaming (works best if Watch is in an active workout).
    func start(onSamples: @escaping ([HKQuantitySample]) -> Void) {
        stop() // idempotent restart

        // Anchored query with live update handler
        let aq = HKAnchoredObjectQuery(type: hrType, predicate: nil, anchor: anchor, limit: HKObjectQueryNoLimit) { [weak self] _, samples, _, newAnchor, error in
            guard let self = self else { return }
            if let error = error { print("Anchored initial error:", error); return }
            self.anchor = newAnchor
            let qty = samples as? [HKQuantitySample] ?? []
            self.bumpLast(qty); if !qty.isEmpty { onSamples(qty) }
        }
        aq.updateHandler = { [weak self] _, samples, _, newAnchor, error in
            guard let self = self else { return }
            if let error = error { print("Anchored update error:", error); return }
            self.anchor = newAnchor
            let qty = samples as? [HKQuantitySample] ?? []
            self.bumpLast(qty); if !qty.isEmpty { onSamples(qty) }
        }
        anchoredQuery = aq
        store.execute(aq)

        // Observer nudges HealthKit to deliver promptly
        let oq = HKObserverQuery(sampleType: hrType, predicate: nil) { [weak self] _, _, error in
            if let error = error { print("Observer error:", error); return }
            self?.fetchDelta(onSamples: onSamples)
        }
        observerQuery = oq
        store.execute(oq)

        // Background delivery (helps even when foregrounded during workouts)
        store.enableBackgroundDelivery(for: hrType, frequency: .immediate) { ok, err in
            if !ok { print("BG delivery failed:", String(describing: err)) }
        }

        // Tiny safety poll to surface ticks even if HK batches
        pollTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            self?.fetchDelta(onSamples: onSamples)
        }
        if let t = pollTimer { RunLoop.main.add(t, forMode: .common) }
    }

    func stop() {
        if let q = anchoredQuery { store.stop(q) }
        if let q = observerQuery { store.stop(q) }
        anchoredQuery = nil
        observerQuery  = nil
        pollTimer?.invalidate()
        pollTimer = nil
    }

    private func bumpLast(_ samples: [HKQuantitySample]) {
        if let m = samples.map(\.endDate).max(), m > lastEndDate { lastEndDate = m }
    }

    private func fetchDelta(onSamples: @escaping ([HKQuantitySample]) -> Void) {
        let pred = NSPredicate(format: "%K > %@", HKSampleSortIdentifierEndDate, lastEndDate as NSDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)
        let q = HKSampleQuery(sampleType: hrType, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { [weak self] _, samples, error in
            if let error = error { print("Delta query error:", error); return }
            let qty = samples as? [HKQuantitySample] ?? []
            if !qty.isEmpty { self?.bumpLast(qty); onSamples(qty) }
        }
        store.execute(q)
    }
}
