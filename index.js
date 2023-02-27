const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { calendar } = require('googleapis/build/src/apis/calendar');
const { startOfDay, endOfDay, startOfHour, endOfHour, parseISO, isWithinInterval } = require('date-fns');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
// async function listEvents(auth) {
//   const calendar = google.calendar({version: 'v3', auth});
//   const res = await calendar.events.list({
//     calendarId: 'primary',
//     timeMin: new Date().toISOString(),
//     maxResults: 10,
//     singleEvents: true,
//     orderBy: 'startTime',
//   });
//   const events = res.data.items;
//   if (!events || events.length === 0) {
//     console.log('No upcoming events found.');
//     return;
//   }
//   console.log('Upcoming 10 events:');
//   events.map((event, i) => {
//     const start = event.start.dateTime || event.start.date;
//     console.log(`${start} - ${event.summary}`);
//   });
// }

// authorize().then(listEvents).catch(console.error);

/*
Use Freebusy method to query the free/busy status of a set of calendars for a specific time range

*/

async function listAvailability(auth) {

  // Create an instance of the calendar API and set its version and auth parameters
  const calendar = google.calendar({ version: 'v3', auth });

  // // Define the time range to check
  // const start = startOfDay(parseISO('2023-03-03T00:00:00Z'));
  // const end = endOfDay(parseISO('2023-03-04T23:59:59Z'));

  // Define start and end times
  const start = new Date('2023-03-02T09:00:00Z');
  const end = new Date('2023-03-02T23:59:59Z');

  console.log('start: ', start);
  console.log('end: ', end);

  // Get your own calendar's ID
  const calendarId = 'primary';

  // Add your friends' email addresses to this array
  const friendEmails = ['udonthecoton@gmail.com'];

  // Create a FreebusyRequest object that includes calendar IDs of calendars to check
  // Set up request to check free/busy status for those calendars
  const request = {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    // timeZone: 'UTC',
    timeZone: 'America/Vancouver',
    items: [
      { id: calendarId },
      ...friendEmails.map((email) => {
        return { id: email };
      }),
      // // Add friend's calendar IDs to the request
      // // ...friendAvailability.map((availability) => {
      // //   return { id: availability.calendarId };
      // // })
      // { id: 'udonthecoton@gmail.com' },
      // // add more calendars as needed
    ],
  };

  // Call freebusy.query method with the request object
  const response = await calendar.freebusy.query({
    requestBody: request,
  });

  console.log('response.data:', response.data)
  console.log('busy: [Array]', response.data.calendars.primary.busy);
  console.log('response.data.calendars:', response.data.calendars);


  // Extract free/busy status from calendars
  const busyTimes = response.data.calendars;

  // // Convert busy times to moment ranges
  // const busyRanges = Object.entries(busyTimes).map(([id, busy]) => {
  //   // Check whether busy array is empty
  //   if (Array.isArray(busy.busy) && busy.busy.length > 0) {
  //     const busyStart = parseISO(busy.busy[0].start);
  //     const busyEnd = parseISO(busy.busy[0].end);
  //     return { start: startOfHour(busyStart), end: endOfHour(busyEnd) };
  //   } else {
  //     return null;
  //   }
  // }).filter((busyRange) => {
  //   return busyRange !== null;
  // });

  // console.log('busyRanges:', busyRanges);

  // // Find overlapping ranges
  // const overlaps = busyRanges.reduce((acc, curr) => {
  //   const overlappingStart = acc.start > curr.start ? acc.start : curr.start;
  //   const overlappingEnd = acc.end < curr.end ? acc.end : curr.end;
  //   if (overlappingStart < overlappingEnd) {
  //     return { start: overlappingStart, end: overlappingEnd };
  //   } else {
  //     return null;
  //   }
  // });

  // console.log('overlaps:', overlaps);

  // // Convert overlapping ranges to array of suggested meeting times (days all users are available)
  // // after removing the busy slots of both calendars
  // const meetingTimes = [];
  // let currentDate = overlaps.start;
  // while (currentDate <= overlaps.end) {
  //   const currentDayStart = startOfDay(currentDate);
  //   const currentDayEnd = endOfDay(currentDate);
  //   const isAvailable = busyRanges.every((busyRange) => {
  //     return !isWithinInterval(currentDayStart, { start: busyRange.start, end: busyRange.end }) && !isWithinInterval(currentDayEnd, { start: busyRange.start, end: busyRange.end });
  //   });
  //   if (isAvailable) {
  //     meetingTimes.push({ start: currentDayStart.toISOString(), end: currentDayEnd.toISOString() });
  //   }
  //   currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  // }





//   // Define busy ranges
// const busyRanges = [
//   { start: new Date('2023-03-02T20:00:00Z'), end: new Date('2023-03-02T21:59:59Z') },
// ];

// // Check for overlapping times
// const overlaps = busyRanges.find(range => {
//   return (
//     (range.start >= start && range.start <= end) ||
//     (range.end >= start && range.end <= end) ||
//     (range.start <= start && range.end >= end)
//   );
// });

// // Calculate available meeting times
// const meetingTimes = [];
// if (!overlaps) {
//   const startTime = start.getTime();
//   const endTime = end.getTime();
//   let time = startTime;
//   while (time < endTime) {
//     const start = new Date(time);
//     const end = new Date(time + 60 * 60 * 1000); // add 1 hour
//     meetingTimes.push({ start, end });
//     time += 60 * 60 * 1000; // add 1 hour
//   }
// }

//   console.log('meetingTimes:', meetingTimes);
//   return meetingTimes;
// }

// authorize().then((auth) => {
//   listAvailability(auth).then((meetingTimes) => {
//     console.log(meetingTimes);
//   }).catch(console.error);
// }).catch(console.error);


// Find the intersection of free times between your calendar and your friends' calendars
let freeTimes = busyTimes[calendarId].busy.map((busy) => {
  return { start: busy.start, end: busy.end };
});

console.log('freeTimes:', freeTimes)

friendEmails.forEach((email) => {
  const friendBusy = busyTimes[email].busy;
  freeTimes = freeTimes.filter((busy) => {
    return friendBusy.every((fBusy) => {
      const fBusyStart = new Date(fBusy.start);
      const fBusyEnd = new Date(fBusy.end);
      const busyStart = new Date(busy.start);
      const busyEnd = new Date(busy.end);
      return (
        busyEnd <= fBusyStart.getTime() ||
        busyStart >= fBusyEnd.getTime()
      );
    });
  });
});

console.log('freeTimes:', freeTimes);
console.log('friendBusy:', friendBusy);

// Log the mutual free times
console.log('Mutual free times:');
freeTimes.forEach((free) => {
  console.log(`${free.start} - ${free.end}`);
});

}

authorize()
  .then(listAvailability)
  .catch((err) => {
    console.error(err);
  });



