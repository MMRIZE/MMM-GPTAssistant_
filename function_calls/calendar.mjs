


const job = async function (helper, parameters) {
  const { originalInquiry, date, forFuture, forPast, startDateRange, endDateRange } = parameters
  const filterParameter = function (event) {
    const startDate = new Date(+event.startDate)
    const endDate = new Date(+event.endDate)
    const now = new Date()
    if (forFuture && startDate < now) return false
    if (forPast && endDate > now) return false
    if (date) {
      const d = new Date(date)
      if (startDate.toDateString() !== d.toDateString()) return false
    }
    if (startDateRange) {
      const start = new Date(startDateRange)
      if (startDate < start) return false
    }
    if (endDateRange) {
      const end = new Date(endDateRange)
      if (endDate > end) return false
    }
    return true
  }

  const modules = helper.getModules().filter(m => m.name === 'calendar') || []
  if (modules.length === 0) return "Calendar module is not found."
  let text = ''
  for (const m of modules) {
    const calendarData = m.calendarData || {}
    for (const [ calendarUrl, events ] of Object.entries(calendarData)) {
      const calendarInfo = m.config.calendars.find((c) => {
        return c.url === calendarUrl
      }) || { name: 'unknown' }
      text += events.filter(filterParameter).reduce((ret, e, index) => {
        return ret + `
EVENT: ${index + 1}
- Title: ${e.title}
- Start Date: ${new Date(+e.startDate).toLocaleString()}
- End Date: ${new Date(+e.endDate).toLocaleString()}
- Description: ${e.description}
- Location: ${e.location || 'unknown'}
- Calendar Name: ${calendarInfo.name}
-------------------------
`
      }, `Today is ${new Date().toLocaleDateString()}. Events from ${calendarInfo.name} calendar:\n`)
    }
  }
  console.log(text)
  const filePath = await helper.nodeHelperJob('processCalendar', text)
  if (!filePath) return "Error processing calendar."
  const { resolve, promise } = Promise.withResolvers()
  await helper.askToSubAssistant({
    content: [
      { type: 'text', text: parameters.originalInquiry },
      { type: 'file_search', file: filePath }
    ],
    callback: async function (result) {
      const response = result?.response?.[ 0 ]?.text?.value || 'No response found'
      resolve(response)
      await helper.nodeHelperJob('cleanCalendar', { filePath })
    }
  })
  return promise
}

const functionCalls = [
  {
    name: 'searchEvents',
    description: 'Search Events from the calendar. e.g. "summarize events of today" or "what events are scheduled for tomorrow", or "When the meeting of Tom is planned?"',
    parameters: {
      type: 'object',
      properties: {
        originalInquiry: {
          type: 'string',
          description: 'The original inquiry from the user about the events in the calendar.',
        },
        date: {
          type: 'string',
          description: 'The date of the event, if user wants to search for a specific date.',
        },
        forFuture: {
          type: 'boolean',
          description: 'If user wants to search for future events.',
        },
        forPast: {
          type: 'boolean',
          description: 'If user wants to search for past events.',
        },
        startDateRange: {
          type: 'string',
          description: 'The start date of the range of events, when user wants to search for a range of events.',
        },
        endDateRange: {
          type: 'string',
          description: 'The end date of the range of events, when user wants to search for a range of events.',
        },

      },
      required: ["originalInquiry"]
    },
    callback: async function ({ helper, parameters }) {

      return await job(helper, parameters)
    }
  },
]



export { functionCalls } // ECMAScript module export