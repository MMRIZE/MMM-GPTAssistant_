const htmlDecode = (input) => {
  var doc = new DOMParser().parseFromString(input, "text/html");
  return doc.documentElement.textContent;
}

const functionCalls = [
  {
    name: 'searchFromWikipedia',
    description: 'Search various infromation from Wikipedia.',
    parameters: {
      type: 'object',
      properties: {
        srsearch: {
          type: 'string',
          description: 'What user wants to search from Wikipedia.',
        },
      },
      required: [ 'srsearch' ]
    },
    callback: async function ({ helper, parameters }) {
      const { srsearch } = parameters
      let url = `https://en.wikipedia.org/w/api.php`
      const params = new URLSearchParams({
        action: 'query',
        list: 'search',
        srsearch: srsearch,
        format: "json",
        origin: "*",
      })

      try {
        const response = await fetch(`${url}?${params}`)
        const json = await response.json()
        return htmlDecode(json?.query?.search?.[0]?.snippet ?? 'not found')
      } catch (error) {
        console.log("Error fetching data from Wikipedia", error)
        return "Error fetching data."
      }
    }
  }
]
export { functionCalls } // ECMAScript module export