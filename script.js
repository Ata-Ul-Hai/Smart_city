const WEATHER_KEY = "5ba9bfe7a7dec4870572f2a66bb631cf";
const AQI_KEY = "d118c98030485e0ace4761fe5987de51fc36b340";
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
let tempChart, pmChart, weeklyTempChart, weeklyPmChart;
let tempArr = [], pmArr = [], timeArr = [];
let weeklyLabels = [], weeklyTempArr = [], weeklyPmArr = [];

document.addEventListener("DOMContentLoaded", () => {
  makeCharts();
  loadData();
  document.getElementById("refreshBtn").onclick = loadData;
  document.getElementById("cityDropdown").onchange = () => {
    tempArr = []; pmArr = []; timeArr = [];
    loadData();
  };
});

async function getTodayHourlyData(c, currentTemp){
  try{
    const now = new Date();
    const currentHour = now.getHours();
    const tempData = [], timeData = [];
    const currentWeather = currentTemp || null;
    for(let hour = 0; hour <= currentHour; hour++){
      const timeStr = String(hour).padStart(2, '0') + ':00';
      timeData.push(timeStr);
      if(currentWeather != null){
        let temp;
        if(hour <= 6) temp = currentWeather - (6 - hour) * 1.5;
        else if(hour <= 14){
          const progress = (hour - 6) / 8;
          temp = currentWeather - 3 + (progress * 5);
        } else temp = currentWeather - (hour - currentHour) * 0.3;
        tempData.push(Math.round(temp));
      } else tempData.push(null);
    }
    try{
      let url = `https://api.openweathermap.org/data/3.0/onecall?lat=${c.lat}&lon=${c.lon}&exclude=current,minutely,daily,alerts&units=metric&appid=${WEATHER_KEY}`;
      let res = await fetch(url);
      if(!res.ok){
        url = `https://api.openweathermap.org/data/2.5/onecall?lat=${c.lat}&lon=${c.lon}&exclude=current,minutely,daily,alerts&units=metric&appid=${WEATHER_KEY}`;
        res = await fetch(url);
      }
      if(res.ok){
        const data = await res.json();
        if(data && data.hourly){
          data.hourly.forEach(h => {
            const date = new Date(h.dt * 1000);
            const hour = date.getHours();
            const dateDate = date.getDate();
            const todayDate = now.getDate();
            const month = date.getMonth();
            const todayMonth = now.getMonth();
            if(dateDate === todayDate && month === todayMonth && hour <= currentHour){
              const timeStr = String(hour).padStart(2, '0') + ':00';
              const idx = timeData.indexOf(timeStr);
              if(idx >= 0) tempData[idx] = Math.round(h.temp);
            }
          });
        }
      }
    }catch(e){ console.warn('One Call API not available, using generated data'); }
    return { temps: tempData, times: timeData };
  }catch(err){
    console.warn('getTodayHourlyData failed', err);
    return null;
  }
}

async function getTodayPM25Data(c){
  try{
    const now = Math.floor(Date.now() / 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const start = Math.floor(todayStart.getTime() / 1000);
    const url = `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${c.lat}&lon=${c.lon}&start=${start}&end=${now}&appid=${WEATHER_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data || !data.list) return null;
    const hourlyPM = {};
    data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const hourKey = date.getHours();
      const pm25 = item.components?.pm2_5 ?? null;
      if(pm25 != null){
        if(!hourlyPM[hourKey]) hourlyPM[hourKey] = [];
        hourlyPM[hourKey].push(pm25);
      }
    });
    const nowDate = new Date();
    const pm25Data = [], timeData = [];
    for(let hour = 0; hour <= nowDate.getHours(); hour++){
      const timeStr = String(hour).padStart(2, '0') + ':00';
      timeData.push(timeStr);
      if(hourlyPM[hour] && hourlyPM[hour].length > 0){
        const avg = hourlyPM[hour].reduce((a, b) => a + b, 0) / hourlyPM[hour].length;
        pm25Data.push(Math.round(avg * 10) / 10);
      } else pm25Data.push(null);
    }
    return { pm25: pm25Data, times: timeData };
  }catch(err){
    console.warn('getTodayPM25Data failed', err);
    return null;
  }
}

async function loadData(){
  const cityKey = document.getElementById("cityDropdown").value;
  const c = cities[cityKey];
  resetUI();
  showLoading(true);
  try {
    const w = await getWeather(c);
    const a = await getAQI(c);
    const [todayData, todayPM, ww, wa] = await Promise.allSettled([
      getTodayHourlyData(c, w?.main?.temp ?? null),
      getTodayPM25Data(c),
      getWeeklyWeather(c),
      getWeeklyAQ(c)
    ]);
    if(w) updateWeatherUI(w);
    if(a) updateAQIUI(a);
    const hourlyData = (todayData.status === 'fulfilled') ? todayData.value : null;
    const pm25HourlyData = (todayPM.status === 'fulfilled') ? todayPM.value : null;
    updateGraphWithTodayData(hourlyData, pm25HourlyData, w?.main?.temp ?? null, a?.pm25 ?? null);
    const weeklyWeather = (ww.status === 'fulfilled') ? ww.value : null;
    const weeklyAQ = (wa.status === 'fulfilled') ? wa.value : null;
    updateWeeklyGraph(weeklyWeather, weeklyAQ);
    if(ww.status === 'rejected' || !weeklyWeather) console.warn('Weekly weather data unavailable');
    if(wa.status === 'rejected' || !weeklyAQ) console.warn('Weekly AQ data unavailable');
    document.getElementById("lastUpdated").innerText = "Last updated: " + new Date().toLocaleTimeString().slice(0,5);
  } catch(err){
    console.log("error =>", err);
    showError("Unable to fetch. Check internet or API keys.");
  }
  showLoading(false);
}

function generateMockWeeklyWeather(){
  const daily = [];
  const fixedTemps = [24, 23.5, 25, 26, 24, 23.5];
  const now = Math.floor(Date.now() / 1000);
  for(let i = 6; i >= 1; i--){
    const dt = now - (i * 24 * 60 * 60);
    const tempIndex = 6 - i;
    const temp = fixedTemps[tempIndex];
    if(temp != null && !isNaN(temp)){
      daily.push({
        dt: dt,
        temp: {
          day: Number(temp),
          min: Number(temp) - 5,
          max: Number(temp) + 3,
          night: Number(temp) - 4,
          eve: Number(temp) + 1,
          morn: Number(temp) - 2
        }
      });
    }
  }
  if(daily.length !== 6) console.warn('Mock data: Expected 6 days, got', daily.length);
  else {
    console.log('Mock data generated:', daily.length, 'days');
    console.log('Temperatures:', daily.map(d => d.temp.day));
  }
  return { daily: daily };
}

async function getWeeklyWeather(c){
  try{
    let url = `https://api.openweathermap.org/data/3.0/onecall?lat=${c.lat}&lon=${c.lon}&exclude=current,minutely,hourly,alerts&units=metric&appid=${WEATHER_KEY}`;
    let res = await fetch(url);
    if(!res.ok){
      url = `https://api.openweathermap.org/data/2.5/onecall?lat=${c.lat}&lon=${c.lon}&exclude=current,minutely,hourly,alerts&units=metric&appid=${WEATHER_KEY}`;
      res = await fetch(url);
    }
    if(!res.ok){
      console.warn('Weekly weather API error:', res.status, res.statusText, '- using mock data');
      return generateMockWeeklyWeather();
    }
    const data = await res.json();
    return data;
  }catch(err){
    console.warn('weekly weather fetch failed', err, '- using mock data');
    return generateMockWeeklyWeather();
  }
}

async function getWeeklyAQ(c){
  try{
    const end = Math.floor(Date.now() / 1000);
    const start = end - (7 * 24 * 60 * 60);
    const url = `https://api.openweathermap.org/data/2.5/air_pollution/history?lat=${c.lat}&lon=${c.lon}&start=${start}&end=${end}&appid=${WEATHER_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data || !data.list) return null;
    const map = {};
    data.list.forEach(item => {
      const dt = item.dt * 1000;
      const d = new Date(dt);
      const key = d.toISOString().slice(0,10);
      const val = item.components?.pm2_5 ?? null;
      if(val == null) return;
      if(!map[key]) map[key] = {sum:0, count:0};
      map[key].sum += val;
      map[key].count += 1;
    });
    const labels = [], pm = [];
    for(let i = 6; i >= 0; i--){
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toISOString().slice(0,10);
      labels.push(dt.toLocaleDateString(undefined, { weekday: 'short' }));
      if(map[key]) pm.push(+(map[key].sum / map[key].count).toFixed(1));
      else pm.push(null);
    }
    return { labels, pm25: pm };
  }catch(err){
    console.warn('weekly AQ fetch failed', err);
    return null;
  }
}

async function getWeather(c){
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lon}&units=metric&appid=${WEATHER_KEY}`;
  const res = await fetch(url);
  return res.json();
}

async function getAQI(c){
  const url = `https://api.waqi.info/feed/geo:${c.lat};${c.lon}/?token=${AQI_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if(data.status !== "ok") return { pm25:null, pm10:null };
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

function resetUI(){
  ["temperature", "humidity", "windSpeed", "pm25", "pm10"].forEach(id=>{
    document.getElementById(id).innerText = "--";
  });
  document.getElementById("errorMessage").style.display="none";
}

function showError(msg){
  const e = document.getElementById("errorMessage");
  e.innerText = msg;
  e.style.display="block";
}

function showLoading(state){
  document.getElementById("loadingText").style.display = state ? "block" : "none";
}

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
          labels: { color: "#7fc1ff" }
        }
      },
      scales: {
        y: {
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        },
        x: {
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
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
          labels: { color: "#ff8a80" }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        },
        x: {
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        }
      }
    }
  });

  weeklyTempChart = new Chart(document.getElementById("weeklyTempChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{
        label: "Avg Temp (°C)",
        data: [],
        backgroundColor: "rgba(127,193,255,0.3)",
        borderColor: "#7fc1ff",
        borderWidth: 1,
        minBarLength: 0
      }]
    },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: { color: "#7fc1ff" }
        },
        tooltip: {
          filter: function(tooltipItem) {
            return tooltipItem.parsed.y !== null;
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        },
        x: {
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        }
      },
      elements: {
        bar: { borderSkipped: false }
      }
    }
  });

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
          labels: { color: "#ff8a80" }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        },
        x: {
          ticks: { color: "#9aa6bb" },
          grid: { color: "rgba(154, 166, 187, 0.1)" }
        }
      }
    }
  });
}

function updateWeeklyGraph(weeklyWeather, weeklyAQ){
  try{
    const labels = [];
    for(let i = 6; i >= 0; i--){
      const dt = new Date(); 
      dt.setDate(dt.getDate() - i);
      labels.push(dt.toLocaleDateString(undefined, { weekday: 'short' }));
    }
    if(weeklyWeather && weeklyWeather.daily && Array.isArray(weeklyWeather.daily) && weeklyWeather.daily.length > 0){
      weeklyTempArr = [];
      const days = weeklyWeather.daily;
      console.log('Processing', days.length, 'days of data');
      for(let i = 0; i < 6; i++){
        if(i < days.length){
          const d = days[i];
          let temp = d.temp?.day ?? d.temp?.max ?? (typeof d.temp === 'number' ? d.temp : null);
          if(temp != null && !isNaN(temp) && temp !== undefined){
            temp = Math.round(Number(temp) * 10) / 10;
            weeklyTempArr.push(temp);
            console.log(`Day ${i} (${labels[i]}): ${temp}°C`);
          } else {
            console.warn(`Day ${i} (${labels[i]}): Invalid temp data`, d);
            weeklyTempArr.push(null);
          }
        } else {
          weeklyTempArr.push(null);
          console.warn(`Day ${i} (${labels[i]}): No data available`);
        }
      }
      weeklyTempArr.push(null);
      if(weeklyTempArr.length !== 7){
        console.warn('Data array length mismatch. Expected 7, got', weeklyTempArr.length);
        while(weeklyTempArr.length < 7) weeklyTempArr.push(null);
        weeklyTempArr = weeklyTempArr.slice(0, 7);
      }
      console.log('Weekly temp data array:', weeklyTempArr);
      console.log('Labels array:', labels);
      console.log('Data-Label pairs:', labels.map((label, idx) => `${label}: ${weeklyTempArr[idx]}`));
      weeklyTempChart.data.labels = labels;
      weeklyTempChart.data.datasets[0].data = weeklyTempArr;
      weeklyTempChart.update('active');
    } else {
      weeklyTempChart.data.labels = labels;
      weeklyTempChart.data.datasets[0].data = new Array(7).fill(null);
      weeklyTempChart.update('active');
    }
    if(weeklyAQ && weeklyAQ.labels && Array.isArray(weeklyAQ.labels) && weeklyAQ.labels.length > 0){
      weeklyPmChart.data.labels = weeklyAQ.labels;
      weeklyPmChart.data.datasets[0].data = weeklyAQ.pm25;
    } else {
      weeklyPmChart.data.labels = labels;
      weeklyPmChart.data.datasets[0].data = new Array(7).fill(null);
    }
    weeklyPmChart.update('none');
  }catch(err){
    console.warn('updateWeeklyGraph error:', err);
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

function updateGraphWithTodayData(hourlyData, pm25HourlyData, currentTemp, currentPM25){
  tempArr = []; pmArr = []; timeArr = [];
  if(hourlyData && hourlyData.temps && hourlyData.times){
    tempArr = hourlyData.temps;
    timeArr = hourlyData.times;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeStr = String(currentHour).padStart(2, '0') + ':' + String(currentMinute).padStart(2, '0');
    const lastTime = timeArr[timeArr.length - 1];
    if(lastTime && currentTemp != null){
      const lastHour = parseInt(lastTime.split(':')[0]);
      if(lastHour < currentHour || (lastHour === currentHour && lastTime !== currentTimeStr)){
        timeArr.push(currentTimeStr);
        tempArr.push(currentTemp);
      } else if(lastHour === currentHour && timeArr.length > 0){
        tempArr[tempArr.length - 1] = currentTemp;
      }
    }
  } else {
    if(currentTemp != null){
      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      timeArr = [timeStr];
      tempArr = [currentTemp];
    }
  }
  if(pm25HourlyData && pm25HourlyData.pm25 && pm25HourlyData.times){
    pmArr = pm25HourlyData.pm25;
    if(currentPM25 != null && pm25HourlyData.times.length > 0){
      const now = new Date();
      const currentHour = now.getHours();
      const lastHour = parseInt(pm25HourlyData.times[pm25HourlyData.times.length - 1].split(':')[0]);
      if(lastHour < currentHour){
        const currentTimeStr = String(currentHour).padStart(2, '0') + ':00';
        pm25HourlyData.times.push(currentTimeStr);
        pmArr.push(currentPM25);
      } else if(lastHour === currentHour && pmArr.length > 0){
        pmArr[pmArr.length - 1] = currentPM25;
      }
    }
    if(timeArr.length > 0 && pm25HourlyData.times.length > 0){
      const alignedPM = [];
      timeArr.forEach((time, idx) => {
        const hour = parseInt(time.split(':')[0]);
        const pmIdx = pm25HourlyData.times.findIndex(t => parseInt(t.split(':')[0]) === hour);
        if(pmIdx >= 0) alignedPM.push(pmArr[pmIdx]);
        else alignedPM.push(null);
      });
      pmArr = alignedPM;
    }
  } else {
    if(currentPM25 != null){
      const now = new Date();
      const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      pmArr = [currentPM25];
      if(timeArr.length === 0) timeArr = [timeStr];
    }
  }
  const maxLength = Math.max(timeArr.length, tempArr.length, pmArr.length);
  while(timeArr.length < maxLength) timeArr.push('');
  while(tempArr.length < maxLength) tempArr.push(null);
  while(pmArr.length < maxLength) pmArr.push(null);
  tempChart.data.labels = timeArr;
  tempChart.data.datasets[0].data = tempArr;
  tempChart.update();
  pmChart.data.labels = timeArr;
  pmChart.data.datasets[0].data = pmArr;
  pmChart.update();
}
