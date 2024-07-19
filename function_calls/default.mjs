const functionCalls = [
  {
    name: 'getCurrentLocalDateAndTime',
    description: 'Get the current date and time with the current local timezone.',
    parameters: {},
    callback: async function () {
      return new Date().toLocaleString()
    }
  },
  {
    name: 'getDateToday',
    description: 'Get the date of today.',
    parameters: {},
    callback: async function () {
      return new Date().toLocaleDateString()
    }
  },

  {
    name: 'getModules',
    description: 'Get the list of modules and their visible status.',
    parameters: {},
    callback: async function ({ helper }) {
      return helper.getModules().reduce((ret, m) => {
        return ret + `Module '${m.name}' is ${m.hidden ? 'hidden' : 'visible'}\n`
      }, '')
    }
  },
  {
    name: "timer",
    description: "Activate an timer during the specified duration. e.g. 'alert me in 5 minutes'",
    parameters: {
      type: 'object',
      properties: {
        duration: {
          type: 'number',
          description: 'Duration',
        },
        unit: {
          type: 'string',
          description: 'It can be "second", "minute", "hour", "day"',
        },
        convertedDuration: {
          type: 'number',
          description: 'Converted duration in milliseconds',
        },
      },
      required: ["convertedDuration"]
    },
    callback: async function ({ helper, parameters, module }) {
      const { duration, unit, convertedDuration} = parameters
      if (convertedDuration < 1000) {
        return "Duration should be at least 1 second."
      }
      let timer = setTimeout(() => {
        helper.sendNotification('SHOW_ALERT', { message: `Timer is up!` })
        clearTimeout(timer)
      }, convertedDuration)
      return `Timer is set.`
    }
  },
]

export { functionCalls } // ECMAScript module export