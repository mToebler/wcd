const axios = require('axios')
const jwtDecode = require('jwt-decode')
// PG database
const db = require('../db')

const getWeatherInfoVegas = async () => {
   const _lasVegas = process.env.WEATHER_LOCATION_CODE;
   const url = `https://www.metaweather.com/api/location/${_lasVegas}/`;
   console.log('ping 2 - url: ', url);
   const weatherData = await axios.get(url);
   // console.log('ping 3', weatherData);
   // const data = await JSON.parse(weatherData);
   // console.log('ping 4: parsed:', data);
   return weatherData.data["consolidated_weather"];
}

const getWaterNews = async () => {
   const key = process.env.NEWS_API;   
   const url = `https://newsapi.org/v2/everything?q="water conservation"&from=2022-02-12&sortBy=publishedAt&apiKey=${key}`;
   const waterNewsData = await axios.get(url); 
   // console.log('waternews:', waterNewsData.data["articles"])
   return waterNewsData.data["articles"];
}

module.exports = {
   getWeatherInfoVegas,
   getWaterNews
};