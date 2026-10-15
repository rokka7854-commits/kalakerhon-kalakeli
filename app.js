const state = { lat: 60.1699, lon: 24.9384, name: "Helsinki", timezone: "Europe/Helsinki", selectedDate: null };
const $ = (id) => document.getElementById(id);
let deferredPrompt;

const weatherCodes = { 0:["Selkeää","☀"],1:["Enimmäkseen selkeää","◔"],2:["Puolipilvistä","◒"],3:["Pilvistä","☁"],45:["Sumua","≋"],48:["Huurresumua","≋"],51:["Tihkusadetta","☂"],53:["Tihkusadetta","☂"],55:["Tihkusadetta","☂"],61:["Vesisadetta","☂"],63:["Vesisadetta","☂"],65:["Vesisadetta","☂"],71:["Lumikuuroja","❄"],73:["Lumikuuroja","❄"],75:["Lumisadetta","❄"],80:["Sadekuuroja","☂"],81:["Sadekuuroja","☂"],82:["Sadekuuroja","☂"],95:["Ukkosta","ϟ"],96:["Ukkoskuuroja","ϟ"],99:["Ukkoskuuroja","ϟ"] };

function dateText(dateKey) { return new Intl.DateTimeFormat("fi-FI", { weekday:"long", day:"numeric", month:"long", timeZone:state.timezone }).format(new Date(`${dateKey}T12:00:00`)); }
function degToDirection(deg) { const dirs=["P","PPKO","KO","IKKO","I","ILKO","L","LLKO","L","LLKA","LÄ","ELÄ","E","ELO","LO","LLO","PLO"]; return dirs[Math.round(deg/22.5)%16]; }
function pad(v) { return String(v).padStart(2,"0"); }
function average(values) { const usable=values.filter(Number.isFinite); return usable.length ? usable.reduce((sum,value)=>sum+value,0)/usable.length : null; }

function lunarAge(date) { const known=Date.UTC(2000,0,6,18,14); return ((date.getTime()-known)/86400000%29.530588853+29.530588853)%29.530588853; }
function moonInfo(date) { const age=lunarAge(date), pct=(1-Math.cos(2*Math.PI*age/29.530588853))/2; let label="Kasvava sirppi", icon="☾"; if(age<1.85||age>27.68){label="Uusikuu";icon="●";} else if(age<7.38){label="Kasvava kuu";icon="◔";} else if(age<9.23){label="Ensimmäinen neljännes";icon="◐";} else if(age<14.77){label="Kasvava kuu";icon="◕";} else if(age<16.61){label="Täysikuu";icon="○";} else if(age<22.15){label="Vähenevä kuu";icon="◕";} else if(age<24){label="Viimeinen neljännes";icon="◐";} else {label="Vähenevä sirppi";icon="◔";} return { age, pct, label, icon }; }
function calculateFishing(date) {
  const moon=moonInfo(date), phaseBoost=Math.abs(Math.cos(Math.PI*moon.age/14.765));
  const seasonal=0.35+0.25*Math.cos((date.getUTCMonth()-5)*Math.PI/6);
  const score=Math.min(5,Math.max(1,Math.round(2.1+1.65*phaseBoost+seasonal)));
  const labels=["Heikko","Kohtalainen","Hyvä","Erittäin hyvä","Erinomainen"];
  const base=(moon.age/29.530588853*24 + state.lon/15)%24;
  const range=(hour)=>`${pad(Math.floor((hour+24)%24))}.${pad(Math.round(((hour+24)%1)*60))}–${pad(Math.floor((hour+1.7+24)%24))}.${pad(Math.round((((hour+1.7)+24)%1)*60))}`;
  $("fishScore").textContent=score+"/5"; $("fishLabel").textContent=labels[score-1]+" kalakeli";
  $("fishExplanation").textContent=`${moon.label} ja päivän valo tukevat aktiivisimpia hetkiä.`;
  $("morningBite").textContent=range(base-4.5); $("eveningBite").textContent=range(base+7.5);
  $("fishScale").innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<score?"active":""}"></span>`).join("");
  $("moonPhase").textContent=`${moon.label} ${Math.round(moon.pct*100)} %`; $("moonIcon").textContent=moon.icon;
}

function setDateOptions(data) {
  const input=$("forecastDate"), dates=data.daily.time;
  if(!state.selectedDate || !dates.includes(state.selectedDate)) state.selectedDate=dates[0];
  input.min=dates[0]; input.max=dates[dates.length-1]; input.value=state.selectedDate;
}

function renderAstronomy(data, dayIndex) {
  const dateKey=state.selectedDate;
  $("todayDate").textContent=dateText(dateKey);
  $("fishEyebrow").textContent=dayIndex===0 ? "Tänään" : "Valittu päivä";
  calculateFishing(new Date(`${dateKey}T12:00:00Z`));
  $("sunrise").textContent=data.daily.sunrise[dayIndex]?.slice(11) || "–";
  $("sunset").textContent=data.daily.sunset[dayIndex]?.slice(11) || "–";
}

function dayHourIndices(data, dateKey) { return data.hourly.time.reduce((indices,time,index)=>{ if(time.startsWith(dateKey)) indices.push(index); return indices; },[]); }

function renderForecastStrip(data, dayIndices, isToday) {
  let indices;
  if(isToday) {
    const start=Math.max(0,data.hourly.time.findIndex(time => time >= data.current.time)+1);
    indices=Array.from({length:6},(_,offset)=>Math.min(data.hourly.time.length-1,start+offset));
  } else {
    indices=dayIndices.filter(index => { const hour=Number(data.hourly.time[index].slice(11,13)); return hour>=6 && hour<=21 && hour%3===0; }).slice(0,6);
  }
  $("forecastEyebrow").textContent=isToday ? "Seuraavat tunnit" : "Valitun päivän tunnit";
  $("forecastStrip").innerHTML=indices.map(index=>{ const [_,symbol]=weatherCodes[data.hourly.weather_code[index]]||["","◌"]; return `<div class="forecast-cell"><span>${data.hourly.time[index].slice(11).replace(":00","")}</span><b>${symbol}</b><small>${Math.round(data.hourly.wind_speed_10m[index])} m/s</small><small>${data.hourly.precipitation_probability[index]??0} % sade</small></div>`; }).join("");
}

function renderWeather(data, dayIndex) {
  const isToday=dayIndex===0, c=data.current, d=data.daily, dayIndices=dayHourIndices(data,state.selectedDate);
  const noonIndex=dayIndices.reduce((closest,index)=>Math.abs(Number(data.hourly.time[index].slice(11,13))-12)<Math.abs(Number(data.hourly.time[closest].slice(11,13))-12) ? index : closest,dayIndices[0]);
  const [description,symbol]=weatherCodes[isToday ? c.weather_code : d.weather_code[dayIndex]]||["Vaihtelevan pilvistä","◌"];
  const dayClouds=average(dayIndices.map(index=>data.hourly.cloud_cover[index]));
  const dayHumidity=average(dayIndices.map(index=>data.hourly.relative_humidity_2m[index]));
  $("weatherEyebrow").textContent=isToday ? "Sää nyt" : "Päivän ennuste";
  $("weatherTitle").textContent=state.name; $("weatherSymbol").textContent=symbol;
  $("temperature").textContent=isToday ? `${Math.round(c.temperature_2m)}°` : `${Math.round(d.temperature_2m_max[dayIndex])}°`;
  $("weatherDescription").textContent=isToday ? description : `${description} · ${Math.round(d.temperature_2m_min[dayIndex])}–${Math.round(d.temperature_2m_max[dayIndex])}°`;
  $("wind").textContent=isToday ? `${Math.round(c.wind_speed_10m)} m/s ${degToDirection(c.wind_direction_10m)}` : `${Math.round(d.wind_speed_10m_max[dayIndex])} m/s ${degToDirection(d.wind_direction_10m_dominant[dayIndex])}`;
  $("gusts").textContent=isToday ? `${Math.round(c.wind_gusts_10m)} m/s` : `${Math.round(d.wind_gusts_10m_max[dayIndex])} m/s`;
  $("pressure").textContent=`${Math.round(isToday ? c.pressure_msl : data.hourly.pressure_msl[noonIndex])} hPa`;
  $("rainLabel").textContent=isToday ? "Sade nyt" : "Sade yhteensä";
  $("rain").textContent=isToday ? `${Number(c.precipitation).toFixed(1)} mm` : `${Number(d.precipitation_sum[dayIndex]).toFixed(1)} mm`;
  $("clouds").textContent=`${Math.round(isToday ? c.cloud_cover : dayClouds)} %`;
  $("humidity").textContent=`${Math.round(isToday ? c.relative_humidity_2m : dayHumidity)} %`;
  renderForecastStrip(data,dayIndices,isToday);
}

async function getWeather() {
  $("weatherTitle").textContent="Haetaan säätä…";
  const current="temperature_2m,relative_humidity_2m,precipitation,cloud_cover,weather_code,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m";
  const hourly="temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,cloud_cover,weather_code,pressure_msl,wind_speed_10m";
  const daily="weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset";
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${state.lat}&longitude=${state.lon}&current=${current}&hourly=${hourly}&daily=${daily}&forecast_days=16&wind_speed_unit=ms&timezone=auto`;
  try {
    const response=await fetch(url); if(!response.ok) throw new Error("Säähaku ei onnistunut");
    const data=await response.json(); state.timezone=data.timezone||state.timezone; setDateOptions(data);
    const dayIndex=data.daily.time.indexOf(state.selectedDate);
    renderAstronomy(data,dayIndex); renderWeather(data,dayIndex);
  } catch(error) {
    $("weatherTitle").textContent="Säähaku ei onnistunut"; $("weatherDescription").textContent="Tarkista verkkoyhteys ja yritä uudelleen."; $("forecastStrip").innerHTML="<p>Sääennustetta ei saatu juuri nyt.</p>";
  }
}

function updateWindy() { $("windyLink").href=`https://www.windy.com/${state.lat.toFixed(4)}/${state.lon.toFixed(4)}?${state.lat.toFixed(4)},${state.lon.toFixed(4)},9,i:wind`; }
function refresh() { $("locationStatus").textContent=`Käytössä: ${state.name}`; updateWindy(); getWeather(); }

$("forecastDate").addEventListener("change",event=>{ state.selectedDate=event.target.value; refresh(); });
$("locateButton").addEventListener("click",()=>{ if(!navigator.geolocation){ $("locationStatus").textContent="Selain ei tue paikannusta."; return; } $("locationStatus").textContent="Haetaan sijaintia…"; navigator.geolocation.getCurrentPosition((pos)=>{ state.lat=pos.coords.latitude; state.lon=pos.coords.longitude; state.name="Oma sijainti"; refresh(); },()=>{ $("locationStatus").textContent="Paikannus ei onnistunut. Voit hakea paikan nimellä."; },{enableHighAccuracy:false,timeout:10000}); });
$("searchForm").addEventListener("submit",async(event)=>{ event.preventDefault(); const query=$("placeInput").value.trim(); if(!query) return; $("locationStatus").textContent="Haetaan paikkaa…"; try { const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=fi&format=json`); const data=await response.json(), result=data.results?.[0]; if(!result) throw new Error("Paikkaa ei löytynyt"); state.lat=result.latitude; state.lon=result.longitude; state.name=[result.name,result.admin1,result.country].filter(Boolean).join(", "); refresh(); } catch { $("locationStatus").textContent="Paikkaa ei löytynyt. Kokeile paikkakuntaa tai järven nimeä."; } });

window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();deferredPrompt=event;$("installButton").hidden=false;});
$("installButton").addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installButton").hidden=true;});
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js"));
refresh();
