"use client";

import { useEffect, useState } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Wind } from "lucide-react";

type DayForecast = {
  date: string;
  tempHigh: number;
  tempLow: number;
  weatherCode: number;
  precipProbability: number;
  windSpeed: number;
};

type WeatherWidgetProps = {
  days: string[];
  lat?: number;
  lng?: number;
};

// WMO weather codes → icon + label
function getWeatherInfo(code: number) {
  if (code === 0) return { icon: Sun, label: "Clear", color: "text-amber-500" };
  if (code <= 3) return { icon: Cloud, label: "Partly Cloudy", color: "text-gray-400" };
  if (code <= 48) return { icon: Cloud, label: "Foggy", color: "text-gray-400" };
  if (code <= 55) return { icon: CloudDrizzle, label: "Drizzle", color: "text-blue-400" };
  if (code <= 65) return { icon: CloudRain, label: "Rain", color: "text-blue-500" };
  if (code <= 67) return { icon: CloudRain, label: "Freezing Rain", color: "text-blue-600" };
  if (code <= 77) return { icon: CloudSnow, label: "Snow", color: "text-blue-300" };
  if (code <= 82) return { icon: CloudRain, label: "Showers", color: "text-blue-500" };
  if (code <= 86) return { icon: CloudSnow, label: "Snow Showers", color: "text-blue-300" };
  if (code >= 95) return { icon: CloudLightning, label: "Thunderstorm", color: "text-purple-500" };
  return { icon: Cloud, label: "Cloudy", color: "text-gray-400" };
}

function formatDayName(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  if (dateStr === todayStr) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (dateStr === tomorrow.toISOString().split("T")[0]) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function WeatherWidget({ days, lat = 30.27, lng = -97.74 }: WeatherWidgetProps) {
  const [forecast, setForecast] = useState<DayForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (days.length === 0) return;

    const startDate = days[0];
    const endDate = days[Math.min(days.length - 1, 6)]; // Cap at 7 days

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&start_date=${startDate}&end_date=${endDate}&timezone=auto`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.daily) {
          const forecasts: DayForecast[] = data.daily.time.map(
            (date: string, i: number) => ({
              date,
              tempHigh: Math.round(data.daily.temperature_2m_max[i]),
              tempLow: Math.round(data.daily.temperature_2m_min[i]),
              weatherCode: data.daily.weather_code[i],
              precipProbability: data.daily.precipitation_probability_max[i],
              windSpeed: Math.round(data.daily.wind_speed_10m_max[i]),
            })
          );
          setForecast(forecasts);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [days, lat, lng]);

  if (loading) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white p-4 mb-4">
        <div className="text-xs text-gray-400">Loading weather...</div>
      </div>
    );
  }

  if (error || forecast.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Field Conditions</h3>
        <span className="text-[10px] text-gray-300">Open-Meteo</span>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {forecast.map((day) => {
          const weather = getWeatherInfo(day.weatherCode);
          const WeatherIcon = weather.icon;
          const isBadWeather = day.precipProbability > 50 || day.windSpeed > 25;

          return (
            <div
              key={day.date}
              className={`flex-1 min-w-[72px] text-center p-2 rounded-lg transition-colors ${
                isBadWeather ? "bg-red-50 border border-red-100" : "bg-gray-50"
              }`}
            >
              <div className="text-[10px] font-medium text-gray-500 mb-1">{formatDayName(day.date)}</div>
              <WeatherIcon size={20} className={`mx-auto mb-1 ${weather.color}`} />
              <div className="text-xs font-semibold text-gray-700">
                {day.tempHigh}°
                <span className="text-gray-400 font-normal"> / {day.tempLow}°</span>
              </div>
              {day.precipProbability > 20 && (
                <div className="text-[10px] text-blue-500 mt-0.5">
                  {day.precipProbability}% rain
                </div>
              )}
              {day.windSpeed > 15 && (
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-gray-400 mt-0.5">
                  <Wind size={10} />
                  {day.windSpeed} mph
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
