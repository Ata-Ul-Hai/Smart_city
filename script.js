// weather api key
const WEATHER_KEY = "5ba9bfe7a7dec4870572f2a66bb631cf";

// waqi key (correct token)
const AQI_KEY = "d118c98030485e0ace4761fe5987de51fc36b340";

// simple city lat lon list
const cities = {
  delhi: { lat: 28.6139, lon: 77.2090 },
  mumbai: { lat: 19.0760, lon: 72.8777 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  "new york": { lat: 40.7128, lon: -74.0060 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  london: { lat: 51.5074, lon: -0.1278 },
  dubai: { lat: 25.2048, lon: 55.2708 },
  sydney: { lat: -33.8688, lon: 151.2093 }
};

// charts data
let tempChart, pmChart, weeklyTempChart, weeklyPmChart;
let tempArr = [], pmArr = [], timeArr = [];
let weeklyLabels = [], weeklyTempArr = [], weeklyPmArr = [];

document.addEventListener("DOMContentLoaded", () => {
  makeCharts();
  loadData();
  document.getElementById("refreshBtn").onclick = loadData;
  // on city change, clear live arrays and load new city data
  document.getElementById("cityDropdown").onchange = () => {
    tempArr = [];
    pmArr = [];
    timeArr = [];
    loadData();
  };
});

// main function
async function loadData(){
  const cityKey = document.getElementById("cityDropdown").value;
  const c = cities[cityKey];

  resetUI();
  showLoading(true);

  try {
    const w = await getWeather(c);
    const a = await getAQI(c);

    // fetch weekly data (weather + PM history) in parallel
    const [ww, wa] = await Promise.allSettled([
      getWeeklyWeather(c),
      getWeeklyAQ(c)
    ]);

    if(w) updateWeatherUI(w);
    if(a) updateAQIUI(a);

    updateGraph(w?.main?.temp ?? null, a?.pm25 ?? null);

    // always update weekly graphs (even if fetch failed, so axes render)
    const weeklyWeather = (ww.status === 'fulfilled') ? ww.value : null;
    const weeklyAQ = (wa.status === 'fulfilled') ? wa.value : null;
    updateWeeklyGraph(weeklyWeather, weeklyAQ);
    
    if(ww.status === 'rejected' || !weeklyWeather) console.warn('Weekly weather data unavailable');
    if(wa.status === 'rejected' || !weeklyAQ) console.warn('Weekly AQ data unavailable');

    document.getElementById("lastUpdated").innerText =
      "Last updated: " + new Date().toLocaleTimeString().slice(0,5);

  } catch(err){
    console.log("error =>", err);
    showError("Unable to fetch. Check internet or API keys.");
  }

  showLoading(false);
}

// fetch 7-day weather forecast (One Call API 3.0)
async function getWeeklyWeather(c){
  try{
    // Try One Call API 3.0 first (new endpoint)
    let url = `https://api.openweathermap.org/data/3.0/onecall?lat=${c.lat}&lon=${c.lon}&exclude=current,minutely,hourly,alerts&units=metric&appid=${WEATHER_KEY}`;
    let res = await fetch(url);
    
    // If 3.0 fails, try 2.5 (legacy)
    if(!res.ok){
      url = `https://api.openweathermap.org/data/2.5/onecall?lat=${c.lat}&lon=${c.lon}&exclude=current,minutely,hourly,alerts&units=metric&appid=${WEATHER_KEY}`;
      res = await fetch(url);
    }
    
    if(!res.ok){
      console.warn('Weekly weather API error:', res.status, res.statusText);
      return null;
    }
    
    const data = await res.json();
    return data;
  }catch(err){
    console.warn('weekly weather fetch failed', err);
    return null;
  }
}

// fetch air pollution history for last 7 days and aggregate daily PM2.5 averages
async function getWeeklyAQ(c){
  try{
    const end = Math.floor(Date.now() / 1000);
    const start = end - (7 * 24 * 60 * 60);
    const url = `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${c.lat}&lon=${c.lon}&start=${start}&end=${end}&appid=${WEATHER_KEY}`;
    const res = await fetch(url);
    const data = await res.json();

    if(!data || !data.list) return null;

    // aggregate by local date
    const map = {};
    data.list.forEach(item => {
      const dt = item.dt * 1000;
      const d = new Date(dt);
      const key = d.toISOString().slice(0,10); // YYYY-MM-DD
      const val = item.components?.pm2_5 ?? null;
      if(val == null) return;
      if(!map[key]) map[key] = {sum:0, count:0};
      map[key].sum += val;
      map[key].count += 1;
    });

    // build arrays for the last 7 days in chronological order
    const labels = [];
    const pm = [];
    for(let i = 6; i >= 0; i--){
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0,10);
      labels.push(dt.toLocaleDateString(undefined, { weekday: 'short' }));
      if(map[key]){
        pm.push(+(map[key].sum / map[key].count).toFixed(1));
      } else {
        pm.push(null);
      }
    }

    return { labels, pm25: pm };
  }catch(err){
    console.warn('weekly AQ fetch failed', err);
    return null;
  }
}

async function getWeather(c){
  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}&units=metric&appid=${WEATHER_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getAQI(c){
  const url =
    `https://api.waqi.info/feed/geo:${c.lat};${c.lon}/?token=${AQI_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  if(data.status !== "ok")
    return { pm25:null, pm10:null };

  return {
    pm25: data.data.iaqi?.pm25?.v ?? null,
    pm10: data.data.iaqi?.pm10?.v ?? null
  };
}

function updateWeatherUI(w){
  document.getElementById("temperature").innerText = Math.round(w.main.temp);
  document.getElementById("humidity").innerText = w.main.humidity;
  document.getElementById("windSpeed").innerText = w.wind.speed.toFixed(1);
}

function updateAQIUI(a){
  document.getElementById("pm25").innerText = a.pm25 ?? "--";
  document.getElementById("pm10").innerText = a.pm10 ?? "--";
}

// reset UI
function resetUI(){
  ["temperature", "humidity", "windSpeed", "pm25", "pm10"].forEach(id=>{
    document.getElementById(id).innerText = "--";
  });
  document.getElementById("errorMessage").style.display="none";
}

// show error
function showError(msg){
  const e = document.getElementById("errorMessage");
  e.innerText = msg;
  e.style.display="block";
}

// loading
function showLoading(state){
  document.getElementById("loadingText").style.display = state ? "block" : "none";
}

// create charts
function makeCharts(){
  tempChart = new Chart(document.getElementById("tempChart"), {
    type:"line",
    data:{
      labels:[],
      datasets:[{
        label:"Temp (°C)",
        data:[],
        borderColor:"#7fc1ff",
        borderWidth:3,
        pointRadius:4,
        pointBackgroundColor:"#7fc1ff",
        tension:0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#7fc1ff"
          }
        }
      },
      scales: {
        y: {
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        },
        x: {
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        }
      }
    }
  });

  pmChart = new Chart(document.getElementById("pm25Chart"), {
    type:"line",
    data:{
      labels:[],
      datasets:[{
        label:"PM2.5",
        data:[],
        borderColor:"#ff8a80",
        borderWidth:3,
        pointRadius:4,
        pointBackgroundColor:"#ff8a80",
        tension:0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "#ff8a80"
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        },
        x: {
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        }
      }
    }
  });

  // weekly temperature chart
  weeklyTempChart = new Chart(document.getElementById("weeklyTempChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Avg Temp (°C)",
        data: [],
        backgroundColor: "rgba(127,193,255,0.3)",
        borderColor: "#7fc1ff",
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#7fc1ff"
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        },
        x: {
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        }
      }
    }
  });

  // weekly PM2.5 chart
  weeklyPmChart = new Chart(document.getElementById("weeklyPmChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "PM2.5 (µg/m³)",
        data: [],
        backgroundColor: "rgba(255,138,128,0.28)",
        borderColor: "#ff8a80",
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "#ff8a80"
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        },
        x: {
          ticks: {
            color: "#9aa6bb"
          },
          grid: {
            color: "rgba(154, 166, 187, 0.1)"
          }
        }
      }
    }
  });
}

// update weekly graphs
function updateWeeklyGraph(weeklyWeather, weeklyAQ){
  try{
    // always build 7-day labels so axes render even if data is missing
    const labels = [];
    for(let i = 6; i >= 0; i--){
      const dt = new Date(); 
      dt.setDate(dt.getDate() - i);
      labels.push(dt.toLocaleDateString(undefined, { weekday: 'short' }));
    }

    // weeklyWeather: result from One Call - use daily array
    if(weeklyWeather && weeklyWeather.daily && Array.isArray(weeklyWeather.daily) && weeklyWeather.daily.length > 0){
      const days = weeklyWeather.daily.slice(0,7);
      weeklyTempArr = days.map(d => {
        // Handle different possible temperature structures
        const temp = d.temp?.day ?? d.temp?.max ?? d.temp;
        return temp ? Math.round(temp) : null;
      });
      
      // Ensure we have exactly 7 values (pad with null if needed)
      while(weeklyTempArr.length < 7) weeklyTempArr.push(null);
      
      weeklyTempChart.data.labels = labels;
      weeklyTempChart.data.datasets[0].data = weeklyTempArr.slice(0, 7);
    } else {
      // no data: show empty bars with labels
      weeklyTempChart.data.labels = labels;
      weeklyTempChart.data.datasets[0].data = new Array(7).fill(null);
    }
    weeklyTempChart.update('none'); // 'none' mode for smoother updates

    // weeklyAQ: { labels:[], pm25:[] }
    if(weeklyAQ && weeklyAQ.labels && Array.isArray(weeklyAQ.labels) && weeklyAQ.labels.length > 0){
      weeklyPmChart.data.labels = weeklyAQ.labels;
      weeklyPmChart.data.datasets[0].data = weeklyAQ.pm25;
    } else {
      // no data: show empty bars with default labels
      weeklyPmChart.data.labels = labels;
      weeklyPmChart.data.datasets[0].data = new Array(7).fill(null);
    }
    weeklyPmChart.update('none'); // 'none' mode for smoother updates
  }catch(err){
    console.warn('updateWeeklyGraph error:', err);
    // On error, still set labels so chart structure is visible
    const labels = [];
    for(let i = 6; i >= 0; i--){
      const dt = new Date(); 
      dt.setDate(dt.getDate() - i);
      labels.push(dt.toLocaleDateString(undefined, { weekday: 'short' }));
    }
    weeklyTempChart.data.labels = labels;
    weeklyTempChart.data.datasets[0].data = new Array(7).fill(null);
    weeklyTempChart.update('none');
    weeklyPmChart.data.labels = labels;
    weeklyPmChart.data.datasets[0].data = new Array(7).fill(null);
    weeklyPmChart.update('none');
  }
}

// update graphs
function updateGraph(temp,pm25){
  const t = new Date().toLocaleTimeString().slice(0,5);

  tempArr.push(temp);
  pmArr.push(pm25);
  timeArr.push(t);

  if(tempArr.length > 10){
    tempArr.shift(); pmArr.shift(); timeArr.shift();
  }

  tempChart.data.labels = timeArr;
  tempChart.data.datasets[0].data = tempArr;
  tempChart.update();

  pmChart.data.labels = timeArr;
  pmChart.data.datasets[0].data = pmArr;
  pmChart.update();
}
