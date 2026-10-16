import { useEffect } from 'react';
import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSocketEvent } from '../lib/socket';
import { raiseLocalAlert } from '../lib/alerts';
import { navigationRef } from '../lib/navigation';

// The trip steps a patient should hear about even when they are not looking
// at the app - the assignment, the ambulance at the door, a request that
// failed, and the request for feedback once the trip is over.
const ALERTED = new Set(['ASSIGNED', 'ARRIVED', 'COMPLETED', 'FAILED', 'CANCELLED']);

/** `ambulancebooking://feedback/BK00000042` -> `BK00000042` */
const bookingFromUrl = (url) => /feedback\/(BK\d{8})/.exec(url || '')?.[1] || null;

/** Opens a trip's detail screen, where the patient pays and rates. */
function openFeedback(bookingId) {
  if (!bookingId) return;
  const go = (tries = 0) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('History', { screen: 'BookingDetail', params: { bookingId } });
    } else if (tries < 20) {
      setTimeout(() => go(tries + 1), 250);
    }
  };
  go();
}

/**
 * Raises a phone notification for the patient's important trip updates, and
 * opens the feedback screen from the email link or a tapped alert.
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

  useEffect(() => {
    const fromTap = (response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (data.type === 'COMPLETED' || data.type === 'FEEDBACK') openFeedback(data.booking_id);
    };

    // The email link, whether it started the app or arrived while it was open.
    Linking.getInitialURL().then((url) => openFeedback(bookingFromUrl(url))).catch(() => {});
    const linkSub = Linking.addEventListener('url', ({ url }) => openFeedback(bookingFromUrl(url)));

    // A tapped "trip completed" alert.
    Notifications.getLastNotificationResponseAsync().then(fromTap).catch(() => {});
    const tapSub = Notifications.addNotificationResponseReceivedListener(fromTap);

    return () => {
      linkSub.remove();
      tapSub.remove();
    };
  }, []);

  return null;
}
