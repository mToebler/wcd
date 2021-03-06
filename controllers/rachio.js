// for working example see twcd
const RachioClient = require('rachio');
// const { RachioService } = require('../routes/rachio');
const DEBUG = true;
const _24HOURS = 86400000;
const _MINUTE = 60000;

// PG database
const db = require('../db')

const zoneCache = {
   zones: []
}


// console.log(rachioClient);

const getRachioDevices = async () => {
   const rachioClient = await new RachioClient(process.env.AUTH_TOKEN);
   const res = await rachioClient.getDevices();
   return res;
}


const getRachioDevice = async (id) => {
   try {
      const rachioClient = await new RachioClient(process.env.AUTH_TOKEN);
      // if(DEBUG) console.log('getRachioDevice: client: ', process.env.DEVICE_ID);
      const device = await rachioClient.getDevice(process.env.DEVICE_ID);
      // console.log("getRachioDevice:", device);
      return device;
   } catch(err) {
      console.log('getRachioDevice Error: ', err);
   }
}

const getRachioZones = async () => {
   try {
      const device = await getRachioDevice();
      const zones = device.zones;
      const sortedZones = zones.sort((a, b) => a.zoneNumber - b.zoneNumber);
      // console.log('getRachioZones DEBUG: sortedZones:', sortedZones)
      return sortedZones;
   } catch(err) {
      console.error('getRachioZone ERROR: ', err);
   }
}

// must first get unique zoneId from device
const getRachioZone = async (id) => {
   try {
      const zones = await getRachioZones();      
      const zone = zones.filter((e) => (e.zoneNumber == id))
      console.log('getRachioZone', zone[0]);
      // const zone = await rachioClient.getZone(id);
      // console.log("getRachioZone:", zone);
      return zone[0];      
   } catch(err) {
      console.error('getRachioZone: ERROR', err);
   }
}

// only 28 days of retrieval is allowed!!!
// NOTE: Rachio reports time in GMT in eventDate. Flume reports time for PDT. 
// This means Flume needs 7 hours removed from MS time to sync up with rachio.
const getRachioEvents = async (startTime, endTime, filters = {}) => {
   const _25DAYS = 2160000000; // 25  days in Milliseconds
   if(startTime == null)
      startTime = new Date(Date.now() - (_25DAYS));
   else
      startTime = new Date(startTime);
   if(endTime == null)
      endTime = new Date(startTime.getTime() + (_25DAYS));
   else
      endTime = new Date(endTime);

   let startTimeMS = startTime.getTime();
   let endTimeMS = endTime.getTime();
   if(DEBUG) console.log('getRachioEvents: startTimeMS: ', startTimeMS, ' endTimeMS: ', endTimeMS);
   if(endTimeMS - startTimeMS > _25DAYS) {
      return Promise.reject(new Error('Range cannot exceed 31 days'));
   }

   filters = {
      // category: 'DEVICE',
      // type: 'RAIN_DELAY',
      subType: 'ZONE_COMPLETED',
      type: 'ZONE_STATUS',
      topic: "WATERING"
   };
   try {
      const rachioClient = await new RachioClient(process.env.AUTH_TOKEN);
      // this.rachioClient.getDeviceEvents(process.env.DEVICE_ID, startTime, endTime, filters)
      const results = await rachioClient.getDeviceEvents(process.env.DEVICE_ID, startTimeMS, endTimeMS, filters)
      // .then(events => events.forEach(e => console.log(e.toPlainObject())));
      // .then(response => console.log(response));
      // .then(response => Promise.resolve(response));
      // console.log(results)
      return results;
   } catch(err) {
      console.error("getRachioEvents", err);
   }
}
/**
 * 1. Get device
 * 2. Get all zones
 * 3. Using spread, differentiate zones
 * 4. get needed zone, check to make sure
 * 5. tell it to water for a duration 
 */
const startRachio= async (zoneNumber, duration) => {
   try {
      const device = await getRachioDevice();
      const rachioZone = await getRachioZone(zoneNumber);
      const rachioZoneId = rachioZone["id"];
      console.log('StartRachio: Using Zone:', rachioZoneId);
      const rachioClient = await new RachioClient(process.env.AUTH_TOKEN);
      const zone = await rachioClient.getZone(rachioZoneId)
      if(duration > 3600)
         throw new Error('Rachio cannot set duration for more than an hour')
      
      const response = await zone.start(duration)
      console.log('startRachio response:', response)
      // boolean
      return response;
   } catch(err) {
      console.log('startRachioERROR:', err);      
   }
}

const startRachioOneMinute = async (zoneNumber) => {
   const response = await startRachio(zoneNumber, 60);
   return response;
}


const persistRachioData = async () => {
   //TODO: wrap in a loop like flume!!!
   // const seedTime = 1609459200000 // 01-01-2021 00:00:00 GMT
   const { rows } = await db.query('SELECT EXTRACT(EPOCH FROM (SELECT MAX(stop_time) FROM rachio)) * 1000 AS seedtime')
   const seedTime = rows[0].seedtime + 28860000;  // Skipping ahead 8 hours and  1 min (Rachio serves timezone unadjustec)
   // const seedTime = 1643327770000;

   console.log('DEBUG: seedTime rows', seedTime, rows);
   
   // set up for loop
   for(x = seedTime; x < Date.now(); x = x + ((_24HOURS * 25) + _MINUTE)) {
      const data = await getRachioEvents(x , x + ((_24HOURS * 25)));
      // const data = await getRachioEvents();
      console.log("length:", data.length);
      // console.log(data[0]);
      data.map(e => {
         console.log(e.eventDate,
            e.summary.slice(
               1,
               e.summary.indexOf(' ')
            ),
            e.summary.slice(
               e.summary.indexOf('for ') + 4,
               e.summary.indexOf('minutes') - 1,
            ));
         let end = e.eventDate;
         let zone = e.summary.slice(1, e.summary.indexOf(' '));
         let duration = e.summary.slice(e.summary.indexOf('for ') + 4,
            e.summary.indexOf('minutes') - 1);
         let start = (end - duration * _MINUTE) / 1000;
         end = end / 1000;
         console.log(start, end, zone, duration);
         try {
            const { rows } = db.query(`INSERT INTO rachio (start_time, stop_time, zone_id) values (to_timestamp($1), to_timestamp($2), $3)`, [start, end, zone]);

            // console.log(rows)
         } catch(err) {
            console.log('RachioPersist Error', err)
         }
      });
   }
};


// testing 
// setTimeout(getRachioEvents, 1000);
   setTimeout(persistRachioData, 3000);
   // setTimeout(startRachio, 5000, 2, 180);
   


module.exports = {
   getRachioEvents,
   getRachioDevice,
   getRachioZone,
   getRachioZones,
   persistRachioData,
   startRachio,
   startRachioOneMinute
}
