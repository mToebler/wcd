const express = require('express')
// same as express router, but waits for promises? it's good and great for PG
const Router = require('express-promise-router')
const db = require('../db')
const router = Router()

const {
   getYearUsage,
   obtainToken,
   renewToken,
   getDevices,
   getDeviceInfo,
   getUsage,
   persistUsageData,
   getTotalWeekUsageForWeek,
   getTotalMonthsUsage,
   getTotalUsageYTDLastYear,
   getTotalUsageYTD,
   getLatestActivity,
   getLatestFromFlume
} = require('../controllers/flume');

const queryFlume = async (req, res) => {
   // some params
   await obtainToken();
   await getDevices();
   await persistUsageData(); // load db
   let data = await getUsage();
   res.send(data);
};

const queryFlumeYear = async (req, res) => {   
   let data = await getYearUsage();   
   res.send(data);
};

const queryUsageWeek = async (req, res) => {
   const { week: weekNum } = req.params;
   let data = await getTotalWeekUsageForWeek(weekNum);
   res.send(data);
}

const queryTotalMonthsUsage = async (req, res) => {   
   const { month: monthNum } = req.params;
   let data = await getTotalMonthsUsage(monthNum);   
   res.send(data)
}

const queryTotalYTD = async (req, res) => {
   let data = await getTotalUsageYTD();
   console.log('getTotalYTD data', data);
   res.send(data)
}

const queryTotalYTDLastYear = async (req, res) => {
   let data = await getTotalUsageYTDLastYear();
   console.log('getTotalYTDLastYear data', data);
   res.send(data)
}

const refreshZoneUsage = async (req, res) => {
   const { minutes: count } = req.params;
   let data = await getLatestActivity(count);
   console.log('refreshZoneUsage:', data)
   res.send(data);
}

const refreshFromFlumeUsage = async (req, res) => {
   const { minuts: count } = req.params;
   await obtainToken();
   await getDevices();
   let data = await getLatestFromFlume(count);
   console.log('refreshFromFlume: ', data);
   res.send(data);
}
   

router.route('/flume').get(queryFlume);
router.route('/flume/year').get(queryFlumeYear);
router.route('/flume/year/ytd').get(queryTotalYTD);
router.route('/flume/year/prevytd').get(queryTotalYTDLastYear);
router.route('/flume/week/:week').get(queryUsageWeek);
router.route('/flume/month/:month').get(queryTotalMonthsUsage);
router.route('/flume/latest/:minutes').get(refreshZoneUsage);
router.route('/flume/recent/:minutes').get(refreshFromFlumeUsage);

module.exports = router;