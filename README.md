# Smart City Data Dashboard
**A Real-Time Weather + Air Quality Monitoring System**

A modern, interactive dashboard that fetches **live weather + pollution data** for supported global cities using open-source APIs. Built for open-source evaluations and hackathon presentations.

---

## 🚀 Features

- **Real-time Weather Data**
  - Temperature  
  - Humidity  
  - Wind Speed  

- **Real-time Air Quality (WAQI API)**
  - PM2.5  
  - PM10  

- **Visualizations (Chart.js)**
  - Live Temperature Line Chart  
  - Live PM2.5 Line Chart  
  - Weekly PM2.5 Bar Chart  

- **Interactive Dashboard**
  - City Selector (Delhi, Mumbai, Tokyo, New York, etc.)  
  - Auto Refresh + Manual Refresh  
  - Loading Animation  
  - Last Updated Timestamp  
  - Error Handling  
  - Mobile Responsive UI (Dark + Light theme)

---

## 🎯 Objectives

- Fetch real-time *weather* and *air-quality* data  
- Display the data cleanly in UI cards  
- Visualize trends with line + bar charts  
- Provide weekly PM2.5 insights  
- Build a fast, responsive dashboard

---

## 🏗 Architecture

1. **City Selection**  
   User selects a city → dashboard extracts latitude & longitude.

2. **Live API Calls**  
   - OpenWeatherMap Weather API → temp, humidity, wind  
   - WAQI Real-Time Air Quality API → PM2.5, PM10

3. **Weekly Data**  
   - OpenWeatherMap Air Pollution History API → PM2.5 values for last 7 days  
   - Group by day → average → display in weekly bar chart

4. **UI Updates**  
   - Weather & AQI cards refresh  
   - Charts redraw with new data points  
   - Last-updated timestamp refreshes

---

## 📁 Project Structure
smart-city-dashboard
<br>│── index.html
<br>│── style.css
<br>│── script.js

---

## 🧰 Tech Stack

- **Frontend:** HTML, CSS, JavaScript  
- **Visualization:** Chart.js  
- **API Testing:** Postman  
- **Version Control:** GitHub

---

## 🌐 APIs Used

| Purpose | API |
|--------:|-----|
| Real-Time Weather | OpenWeatherMap Weather API — https://openweathermap.org/current |
| Air Pollution History | OpenWeatherMap Air Pollution History API — https://openweathermap.org/api/air-pollution |
| Real-Time PM2.5 / PM10 | WAQI API — https://aqicn.org/api/ |

---

## 🔑 Setup

1. Clone the repo:
git clone https://github.com/your-username/smart-city-dashboard.git
<br>cd smart-city-dashboard
2. Open index.html in a browser (no backend required).
3. Add API keys in script.js:

- Live Weather
<br> https://api.openweathermap.org/data/2.5/weather?lat=28.6139&lon=77.2090&units=metric&appid=YOUR_KEY
- WAQI Live AQI
<br> https://api.waqi.info/feed/geo:28.6139;77.2090/?token=YOUR_TOKEN
## 📊 Visualizations

- Temperature Line Chart (live)
- PM2.5 Line Chart (live)
- Weekly PM2.5 Bar Chart

All charts implemented with Chart.js.

## ✅ UX Details

- City Selector: Dropdown with preset cities (latitude & longitude mapping).
- Auto Refresh: Interval-based polling (configurable).
- Manual Refresh: Button to force update.
- Loading State: Spinner/placeholder while fetching.
- Error Handling: User-friendly messages on failure.
- Last Updated: Human-readable timestamp on every update.
- Responsive Design: Works on mobile and desktop; dark/light theme toggle.

## 👨‍💻 Authors

- Ata Ul Hai
- Varun
- Dev
- Jamal

## 📎 License & Contribution

- Feel free to fork and improve.
- Add issues or PRs on GitHub for fixes/features.
