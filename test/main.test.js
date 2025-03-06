const { expect } = require("chai");
const { JSDOM } = require("jsdom");

describe("Weather Forecast Application", function () {
  // Variables used in tests
  let window, document, localStorage;
  let isCelsius, lastCityVisited;

  // Functions to test
  let handleError, saveUserPreferences, loadUserPreferences;
  let formatDate, toFahrenheit, createWeatherCard;
  let fetchWeatherData;

  beforeEach(function () {
    // DOM configuration for tests
    const dom = new JSDOM(
      `
      <!DOCTYPE html>
      <html>
      <body>
        <div id="loader"></div>
        <div class="custom-select">
          <div class="selected">Select a city</div>
          <div class="options-container"></div>
        </div>
        <div id="current-day"></div>
        <div id="next-days"></div>
        <button id="toggle-temp">Show in °F</button>
      </body>
      </html>
    `,
      { url: "http://localhost" }
    );

    window = dom.window;
    document = window.document;

    // LocalStorage simulation
    localStorage = {
      storage: {},
      getItem: function (key) {
        return this.storage[key] || null;
      },
      setItem: function (key, value) {
        this.storage[key] = value;
      },
    };

    // State variables configuration
    isCelsius = true;
    lastCityVisited = null;

    // Implementation of functions for testing
    handleError = function (message, error) {
      console.error(message, error || "");
      const currentDayContainer = document.getElementById("current-day");
      if (currentDayContainer) {
        currentDayContainer.innerHTML = `<p class="error-message">${message}</p>`;
      }
    };

    saveUserPreferences = function (city, lat, lon) {
      try {
        const userPreferences = {
          lastCityVisited: city,
          coordinates: { lat, lon },
          temperatureUnit: isCelsius ? "Celsius" : "Fahrenheit",
          timestamp: new Date().getTime(),
        };
        localStorage.setItem(
          "userPreferences",
          JSON.stringify(userPreferences)
        );
      } catch (error) {
        handleError("Failed to save user preferences.", error);
      }
    };

    loadUserPreferences = function () {
      try {
        const stored = localStorage.getItem("userPreferences");
        if (stored) {
          const userPreferences = JSON.parse(stored);
          const now = new Date().getTime();
          const isRecent =
            now - userPreferences.timestamp < 24 * 60 * 60 * 1000;
          if (isRecent) {
            return userPreferences;
          }
        }
      } catch (error) {
        handleError("Failed to load user preferences.", error);
      }
      return null;
    };

    formatDate = function (dateValue) {
      const dateString = String(dateValue);
      const year = parseInt(dateString.slice(0, 4));
      const month = parseInt(dateString.slice(4, 6)) - 1;
      const day = parseInt(dateString.slice(6, 8));
      return new Date(year, month, day).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
    };

    toFahrenheit = function (celsius) {
      return Math.round((celsius * 9) / 5 + 32);
    };

    createWeatherCard = function (date, weather, minTemp, maxTemp) {
      const formattedDate = formatDate(date);
      const weatherIcon = weather.toLowerCase();
      const displayUnit = isCelsius ? "°C" : "°F";
      const min = isCelsius ? minTemp : toFahrenheit(minTemp);
      const max = isCelsius ? maxTemp : toFahrenheit(maxTemp);

      return `
        <div class="weather-card">
          <h3>${formattedDate}</h3>
          <img src="img/weather-icons/${weatherIcon}.svg" alt="${weather}" class="weather-icon">
          <div class="temperature">
            <span class="min">${min}${displayUnit}</span>
            <span class="max">${max}${displayUnit}</span>
          </div>
        </div>
      `;
    };

    // API calls simulation
    global.fetch = function (url) {
      if (url.includes("weather")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              dataseries: [
                {
                  date: 20250303,
                  weather: "clear",
                  temp2m: { min: 10, max: 20 },
                },
                {
                  date: 20250304,
                  weather: "cloudy",
                  temp2m: { min: 8, max: 18 },
                },
              ],
            }),
        });
      } else if (url.includes("cities")) {
        return Promise.resolve({
          ok: true,
          text: () =>
            Promise.resolve(
              "lat,lon,city,country\n48.8566,2.3522,Paris,France\n51.5074,0.1278,London,UK"
            ),
        });
      }
      return Promise.reject(new Error("Unhandled URL in mock"));
    };

    // API calls implementation
    fetchWeatherData = async function (lat, lon) {
      const apiUrl = `https://something.com/weather?lat=${lat}&lon=${lon}`;
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch weather data");
      }
      const data = await response.json();
      return data.dataseries;
    };
  });

  // Tests of main functions

  describe("LocalStorage Management", function () {
    it("should load user preferences when they are recent", function () {
      const currentTime = new Date().getTime();
      const preferences = {
        lastCityVisited: "London",
        coordinates: { lat: 51.5074, lon: 0.1278 },
        temperatureUnit: "Celsius",
        timestamp: currentTime,
      };
      localStorage.setItem("userPreferences", JSON.stringify(preferences));

      const loadedPreferences = loadUserPreferences();

      expect(loadedPreferences).to.not.be.null;
      expect(loadedPreferences.lastCityVisited).to.equal("London");
      expect(loadedPreferences.coordinates.lat).to.equal(51.5074);
    });
  });

  describe("Date Formatting", function () {
    it("should format date correctly from YYYYMMDD format", function () {
      expect(formatDate(20250101)).to.equal("Wednesday, January 1");
      expect(formatDate(20250315)).to.equal("Saturday, March 15");
      expect(formatDate(20251225)).to.equal("Thursday, December 25");
    });
  });

  describe("Temperature Conversion", function () {
    it("should correctly convert Celsius temperatures to Fahrenheit", function () {
      expect(toFahrenheit(0)).to.equal(32);
      expect(toFahrenheit(20)).to.equal(68);
      expect(toFahrenheit(-10)).to.equal(14);
    });
  });

  describe("Weather Display", function () {
    it("should create a properly formatted weather card", function () {
      const card = createWeatherCard(20250303, "Clear", 10, 20);

      expect(card).to.include("Monday, March 3");
      expect(card).to.include("img/weather-icons/clear.svg");
      expect(card).to.include('<span class="min">10°C</span>');
      expect(card).to.include('<span class="max">20°C</span>');
    });
  });

  describe("API Data Fetching", function () {
    it("should fetch and process weather data correctly", async function () {
      const weatherData = await fetchWeatherData(48.8566, 2.3522);

      expect(weatherData).to.have.lengthOf(2);
      expect(weatherData[0].weather).to.equal("clear");
      expect(weatherData[0].temp2m.min).to.equal(10);
      expect(weatherData[1].weather).to.equal("cloudy");
    });
  });
});
