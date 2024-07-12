Module.register("MMM-GPTAssistant", {
  defaults: {
    secureVectorStores: [],
    mainAssistantId: 'asst_7dIGXATJ3ao5SNtAjnPi5BMu',
    helperAssistantId: 'asst_JIcXentXQ5qjunoSWNlwgFFL',
    functionCalls: [
      {
        name: 'getCurrentLocalDateAndTime',
        description: 'Get the current date and time with the current local timezone.',
        parameters: {},
        callback: async function () {
          return new Date().toLocaleString()
        }
      },

    ],
    functionCallFiles: ['default.mjs'],
  },

  start: function () {
    this.functionCalls = new Map()
    this.requestedNotifications = new Map()
  },

  onInitialized: function (payload) {
    Log.log(`[GPTA] OpenAI API Initialized`)
    //this.sendNotification('GPT_API_READY')
    const tools = []
    this.functionCalls.forEach(({ name, description, parameters }) => {
      tools.push({ name, description, parameters })
    })
    this.sendSocketNotification('UPDATE_MAIN_ASSISTANT', {
      assistantId: this.config.mainAssistantId,
      functionCalls: tools
    })
  },

  onRequestFailed: function ({ notificationId, error, response, timestamp }) {
    if (this.requestedNotifications.has(notificationId)) {
      const { requested, sender } = this.requestedNotifications.get(notificationId)
      const { notification, ...rest } = requested
      const { callback, ...payload } = rest
      const result = {
        notificationId,
        notification,
        error,
        response,
        sender,
        payload,
        timestamp
      }
      if (typeof callback === 'function') callback(result)
      this.sendNotification(requested.notification, { ...requested.payload, error, response })
      this.requestedNotifications.delete(notificationId)
    }
    Log.log(`[GPTA] Request Failed: `, error)
  },

  onUpdateMainAssistantSuccess: function () {
    Log.log(`[GPTA] Main Assistant Updated. Now ready to assist!`)
    this.sendNotification('GPT_READY')
    /* test */
    this.test()
  },

  test: async function () {
    const payload = {
      // toSubAssistant: false, // omittable
      // threadId: "thread_123", // omittable, when omitted, it could be a new thread
      // role: "user", // omittable
      // content: "Hello, there!" // Alternative. You can use content array instead of content string.
      content: [
        { type: 'text', text: 'Hello, there!' },
        // { type: 'image_file', image_file: { file_id } }, // original
        // { type: 'image_url', image_url: { url } }, // original

        // { type: 'image_file', file: "path/to/image.jpg" }, // local image file for MMM-GPT
        // { type: 'image_url', url: "https://example.com/image.jpg" }, // url for MMM-GPT
        // { type: 'file_search', file: 'path/to/attachment.txt' }, // local file for MMM-GPT (attachment)
      ],
      callback: async (result) => {
        console.log('RESULT', result)
        console.log("THIS", this)
        return
      }
    }
    this.notificationReceived('GPT_REQUEST', payload, { name: 'test' })
  },

  socketNotificationReceived: function (notification, payload) {
    const job = {
      'INITIALIZED': 'onInitialized',
      'REQUEST_FAILED': 'onRequestFailed',
      'UPDATE_MAIN_ASSISTANT_SUCCESS': 'onUpdateMainAssistantSuccess',

    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      this[ job[ notification ] ](payload)
      return
    }
  },

  notificationReceived: function (notification, payload, sender) {
    const job = {
      'ALL_MODULES_STARTED': 'onAllModulesStarted',
      'GPT_REQUEST': 'onRequest',

      'GPT_PREPARE_ASSISTANT': 'onPrepareAssistant',


    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      const notificationId = new Date().getTime() + '_' + Math.random().toString(36).substring(7)
      if (notification.search('GPT_') === 0 && typeof payload?.callback === 'function') {
        payload.notificationId = notificationId
        this.notificationRequests.set(notificationId, { requested: { notification, payload }, sender: sender.name })
      }
      this[ job[ notification ] ](payload)
      return
    }
  },

  onRequest: async function (payload, sender) {
    console.log('INCOMING REQUEST', payload)
    payload.notificationId = this.registerRequest(payload)
    this.sendSocketNotification('REQUEST', payload)
  },

  registerRequest: function (payload) {
    const notificationId = new Date().getTime() + '_' + Math.random().toString(36).substring(7)
    this.requestedNotifications.set(notificationId, payload)
    return notificationId
  },

  onAllModulesStarted: async function () {
    await this.initFunctionCalls()
    this.sendSocketNotification('INIT', { config: this.config })
  },

  onPrepareAssistant: function (payload) {
    console.log('Prepare Assistant')
    this.sendSocketNotification('PREPARE_ASSISTANT', payload)
  },


  initFunctionCalls: async function () {
    // Load functionCallFiles
    const { functionCallFiles } = this.config
    if (Array.isArray(functionCallFiles)) {
      functionCallFiles.forEach(async (name) => {
        const mjs = `./function_calls/${name}`
        try {
          const { functionCalls } = await import(mjs)
          functionCalls.forEach((f) => {
            Log.log(`[GPTA] Loaded function call: ${f.name} from ${name}`)
            this.functionCalls.set(f.name, f)
          })
        } catch (error) {
          Log.log(`[GPTA] Error loading function calls: ${name}`, error.toString())
        }
      })
    }

    // Load functionCalls in modules' config
    MM.getModules().forEach((m) => {
      if (m.config?.functionCalls) {
        m.config.functionCalls.forEach((f) => {
          Log.log(`[GPTA] Loaded function call: ${f.name} from ${m.name}`)
          this.functionCalls.set(f.name, f)
        })
      }
    })
  },

})