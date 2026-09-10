CloudCast Weather

Real-time weather forecasts with geolocation and city search, powered by the Open-Meteo REST API.

🔗 Live demo: https://cloudcastweathertoday.netlify.app/

Overview

CloudCast is an asynchronous weather web app that fetches and displays live meteorological data — current conditions, an hourly outlook, and a 5-day forecast — with automatic geolocation detection and manual city search.

Tech Stack
JavaScript (ES6+)
REST APIs — Open-Meteo
CSS3
HTML5
Features
📍 Automatic Geolocation Detection — uses the browser Geolocation API to fetch weather for "My Location"
🔍 City Search — quickly look up weather for any city, plus a "Quick Cities" shortcut list
🌡️ Unit Toggle — switch between °C and °F
⏱️ 24-Hour Forecast — hourly breakdown with local time
📆 5-Day Forecast — daily min/max temperatures
📊 Weather Highlights
Humidity
Wind speed & direction
Atmospheric pressure
Visibility
UV Index
Sunrise / sunset (sun position)
⚠️ Error Handling — graceful fallback for non-responsive or failed network requests
📱 Fully Responsive — clean layout across devices
