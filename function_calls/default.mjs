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
    name: 'testYourFunction',
    description: 'When user ask to test your function, answer with this.',
    parameters: {},
    callback: async function () {
      const modules = MM.getModules()
      console.log("#", modules)
      console.log("@", this)
      return "I'm alive!"
    }
  },
]

export { functionCalls } // ECMAScript module export