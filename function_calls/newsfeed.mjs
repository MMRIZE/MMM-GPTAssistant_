
const job = async function (helper, parameters) {
  console.log("parameters")
  const module = helper.getModule('newsfeed')
  if (!module) return "Newsfeed module is not found."
  const news = module?.newsItems || []
  const text = news.reduce((ret, n, index) => {
    return ret + `
Article No. ${index + 1}
- Title: ${n.title}
- Source: ${n.source}
- Publish Date: ${n.pubdate}
- Description: ${n.description}
-------------------------
        `
  }, 'Each news article has the following information:\n')
  const filePath = await helper.nodeHelperJob('processNewsFeed', text)
  if (!filePath) return "Error processing news feed."
  const { resolve, promise } = Promise.withResolvers()
  await helper.askToSubAssistant({
    content: [
      { type: 'text', text: parameters.originalInquiry },
      { type: 'file_search', file: filePath }
    ],
    callback: async function (result) {
      console.log("result", result)
      const response = result?.response?.[ 0 ]?.text?.value || 'No response found'
      resolve(response)
      await helper.nodeHelperJob('cleanNewsFeed', { filePath })
    }
  })
  return promise
}

const functionCalls = [
  {
    name: 'searchNews',
    description: 'Search interesting news from the newsfeed.',
    parameters: {
      type: 'object',
      properties: {
        originalInquiry: {
          type: 'string',
          description: 'The original inquiry from the user.',
        }
      }
    },
    callback: async function ({ helper, parameters }) {
      return await job(helper, parameters)
    }
  },
]



export { functionCalls } // ECMAScript module export