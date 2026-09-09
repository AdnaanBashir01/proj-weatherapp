/**
 * ==========================================================================
 * CloudySky Weather — Main JavaScript Logic
 * Clean, minimal, real-time weather implementation.
 * ==========================================================================
 */

// --------------------------------------------------------------------------
// 1. Application Configuration & State Management
// --------------------------------------------------------------------------
const CONFIG = {
    DEFAULT_CITY: {
        name: 'Kathua',
        country: 'IN',
        lat: 32.37,
        lon: 75.52,
        timezone: 'Asia/Kolkata'
    },
    FALLBACK_CITY: {
        name: 'London',
        country: 'GB',
        lat: 51.5074,
        lon: -0.1278,
        timezone: 'Europe/London'
    },
    GEOLOCATION_TIMEOUT: 8000,
    SEARCH_DEBOUNCE_MS: 300,
    STORAGE_KEY: 'cloudySky_lastLocation',
    FAVORITES_KEY: 'cloudySky_favorites'
};

const state = {
    unit: 'C',
    currentData: null,
    currentTimezone: 'auto',
    clockInterval: null,
    searchDebounceTimer: null,
    favorites: JSON.parse(localStorage.getItem(CONFIG.FAVORITES_KEY) || '[]')
};

// WMO Weather Interpretation Codes
const WMO_CODES = {
    0: { desc: 'Clear Sky', icon: 'sun', theme: 'day-clear' },
    1: { desc: 'Mainly Clear', icon: 'partly-cloudy', theme: 'day-clear' },
    2: { desc: 'Partly Cloudy', icon: 'partly-cloudy', theme: 'cloudy' },
    3: { desc: 'Overcast', icon: 'cloudy', theme: 'cloudy' },
    45: { desc: 'Foggy', icon: 'fog', theme: 'foggy' },
    48: { desc: 'Depositing Rime Fog', icon: 'fog', theme: 'foggy' },
    51: { desc: 'Light Drizzle', icon: 'rain-light', theme: 'rainy' },
    53: { desc: 'Moderate Drizzle', icon: 'rain', theme: 'rainy' },
    55: { desc: 'Dense Drizzle', icon: 'rain', theme: 'rainy' },
    61: { desc: 'Slight Rain', icon: 'rain-light', theme: 'rainy' },
    63: { desc: 'Moderate Rain', icon: 'rain', theme: 'rainy' },
    65: { desc: 'Heavy Rain', icon: 'rain-heavy', theme: 'rainy' },
    71: { desc: 'Slight Snow', icon: 'snow', theme: 'snowy' },
    73: { desc: 'Moderate Snow', icon: 'snow', theme: 'snowy' },
    75: { desc: 'Heavy Snow', icon: 'snow', theme: 'snowy' },
    77: { desc: 'Snow Grains', icon: 'snow', theme: 'snowy' },
    80: { desc: 'Slight Rain Showers', icon: 'rain', theme: 'rainy' },
    81: { desc: 'Moderate Rain Showers', icon: 'rain-heavy', theme: 'rainy' },
    82: { desc: 'Violent Rain Showers', icon: 'rain-heavy', theme: 'rainy' },
    85: { desc: 'Slight Snow Showers', icon: 'snow', theme: 'snowy' },
    86: { desc: 'Heavy Snow Showers', icon: 'snow', theme: 'snowy' },
    95: { desc: 'Thunderstorm', icon: 'thunderstorm', theme: 'thunderstorm' },
    96: { desc: 'Thunderstorm with Hail', icon: 'thunderstorm', theme: 'thunderstorm' },
    99: { desc: 'Heavy Thunderstorm', icon: 'thunderstorm', theme: 'thunderstorm' }
};

// --------------------------------------------------------------------------
// 2. DOM Elements Selection
// --------------------------------------------------------------------------
const DOM = {
    searchForm: document.getElementById('searchForm'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    searchSuggestions: document.getElementById('searchSuggestions'),
    btnLocation: document.getElementById('btnLocation'),
    btnCelsius: document.getElementById('btnCelsius'),
    btnFahrenheit: document.getElementById('btnFahrenheit'),

    notificationBanner: document.getElementById('notificationBanner'),
    notifIcon: document.getElementById('notifIcon'),
    notifMessage: document.getElementById('notifMessage'),
    btnNotifClose: document.getElementById('btnNotifClose'),
    recentChips: document.getElementById('recentChips'),

    weatherDashboard: document.getElementById('weatherDashboard'),

    cityName: document.getElementById('cityName'),
    countryBadge: document.getElementById('countryBadge'),
    localTime: document.getElementById('localTime'),
    btnStarFavorite: document.getElementById('btnStarFavorite'),
    weatherIconContainer: document.getElementById('weatherIconContainer'),
    currentTemp: document.getElementById('currentTemp'),
    currentUnit: document.getElementById('currentUnit'),
    weatherCondition: document.getElementById('weatherCondition'),
    feelsLikeTemp: document.getElementById('feelsLikeTemp'),
    highTemp: document.getElementById('highTemp'),
    lowTemp: document.getElementById('lowTemp'),

    humidityVal: document.getElementById('humidityVal'),
    humidityBar: document.getElementById('humidityBar'),
    humiditySub: document.getElementById('humiditySub'),
    windVal: document.getElementById('windVal'),
    windCompass: document.getElementById('windCompass'),
    windDirText: document.getElementById('windDirText'),
    pressureVal: document.getElementById('pressureVal'),
    pressureSub: document.getElementById('pressureSub'),
    visibilityVal: document.getElementById('visibilityVal'),
    visibilitySub: document.getElementById('visibilitySub'),
    uvVal: document.getElementById('uvVal'),
    uvSub: document.getElementById('uvSub'),
    sunriseVal: document.getElementById('sunriseVal'),
    sunsetVal: document.getElementById('sunsetVal'),

    hourlyContainer: document.getElementById('hourlyContainer'),
    forecastList: document.getElementById('forecastList')
};

// --------------------------------------------------------------------------
// 3. Application Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    renderFavoritesChips();

    const savedLocation = getSavedLocation();
    if (savedLocation && savedLocation.lat && savedLocation.lon) {
        fetchWeatherByCoords(savedLocation.lat, savedLocation.lon, savedLocation.name, savedLocation.country);
    } else {
        requestGeolocationWithFallback(false);
    }
});

function initEventListeners() {
    DOM.searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = DOM.searchInput.value.trim();
        if (query) {
            hideSuggestions();
            searchAndFetchCity(query);
        }
    });

    DOM.searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
            DOM.btnClearSearch.hidden = false;
        } else {
            DOM.btnClearSearch.hidden = true;
            hideSuggestions();
            return;
        }

        clearTimeout(state.searchDebounceTimer);
        state.searchDebounceTimer = setTimeout(() => {
            fetchCitySuggestions(query);
        }, CONFIG.SEARCH_DEBOUNCE_MS);
    });

    DOM.btnClearSearch.addEventListener('click', () => {
        DOM.searchInput.value = '';
        DOM.btnClearSearch.hidden = true;
        hideSuggestions();
        DOM.searchInput.focus();
    });

    DOM.btnLocation.addEventListener('click', () => {
        requestGeolocationWithFallback(true);
    });

    DOM.btnCelsius.addEventListener('click', () => setUnit('C'));
    DOM.btnFahrenheit.addEventListener('click', () => setUnit('F'));
    DOM.btnStarFavorite.addEventListener('click', toggleCurrentFavorite);

    DOM.btnNotifClose.addEventListener('click', () => {
        DOM.notificationBanner.hidden = true;
        DOM.notificationBanner.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if (!DOM.searchForm.contains(e.target)) {
            hideSuggestions();
        }
    });
}

// --------------------------------------------------------------------------
// 4. Geolocation Logic
// --------------------------------------------------------------------------
function requestGeolocationWithFallback(userTriggered = false) {
    if (!navigator.geolocation) {
        if (userTriggered) {
            showNotification('⚠️', 'Geolocation is not supported by your browser.', 4000);
        }
        fallbackToDefaultCity();
        return;
    }

    const geoOptions = {
        enableHighAccuracy: true,
        timeout: CONFIG.GEOLOCATION_TIMEOUT,
        maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            let cityName = '';
            let countryCode = '';

            try {
                const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    cityName = geoData.city || geoData.locality || geoData.principalSubdivision || 'Your Location';
                    countryCode = geoData.countryCode || '';
                }
            } catch (err) {
                cityName = 'My Location';
            }

            fetchWeatherByCoords(latitude, longitude, cityName, countryCode, true);
        },
        (error) => {
            if (userTriggered) {
                showNotification('⚠️', 'Location permission declined. Showing fallback weather.', 4000);
            }
            
            const saved = getSavedLocation();
            if (saved && saved.lat && saved.lon) {
                fetchWeatherByCoords(saved.lat, saved.lon, saved.name, saved.country);
            } else {
                fallbackToDefaultCity();
            }
        },
        geoOptions
    );
}

function fallbackToDefaultCity() {
    fetchWeatherByCoords(CONFIG.DEFAULT_CITY.lat, CONFIG.DEFAULT_CITY.lon, CONFIG.DEFAULT_CITY.name, CONFIG.DEFAULT_CITY.country);
}

// --------------------------------------------------------------------------
// 5. REST Weather API Service
// --------------------------------------------------------------------------
async function fetchCitySuggestions(query) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            renderSuggestions(data.results);
        } else {
            hideSuggestions();
        }
    } catch (err) {
        hideSuggestions();
    }
}

function renderSuggestions(results) {
    DOM.searchSuggestions.innerHTML = '';
    DOM.searchSuggestions.hidden = false;

    results.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <span><strong>${item.name}</strong>${item.admin1 ? `, ${item.admin1}` : ''}</span>
            <span class="suggestion-country">${item.country_code || item.country || ''}</span>
        `;
        div.addEventListener('click', () => {
            DOM.searchInput.value = `${item.name}${item.country_code ? `, ${item.country_code}` : ''}`;
            hideSuggestions();
            fetchWeatherByCoords(item.latitude, item.longitude, item.name, item.country_code, true);
        });
        DOM.searchSuggestions.appendChild(div);
    });
}

function hideSuggestions() {
    DOM.searchSuggestions.hidden = true;
    DOM.searchSuggestions.innerHTML = '';
}

async function searchAndFetchCity(cityName) {
    try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
        const response = await fetch(geoUrl);
        if (!response.ok) throw new Error('Service unavailable');
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            showNotification('⚠️', `City "${cityName}" not found. Please check spelling.`, 4000);
            return;
        }

        const city = data.results[0];
        fetchWeatherByCoords(city.latitude, city.longitude, city.name, city.country_code, true);
    } catch (err) {
        showNotification('⚠️', 'Network error. Please check your connection.', 4000);
    }
}

async function fetchWeatherByCoords(lat, lon, cityName = '', countryCode = '', saveToStorage = true) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,relative_humidity_2m,precipitation_probability,uv_index&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,uv_index_max&timezone=auto`;

        const response = await fetch(weatherUrl);
        if (!response.ok) throw new Error(`Weather API Error`);
        const data = await response.json();

        const locationName = cityName || (data.timezone ? data.timezone.split('/')[1].replace('_', ' ') : 'Unknown');
        
        const processed = {
            city: locationName,
            country: countryCode || '',
            lat,
            lon,
            timezone: data.timezone || 'UTC',
            current: {
                tempC: Math.round(data.current.temperature_2m),
                feelsLikeC: Math.round(data.current.apparent_temperature),
                humidity: data.current.relative_humidity_2m,
                pressure: Math.round(data.current.surface_pressure),
                windKm: Math.round(data.current.wind_speed_10m),
                windDir: data.current.wind_direction_10m,
                weatherCode: data.current.weather_code,
                isDay: data.current.is_day,
                precipMm: data.current.precipitation
            },
            daily: processDailyForecast(data.daily),
            hourly: processHourlyForecast(data.hourly)
        };

        state.currentData = processed;
        state.currentTimezone = processed.timezone;

        if (saveToStorage) {
            saveLocation({ name: processed.city, country: processed.country, lat, lon });
        }

        renderWeatherDashboard(processed);

    } catch (err) {
        showNotification('⚠️', 'Failed to retrieve weather data.', 4000);
    }
}

function processDailyForecast(dailyData) {
    const forecast = [];
    if (!dailyData || !dailyData.time) return forecast;

    for (let i = 0; i < Math.min(6, dailyData.time.length); i++) {
        forecast.push({
            dateStr: dailyData.time[i],
            weatherCode: dailyData.weather_code[i],
            maxTempC: Math.round(dailyData.temperature_2m_max[i]),
            minTempC: Math.round(dailyData.temperature_2m_min[i]),
            sunrise: dailyData.sunrise[i],
            sunset: dailyData.sunset[i],
            precipSum: dailyData.precipitation_sum[i],
            uvIndexMax: dailyData.uv_index_max ? dailyData.uv_index_max[i] : 0
        });
    }
    return forecast;
}

function processHourlyForecast(hourlyData) {
    const hourly = [];
    if (!hourlyData || !hourlyData.time) return hourly;

    const now = new Date();
    const currentISO = now.toISOString().slice(0, 13);

    let startIndex = 0;
    for (let i = 0; i < hourlyData.time.length; i++) {
        if (hourlyData.time[i].startsWith(currentISO)) {
            startIndex = i;
            break;
        }
    }

    for (let i = startIndex; i < Math.min(startIndex + 24, hourlyData.time.length); i++) {
        hourly.push({
            timeIso: hourlyData.time[i],
            tempC: Math.round(hourlyData.temperature_2m[i]),
            weatherCode: hourlyData.weather_code[i],
            pop: hourlyData.precipitation_probability ? hourlyData.precipitation_probability[i] : 0,
            uvIndex: hourlyData.uv_index ? hourlyData.uv_index[i] : 0
        });
    }
    return hourly;
}

// --------------------------------------------------------------------------
// 6. UI Rendering & Theme Mapping
// --------------------------------------------------------------------------
function renderWeatherDashboard(data) {
    const { city, country, timezone, current, daily, hourly } = data;
    const wmo = WMO_CODES[current.weatherCode] || WMO_CODES[0];

    applyDynamicTheme(wmo.theme, current.isDay);

    DOM.cityName.textContent = city;
    DOM.countryBadge.textContent = country ? country.toUpperCase() : 'GPS';

    const isFav = state.favorites.some(f => f.name.toLowerCase() === city.toLowerCase());
    DOM.btnStarFavorite.classList.toggle('active', isFav);

    DOM.weatherCondition.textContent = wmo.desc;
    
    const todayDaily = daily[0] || { maxTempC: current.tempC, minTempC: current.tempC };
    updateTemperatureDisplay(current.tempC, current.feelsLikeC, todayDaily.maxTempC, todayDaily.minTempC);

    DOM.weatherIconContainer.innerHTML = getWeatherSvgIcon(wmo.icon, current.isDay);

    DOM.humidityVal.textContent = `${current.humidity}%`;
    DOM.humidityBar.style.width = `${current.humidity}%`;
    DOM.humiditySub.textContent = getHumidityDescription(current.humidity);

    const windDisplay = state.unit === 'C' ? `${current.windKm} km/h` : `${kmToMph(current.windKm)} mph`;
    DOM.windVal.textContent = windDisplay;
    DOM.windCompass.style.transform = `rotate(${current.windDir}deg)`;
    DOM.windDirText.textContent = `Direction: ${getWindDirectionName(current.windDir)} (${current.windDir}°)`;

    DOM.pressureVal.textContent = `${current.pressure} hPa`;
    DOM.pressureSub.textContent = current.pressure > 1013 ? 'High pressure system' : 'Low pressure system';

    const visibilityKm = current.humidity > 85 ? 6 : 10;
    DOM.visibilityVal.textContent = `${visibilityKm} km`;
    DOM.visibilitySub.textContent = visibilityKm >= 10 ? 'Optimal clear vision' : 'Reduced atmospheric visibility';

    const uvVal = todayDaily.uvIndexMax !== undefined ? todayDaily.uvIndexMax : 0;
    DOM.uvVal.textContent = uvVal.toFixed(1);
    DOM.uvSub.textContent = getUvDescription(uvVal);

    if (todayDaily.sunrise && todayDaily.sunset) {
        DOM.sunriseVal.textContent = formatTimeOnly(todayDaily.sunrise, timezone);
        DOM.sunsetVal.textContent = formatTimeOnly(todayDaily.sunset, timezone);
    }

    renderHourlyList(hourly, timezone);
    render5DayForecastList(daily.slice(1, 6));

    startLiveClock(timezone);
}

function applyDynamicTheme(themeName, isDay) {
    document.body.className = '';
    if (isDay === 0 && themeName === 'day-clear') {
        document.body.classList.add('theme-night-clear');
    } else {
        document.body.classList.add(`theme-${themeName}`);
    }
}

function startLiveClock(timezone) {
    if (state.clockInterval) clearInterval(state.clockInterval);

    function updateClock() {
        try {
            const now = new Date();
            const formatted = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
            }).format(now);
            DOM.localTime.textContent = `${formatted} (${timezone.split('/')[1] || timezone})`;
        } catch (e) {
            DOM.localTime.textContent = new Date().toLocaleTimeString();
        }
    }

    updateClock();
    state.clockInterval = setInterval(updateClock, 1000);
}

function renderHourlyList(hourlyItems, timezone) {
    DOM.hourlyContainer.innerHTML = '';

    hourlyItems.forEach((item, idx) => {
        const wmo = WMO_CODES[item.weatherCode] || WMO_CODES[0];
        const displayTemp = state.unit === 'C' ? `${item.tempC}°` : `${celsiusToFahrenheit(item.tempC)}°`;
        const formattedHour = formatTimeOnly(item.timeIso, timezone);

        const card = document.createElement('div');
        card.className = `hourly-item ${idx === 0 ? 'now' : ''}`;
        card.innerHTML = `
            <span class="hourly-time">${idx === 0 ? 'Now' : formattedHour}</span>
            <div class="hourly-icon">${getWeatherSvgIcon(wmo.icon, 1, 32)}</div>
            <span class="hourly-temp">${displayTemp}</span>
            ${item.pop > 10 ? `<span class="hourly-pop">💧 ${item.pop}%</span>` : ''}
        `;
        DOM.hourlyContainer.appendChild(card);
    });
}

function render5DayForecastList(dailyDays) {
    DOM.forecastList.innerHTML = '';

    dailyDays.forEach((day) => {
        const wmo = WMO_CODES[day.weatherCode] || WMO_CODES[0];
        const maxT = state.unit === 'C' ? `${day.maxTempC}°` : `${celsiusToFahrenheit(day.maxTempC)}°`;
        const minT = state.unit === 'C' ? `${day.minTempC}°` : `${celsiusToFahrenheit(day.minTempC)}°`;

        const dateObj = new Date(day.dateStr + 'T00:00:00');
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObj);
        const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateObj);

        const itemEl = document.createElement('div');
        itemEl.className = 'forecast-item';
        itemEl.innerHTML = `
            <div class="forecast-day-group">
                <span class="forecast-day-name">${dayName}</span>
                <span class="forecast-date">${monthDay}</span>
            </div>
            <div class="forecast-icon">${getWeatherSvgIcon(wmo.icon, 1, 28)}</div>
            <span class="forecast-condition-desc">${wmo.desc}</span>
            <div class="forecast-temp-range">
                <span class="temp-max">${maxT}</span>
                <span class="temp-min">${minT}</span>
            </div>
        `;
        DOM.forecastList.appendChild(itemEl);
    });
}

// --------------------------------------------------------------------------
// 7. Unit Conversion
// --------------------------------------------------------------------------
function setUnit(newUnit) {
    if (state.unit === newUnit) return;
    state.unit = newUnit;

    DOM.btnCelsius.classList.toggle('active', newUnit === 'C');
    DOM.btnCelsius.setAttribute('aria-checked', newUnit === 'C');
    DOM.btnFahrenheit.classList.toggle('active', newUnit === 'F');
    DOM.btnFahrenheit.setAttribute('aria-checked', newUnit === 'F');

    if (state.currentData) {
        const { current, daily, hourly } = state.currentData;
        const todayDaily = daily[0] || { maxTempC: current.tempC, minTempC: current.tempC };
        
        updateTemperatureDisplay(current.tempC, current.feelsLikeC, todayDaily.maxTempC, todayDaily.minTempC);

        const windDisplay = state.unit === 'C' ? `${current.windKm} km/h` : `${kmToMph(current.windKm)} mph`;
        DOM.windVal.textContent = windDisplay;

        renderHourlyList(hourly, state.currentTimezone);
        render5DayForecastList(daily.slice(1, 6));
    }
}

function updateTemperatureDisplay(tempC, feelsC, maxC, minC) {
    DOM.currentUnit.textContent = `°${state.unit}`;

    if (state.unit === 'C') {
        DOM.currentTemp.textContent = tempC;
        DOM.feelsLikeTemp.textContent = `${feelsC}°C`;
        DOM.highTemp.textContent = `${maxC}°C`;
        DOM.lowTemp.textContent = `${minC}°C`;
    } else {
        DOM.currentTemp.textContent = celsiusToFahrenheit(tempC);
        DOM.feelsLikeTemp.textContent = `${celsiusToFahrenheit(feelsC)}°F`;
        DOM.highTemp.textContent = `${celsiusToFahrenheit(maxC)}°F`;
        DOM.lowTemp.textContent = `${celsiusToFahrenheit(minC)}°F`;
    }
}

function celsiusToFahrenheit(c) {
    return Math.round((c * 9 / 5) + 32);
}

function kmToMph(km) {
    return Math.round(km * 0.621371);
}

// --------------------------------------------------------------------------
// 8. Storage & Favorites Management
// --------------------------------------------------------------------------
function saveLocation(locationObj) {
    try {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(locationObj));
    } catch (e) {}
}

function getSavedLocation() {
    try {
        const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

function toggleCurrentFavorite() {
    if (!state.currentData) return;
    const { city, country, lat, lon } = state.currentData;

    const existingIndex = state.favorites.findIndex(f => f.name.toLowerCase() === city.toLowerCase());
    if (existingIndex >= 0) {
        state.favorites.splice(existingIndex, 1);
        showNotification('⭐', `Removed ${city} from favorites`, 2000);
    } else {
        if (state.favorites.length >= 6) state.favorites.shift();
        state.favorites.push({ name: city, country, lat, lon });
        showNotification('⭐', `Added ${city} to favorites!`, 2000);
    }

    localStorage.setItem(CONFIG.FAVORITES_KEY, JSON.stringify(state.favorites));
    DOM.btnStarFavorite.classList.toggle('active', existingIndex < 0);
    renderFavoritesChips();
}

function renderFavoritesChips() {
    DOM.recentChips.innerHTML = '';

    const defaultQuickCities = [
        { name: 'London', country: 'GB', lat: 51.5074, lon: -0.1278 },
        { name: 'Kathua', country: 'IN', lat: 32.37, lon: 75.52 },
        { name: 'Tokyo', country: 'JP', lat: 35.6762, lon: 139.6503 },
        { name: 'New York', country: 'US', lat: 40.7128, lon: -74.0060 }
    ];

    const listToRender = state.favorites.length > 0 ? state.favorites : defaultQuickCities;

    listToRender.forEach((item) => {
        const chip = document.createElement('button');
        chip.className = 'chip-btn';
        chip.innerHTML = `📍 <span>${item.name}</span>`;
        chip.addEventListener('click', () => {
            fetchWeatherByCoords(item.lat, item.lon, item.name, item.country, true);
        });
        DOM.recentChips.appendChild(chip);
    });
}

function showNotification(icon, message, duration = 4000) {
    DOM.notifIcon.textContent = icon;
    DOM.notifMessage.textContent = message;
    DOM.notificationBanner.hidden = false;
    DOM.notificationBanner.style.display = 'flex';

    clearTimeout(state.notifTimer);
    state.notifTimer = setTimeout(() => {
        DOM.notificationBanner.hidden = true;
        DOM.notificationBanner.style.display = 'none';
    }, duration);
}

// --------------------------------------------------------------------------
// 9. Weather SVG Icon Generator & Utilities
// --------------------------------------------------------------------------
function getWeatherSvgIcon(iconType, isDay = 1, size = 100) {
    const colorSun = '#facc15';
    const colorCloud = '#e2e8f0';
    const colorRain = '#38bdf8';
    const colorThunder = '#f43f5e';
    const colorSnow = '#bae6fd';

    switch (iconType) {
        case 'sun':
            return isDay ? `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <circle cx="32" cy="32" r="14" fill="${colorSun}"/>
                    <g stroke="${colorSun}" stroke-width="3" stroke-linecap="round">
                        <line x1="32" y1="6" x2="32" y2="12"/>
                        <line x1="32" y1="52" x2="32" y2="58"/>
                        <line x1="6" y1="32" x2="12" y2="32"/>
                        <line x1="52" y1="32" x2="58" y2="32"/>
                        <line x1="13.6" y1="13.6" x2="17.8" y2="17.8"/>
                        <line x1="46.2" y1="46.2" x2="50.4" y2="50.4"/>
                        <line x1="13.6" y1="50.4" x2="17.8" y2="46.2"/>
                        <line x1="46.2" y1="17.8" x2="50.4" y2="13.6"/>
                    </g>
                </svg>
            ` : `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M42 12A22 22 0 1 1 20 40a18 18 0 0 0 22-28z" fill="${colorSun}"/>
                </svg>
            `;

        case 'partly-cloudy':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <circle cx="24" cy="24" r="10" fill="${colorSun}"/>
                    <path d="M46 48H20a12 12 0 0 1-1.8-23.9 15 15 0 0 1 29.3-3.6A11 11 0 0 1 46 48z" fill="${colorCloud}"/>
                </svg>
            `;

        case 'cloudy':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M48 48H18a14 14 0 0 1-2.2-27.8 17 17 0 0 1 33.2-4A12.5 12.5 0 0 1 48 48z" fill="${colorCloud}"/>
                </svg>
            `;

        case 'rain-light':
        case 'rain':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M46 40H20a11 11 0 0 1-1.6-21.9 14 14 0 0 1 27.3-3.3A10 10 0 0 1 46 40z" fill="${colorCloud}"/>
                    <g fill="${colorRain}">
                        <circle cx="22" cy="48" r="2.5"/>
                        <circle cx="32" cy="52" r="2.5"/>
                        <circle cx="42" cy="48" r="2.5"/>
                    </g>
                </svg>
            `;

        case 'rain-heavy':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M46 36H20a11 11 0 0 1-1.6-21.9 14 14 0 0 1 27.3-3.3A10 10 0 0 1 46 36z" fill="#94a3b8"/>
                    <g stroke="${colorRain}" stroke-width="3" stroke-linecap="round">
                        <line x1="20" y1="42" x2="16" y2="52"/>
                        <line x1="32" y1="42" x2="28" y2="52"/>
                        <line x1="44" y1="42" x2="40" y2="52"/>
                    </g>
                </svg>
            `;

        case 'thunderstorm':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M46 34H20a11 11 0 0 1-1.6-21.9 14 14 0 0 1 27.3-3.3A10 10 0 0 1 46 34z" fill="#475569"/>
                    <polygon points="32 36 24 48 30 48 26 58 38 44 32 44" fill="${colorSun}"/>
                </svg>
            `;

        case 'snow':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M46 38H20a11 11 0 0 1-1.6-21.9 14 14 0 0 1 27.3-3.3A10 10 0 0 1 46 38z" fill="${colorCloud}"/>
                    <g fill="${colorSnow}">
                        <circle cx="20" cy="48" r="3"/>
                        <circle cx="32" cy="52" r="3"/>
                        <circle cx="44" cy="48" r="3"/>
                    </g>
                </svg>
            `;

        case 'fog':
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <path d="M46 30H20a11 11 0 0 1-1.6-21.9 14 14 0 0 1 27.3-3.3A10 10 0 0 1 46 30z" fill="${colorCloud}"/>
                    <g stroke="${colorCloud}" stroke-width="3" stroke-linecap="round">
                        <line x1="16" y1="40" x2="48" y2="40"/>
                        <line x1="20" y1="48" x2="44" y2="48"/>
                        <line x1="14" y1="56" x2="50" y2="56"/>
                    </g>
                </svg>
            `;

        default:
            return `
                <svg viewBox="0 0 64 64" width="${size}" height="${size}">
                    <circle cx="32" cy="32" r="16" fill="${colorSun}"/>
                </svg>
            `;
    }
}

function getHumidityDescription(h) {
    if (h < 30) return 'Dry Air';
    if (h <= 60) return 'Comfortable';
    if (h <= 80) return 'Humid';
    return 'Very Humid';
}

function getUvDescription(uv) {
    if (uv <= 2) return 'Low Risk';
    if (uv <= 5) return 'Moderate Risk';
    if (uv <= 7) return 'High Risk';
    if (uv <= 10) return 'Very High Risk';
    return 'Extreme Risk';
}

function getWindDirectionName(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
}

function formatTimeOnly(isoString, timezone) {
    try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(date);
    } catch (e) {
        return isoString.split('T')[1]?.slice(0, 5) || '12:00';
    }
}
