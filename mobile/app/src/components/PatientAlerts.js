import { useSocketEvent } from '../lib/socket';
import { raiseLocalAlert } from '../lib/alerts';

// The trip steps a patient should hear about even when they are not looking
// at the app - the assignment, the ambulance at the door, a request that
// failed, and the request for feedback once the trip is over.
const ALERTED = new Set(['ASSIGNED', 'ARRIVED', 'COMPLETED', 'FAILED', 'CANCELLED']);

/**
 * Raises a phone notification for the patient's important trip updates.
 *
 * Remote push needs Firebase credentials this build does not have, so - as
 * the driver console does for offers - the app raises the alert itself from
 * the server's `notification` event. It works while the app is open or in
 * the background with its connection alive; a closed app still relies on the
 * email the server sends.
 */
export default function PatientAlerts() {
  useSocketEvent('notification', (n) => {
    if (!ALERTED.has(n.event_type)) return;
    raiseLocalAlert({
      title: n.title,
      body: n.body || '',
      data: { type: n.event_type, booking_id: n.booking_id },
    });
  }, []);

  return null;
}
