// Code clearly commented as requested for this project

//Global Variables
const loader = document.getElementById("loader");
const customSelect = document.querySelector(".custom-select");
// For the Local Storage
let isCelsius = true;
let lastCityVisited = null;

// Handle Errors
function handleError(message, error = null) {
  console.error(message, error || "");
  const currentDayContainer = document.getElementById("current-day");
  if (currentDayContainer) {
    currentDayContainer.innerHTML = `
      <div class="error-container" role="alert">
        <p class="error-message">${message}</p>
        <button class="retry-button" onclick="window.location.reload()">Try Again</button>
      </div>`;
  }

  // Announce the error to screen readers
  const announcer = document.getElementById("sr-announcer");
  if (announcer) {
    announcer.textContent = `Error: ${message}`;
  }
}

// Local Storage Management

// Save user preferences to Local Storage
function saveUserPreferences(city, lat, lon) {
  try {
    const userPreferences = {
      lastCityVisited: city,
      coordinates: { lat, lon },
      temperatureUnit: isCelsius ? "Celsius" : "Fahrenheit",
      timestamp: new Date().getTime(), // Store the current timestamp
    };
    localStorage.setItem("userPreferences", JSON.stringify(userPreferences));
  } catch (error) {
    handleError("Failed to save user preferences.", error);
  }
}

// Load user preferences from Local Storage
// Less than 12 hours old
function loadUserPreferences() {
  try {
    const stored = localStorage.getItem("userPreferences");
    if (stored) {
      const userPreferences = JSON.parse(stored);
      const now = new Date().getTime();
      const isRecent = now - userPreferences.timestamp < 12 * 60 * 60 * 1000;

      if (isRecent) {
        isCelsius = userPreferences.temperatureUnit === "Celsius";
        document.getElementById("toggle-temp").textContent = isCelsius
          ? "Show in °F"
          : "Show in °C";
        lastCityVisited = userPreferences.lastCityVisited;
        return userPreferences.coordinates || null;
      }
    }
  } catch (error) {
    handleError("Failed to load user preferences.", error);
  }
  return null;
}

// Load city coordinates (Data) from the CSV file
async function loadCityCoordinates() {
  try {
    const response = await fetch("data/city_coordinates.csv");
    if (!response.ok) throw new Error(`CSV load error: ${response.status}`);

    const data = await response.text();
    const cities = data
      .split("\n")
      .slice(1)
      .map((row) => {
        const [lat, lon, city, country] = row.split(",");
        if (!lat || !lon || !city || !country) return null;
        return { city, country, lat, lon };
      })
      .filter(Boolean);

    if (!cities.length) throw new Error("No city data found.");
    initCustomSelect(cities);
  } catch (error) {
    handleError("Error loading cities.", error);
  }
}

// Dropdown menu custom select
function initCustomSelect(cities) {
  const selected = customSelect.querySelector(".selected");
  const optionsContainer = customSelect.querySelector(".options-container");

  cities.forEach(({ city, country, lat, lon }, index) => {
    const option = document.createElement("div");
    option.classList.add("option");
    option.setAttribute("role", "option");
    option.setAttribute("id", `city-option-${index}`);
    option.textContent = `${city}, ${country}`;
    option.dataset.lat = lat;
    option.dataset.lon = lon;
    optionsContainer.appendChild(option);
  });

  optionsContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.target.click();
    }
  });

  selected.addEventListener("click", () => {
    const isActive = customSelect.classList.toggle("active");
    customSelect.setAttribute("aria-expanded", isActive);
  });

  optionsContainer.addEventListener("click", handleOptionSelection);
  document.addEventListener("click", closeSelectOnClickOutside);
}

// Handle city selection from the dropdown
function handleOptionSelection(e) {
  if (e.target.classList.contains("option")) {
    const selected = customSelect.querySelector(".selected");
    const city = e.target.textContent;
    selected.textContent = city;
    customSelect.classList.remove("active");

    const { lat, lon } = e.target.dataset;

    saveUserPreferences(city, lat, lon);
    fetchWeatherData(lat, lon);
  }
}

// Close the dropdown menu when clicking outside
function closeSelectOnClickOutside(e) {
  if (!customSelect.contains(e.target)) {
    customSelect.classList.remove("active");
  }
}

// Show / Hide the loader
function showLoader() {
  if (loader) {
    loader.classList.remove("hidden");
    loader.style.display = "flex";
  }
}
function hideLoader() {
  if (loader) loader.classList.add("hidden");
}

// Cache weather data to reduce API calls
function getCachedWeatherData(lat, lon) {
  try {
    const cacheKey = `weather_${lat}_${lon}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Cache valid for 3 hours
      if (new Date().getTime() - data.timestamp < 3 * 60 * 60 * 1000) {
        return data.forecast;
      }
    }
  } catch (error) {
    console.warn("Error reading weather cache", error);
  }
  return null;
}

function cacheWeatherData(lat, lon, forecast) {
  try {
    const cacheKey = `weather_${lat}_${lon}`;
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        forecast,
        timestamp: new Date().getTime(),
      })
    );
  } catch (error) {
    console.warn("Error saving weather cache", error);
  }
}

// Fetch weather forecast from the 7Timer! API
async function fetchWeatherData(lat, lon) {
  showLoader();

  try {
    // Validate coordinates
    if (
      isNaN(parseFloat(lat)) ||
      isNaN(parseFloat(lon)) ||
      Math.abs(parseFloat(lat)) > 90 ||
      Math.abs(parseFloat(lon)) > 180
    ) {
      throw new Error("Invalid coordinates");
    }

    // Check cache first
    const cachedData = getCachedWeatherData(lat, lon);
    if (cachedData) {
      console.info("Using cached weather data");
      displayWeatherCards(cachedData);
      // Annoncer la mise à jour pour les lecteurs d'écran
      const announcer = document.getElementById("sr-announcer");
      if (announcer) {
        announcer.textContent = `Weather forecast updated for ${lastCityVisited}`;
      }
      hideLoader();
      return;
    }

    const url = `https://www.7timer.info/bin/api.pl?lon=${lon}&lat=${lat}&product=civillight&output=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    if (!data.dataseries?.length) throw new Error("No weather data available.");

    // Cache the fresh data
    cacheWeatherData(lat, lon, data.dataseries);
    displayWeatherCards(data.dataseries);
  } catch (error) {
    handleError("Weather data unavailable.", error);
  } finally {
    hideLoader();
  }
}

// Render the weather forecast
function displayWeatherCards(forecast) {
  if (!forecast || forecast.length === 0) {
    console.warn("No weather data available.");
    return;
  }

  const today = forecast[0]; // First day = today
  const nextDays = forecast.slice(1, 7); // Next 6 days

  const currentDayContainer = document.getElementById("current-day");
  const nextDaysContainer = document.getElementById("next-days");

  if (currentDayContainer) {
    currentDayContainer.innerHTML = createWeatherCard(today, true);
  }

  if (nextDaysContainer) {
    nextDaysContainer.innerHTML = nextDays
      .map((day) => createWeatherCard(day, false))
      .join("");
  }
}

// Generate a weather card for the current or upcoming days
function createWeatherCard(day, isToday = false) {
  const { min, max } = day.temp2m;
  const weatherEmojis = {
    clear: "☀️",
    pcloudy: "⛅",
    mcloudy: "🌥️",
    cloudy: "☁️",
    humid: "🌫️",
    lightrain: "🌦️",
    oshower: "🌧️",
    ishower: "🌧️",
    lightsnow: "🌨️",
    rain: "🌧️",
    snow: "❄️",
    rainsnow: "🌨️🌧️",
    ts: "⛈️",
    windy: "💨",
  };

  const weatherDescriptions = {
    clear: "CLEAR",
    pcloudy: "PARTLY CLOUDY",
    mcloudy: "CLOUDY",
    cloudy: "OVERCAST",
    humid: "MISTY",
    lightrain: "LIGHT RAIN",
    oshower: "OCCASIONAL SHOWERS",
    ishower: "ISOLATED SHOWERS",
    lightsnow: "LIGHT SNOW",
    rain: "RAIN",
    snow: "SNOW",
    rainsnow: "SLEET",
    ts: "THUNDERSTORM",
    windy: "WINDY",
  };

  const weatherDesc = weatherDescriptions[day.weather] || day.weather;

  return `
        <div class="weather-card ${isToday ? "highlight" : ""}"
        aria-label="Weather forecast for ${formatDate(day.date)}${
    isToday ? ", today" : ""
  }">
            <h3 class="weather-date">${formatDate(day.date)}</h3>
            <p class="weather-icon" aria-hidden="true">${
              weatherEmojis[day.weather] || "🌍"
            }</p>
            <p class="weather-description">${weatherDesc}</p>
            <h4>Temperatures</h4>
            <p>Min: <span class="temp" data-celsius="${min}" data-fahrenheit="${toFahrenheit(
    min
  )}" aria-label="Minimum temperature: ${min} degrees Celsius">${min}°C</span></p>
            <p>Max: <span class="temp" data-celsius="${max}" data-fahrenheit="${toFahrenheit(
    max
  )}" aria-label="Maximum temperature: ${max} degrees Celsius">${max}°C</span></p>
        </div>`;
}

// Convert °C to °F
const toFahrenheit = (celsius) => Math.round((celsius * 9) / 5 + 32);

// Format the date
function formatDate(dateValue) {
  // Convert number to string
  const dateString = String(dateValue);

  try {
    const year = parseInt(dateString.slice(0, 4));
    const month = parseInt(dateString.slice(4, 6)) - 1;
    const day = parseInt(dateString.slice(6, 8));
    return new Date(year, month, day).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date :", error);
    return "Invalid date";
  }
}

// Toggle between Celsius and Fahrenheit
document.getElementById("toggle-temp").addEventListener("click", function () {
  const temps = document.querySelectorAll(".temp");
  const isCurrentlyCelsius = temps[0]?.textContent.includes("°C");

  isCelsius = !isCurrentlyCelsius;

  temps.forEach((temp) => {
    const value = isCurrentlyCelsius
      ? temp.dataset.fahrenheit
      : temp.dataset.celsius;
    const unit = isCurrentlyCelsius ? "Fahrenheit" : "Celsius";

    temp.textContent = isCurrentlyCelsius ? `${value}°F` : `${value}°C`;

    temp.setAttribute("aria-label", `Temperature: ${value} degrees ${unit}`);
  });

  this.textContent = isCurrentlyCelsius ? "Show in °C" : "Show in °F";
  this.setAttribute("aria-pressed", isCurrentlyCelsius); // Update the aria-pressed attribute

  if (lastCityVisited) {
    const selected = customSelect.querySelector(".selected");
    const options = document.querySelectorAll(".option");
    const cityOption = Array.from(options).find(
      (opt) => opt.textContent === selected.textContent
    );
    if (cityOption) {
      saveUserPreferences(
        selected.textContent,
        cityOption.dataset.lat,
        cityOption.dataset.lon
      );
    }
  }
});

// Initialization of the application
document.addEventListener("DOMContentLoaded", () => {
  loadCityCoordinates().then(() => {
    const savedCoords = loadUserPreferences();

    if (savedCoords && savedCoords.lat && savedCoords.lon) {
      const selected = customSelect.querySelector(".selected");
      if (selected && lastCityVisited) {
        selected.textContent = lastCityVisited;
      }

      fetchWeatherData(savedCoords.lat, savedCoords.lon);
    }
  });
});
