// This script will work only with OpenWeatherMap API, other weather providers are not guaranteed to work.

const c2f = function (c) {
  if (!c) return null
  return Math.round(c * 9 / 5 + 32, 1)
}
const job = async function (helper, parameters) {
  const { originalInquiry, location } = parameters
  const filterParameter = function (event) {

    return true
  }

  const modules = helper.getModules().filter(m => m.name === 'weather') || []
  if (modules.length === 0) return "Weather module is not found."
  let text = ''
  console.log(modules)
  for (const m of modules) {
    const { weatherProvider } = m
    const location = weatherProvider?.fetchedLocationName || m?.config?.location || 'unknown'
    const weather = ((weatherProvider?.currentWeatherObject) ? [ weatherProvider.currentWeatherObject ] : weatherProvider?.weatherForecastArray) || []
    if (!weather) continue
    const unit = m?.config?.units || 'metric'
    const tempUnit = (m?.config?.tempUnits === 'imperial') ? 'F' : 'C'
    text += weather.reduce((ret, w, index) => {
      let {
        date,
        feelsLikeTemp,
        humidity,
        maxTemperature,
        minTemperature,
        rain,
        snow,
        temperature,
        sunrise,
        sunset,
        weatherType,
        windFromDirection,
        windSpeed
      } = w
      const _date = date?.toDate() ?? null
      const _sunrise = sunrise?.toDate() ?? null
      const _sunset = sunset?.toDate() ?? null
      if (unit === 'imperial') {
        temperature = c2f(temperature)
        feelsLikeTemp = c2f(feelsLikeTemp)
        minTemperature = c2f(minTemperature)
        maxTemperature = c2f(maxTemperature)
      }
      const isToday = (_date && _date.toDateString() === new Date().toDateString())
      return ret + `
${index + 1}. Weather of ${location} on ${_date.toLocaleString() ?? 'unknown time'} ${isToday ? '(Today)' : ''}
- Unit: ${unit}
- Humidity: ${humidity}%
- Rain: ${rain} mm
- Snow: ${snow} mm
- Weather status: ${weatherType}
- Wind Speed: ${windSpeed} m/s
- Wind Direction: ${windFromDirection}°
${(temperature) ? "- Temperature: " + temperature + '°' + tempUnit : ''}
${(feelsLikeTemp) ? "- Feels Like: " + feelsLikeTemp + '°' + tempUnit : ''}
${(minTemperature) ? "- Min Temperature: " + minTemperature + '°' + tempUnit : ''}
${(maxTemperature) ? "- Max Temperature: " + maxTemperature + '°' + tempUnit : ''}
${(_sunrise) ? "- Sunrise: " + _sunrise.toLocaleTimeString() : ''}
${(_sunset) ? "- Sunset: " + _sunset.toLocaleTimeString() : ''}
--------------------------------`
    }, 'Weather information:\n')
  }
  console.log("text", text)

  const filePath = await helper.nodeHelperJob('processWeather', text)
  if (!filePath) return "Error processing weather."
  const { resolve, promise } = Promise.withResolvers()
  await helper.askToSubAssistant({
    content: [
      { type: 'text', text: parameters.originalInquiry },
      { type: 'file_search', file: filePath }
    ],
    callback: async function (result) {
      const response = result?.response?.[ 0 ]?.text?.value || 'No response found'
      resolve(response)
      await helper.nodeHelperJob('cleanWeather', { filePath })
    }
  })
  return promise
}

const functionCalls = [
  {
    name: 'getWeatherInformation',
    description: 'Get weather information.',
    parameters: {
      type: 'object',
      properties: {
        originalInquiry: {
          type: 'string',
          description: 'The original inquiry from the user.',
        },
        location: {
          type: 'string',
          description: 'The location to get weather information.',
        }
      },
      required: ['originalInquiry']
    },
    callback: async function ({ helper, parameters }) {
      return await job(helper, parameters)
    }
  },
]



export { functionCalls } // ECMAScript module export