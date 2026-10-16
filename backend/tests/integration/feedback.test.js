'use strict';
// F.12 / F.14 - when a trip completes, the patient is asked for feedback by
// in-app notification, push and email, so the request reaches them after
// they have put the phone away.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  startTestServer, stopTestServer,
  post, signIn,
  ACCOUNTS, NITK, goOnDuty, clearActiveBooking, bookAndAwaitOffer,
} = require('../helpers');

// Required lazily: src/db resolves DB_FILE at load time (see alerts.test.js).
const database = () => require('../../src/db').db;

let patient; let driver;

test.before(async () => {
  await startTestServer();
  patient = await signIn(ACCOUNTS.patient.phone, ACCOUNTS.patient.password);
  driver = await goOnDuty(ACCOUNTS.driverALS, NITK);
});

test.after(async () => { await stopTestServer(); });

test('completing a trip asks the patient for feedback in the app and by email', async () => {
  await clearActiveBooking(patient);
  const { bookingId, offer } = await bookAndAwaitOffer(patient, driver, {
    ambulance_type: 'ALS', ...NITK, address_text: 'NITK main gate',
  });
  const accepted = await post(`/api/provider/offers/${offer.assignment_id}/accept`, undefined, { token: driver });
  const tripId = accepted.body.trip_id;

  for (const step of ['ENROUTE', 'ARRIVED', 'ONBOARD', 'COMPLETED']) {
    const r = await post(`/api/provider/trips/${tripId}/status`, { trip_milestone: step }, { token: driver });
    assert.equal(r.status, 200, `${step}: ${JSON.stringify(r.body)}`);
  }

  const db = database();
  const note = db.prepare(
    `SELECT title, body FROM notifications WHERE booking_id = ? AND event_type = 'COMPLETED'`
  ).get(bookingId);
  assert.ok(note, 'an in-app notification was written');
  assert.match(note.body, /please give your valuable feedback/i);

  const email = db.prepare(
    `SELECT recipient_email, body FROM messages
     WHERE booking_id = ? AND message_channel = 'EMAIL' AND message_template_id = 'trip_completed_feedback'`
  ).get(bookingId);
  assert.ok(email, 'a feedback email was sent');
  assert.equal(email.recipient_email, 'adithya@example.in');
  assert.match(email.body, /valuable feedback/);
  assert.match(email.body, /Amount: Rs \d+\.\d{2}/);
});
