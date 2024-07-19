Module.register("MMM-GPTAssistant", {
  defaults: {
    secureVectorStores: [],
    mainAssistantId: 'asst_7dIGXATJ3ao5SNtAjnPi5BMu',
    helperAssistantId: 'asst_JIcXentXQ5qjunoSWNlwgFFL',
    continueLastThread: true,
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
    functionCallFiles: [ 'default.mjs' ],
    functionCallTimeout: 1000 * 60 * 5,
    useVoiceOutput: true,
    voiceOutputModel: 'tts-1',
    voiceOutputVoice: 'nova', // 'alloy', 'echo', 'fable', 'onyx', 'nova' and 'shimmer'
    voiceOutputSpeed: 1.0,
    voiceInputSilenceOption: '1 0.1 3% 1 1.0 3%', // SOX record silence option
    voiceInputBackbone: '', // LINUX:'alsa', MAC:'coreaudio', WIN:'waveaudio'
    voiceInputDevice: '', // 'hw:0,0' or 'default' or 'plughw:1,0', '1', ...
    voiceInputTimeout: 10000,
  },

  getCommands: function (commander) {
    commander.add({
      command: 'gpt',
      description: 'Converse with MMM-GPT',
      callback: 'telegramBotCommand',
    })
  },

  telegramBotCommand: function (command, handler) {
    const deliver = {
      content: [],
      callback: async (result) => {
        const text = result?.response?.[ 0 ]?.text?.value || result?.error?.toString() || 'No reply'
        handler.reply('TEXT', text, { parse_mode: 'Markdown' })
        return
      }
    }

    const { message, args } = handler
    const { chat = {} } = message
    if (args) {
      deliver.content.push({ type: 'text', text: args })
    }
    if (chat?._photo_path) {
      const filePath = chat._photo_path
      deliver.content.push({ type: 'image_file', file: filePath })
    }
    if (chat?._document_path) {
      const filePath = chat._document_path
      deliver.content.push({ type: 'file_search', file: filePath })
    }

    if (deliver.content.length === 0) {
      deliver.content.push({ type: 'text', text: 'Hi!' })
    }
    this.notificationReceived('GPT_REQUEST', { ...deliver, voiceOutput: false, keepFile: true, onEnd: true }, { name: 'telegramBotCommand' })
  },

  test: async function () {
    console.log('test')
    const payload = {
      //toSubAssistant: true,
      // toSubAssistant: false, // omittable
      // threadId: "thread_123", // omittable, when omitted, it could be a new thread
      // role: "user", // omittable
      // content: "Hello, there!" // Alternative. You can use content array instead of content string.
      content: [
        { type: 'text', text: 'Search "Carnival" from wikipedia.' },
        // { type: 'image_file', image_file: { file_id } }, // original
        // { type: 'image_url', image_url: { url } }, // original

        //{ type: 'text', text: "Answer to the Ultimate question of Life, the Universe, and everything." },
        //{ type: 'file_search', file: '/Users/eouia/Workspace/MM/MM_2.27/modules/MMM-GPT/example.json' },
        //{ type: 'image_file', file: '/Users/eouia/Workspace/MM/MM_2.27/modules/MMM-GPT/shutterstock.jpg' },
        //{ type: 'image_url', url: 'https://www.kabiraugandasafaris.com/wp-content/uploads/2022/09/African-Tribes.jpg' },
        // { type: 'image_file', file: "path/to/image.jpg" }, // local image file for MMM-GPT
        // { type: 'image_url', url: "https://example.com/image.jpg" }, // url for MMM-GPT
        // { type: 'file_search', file: 'path/to/attachment.txt' }, // local file for MMM-GPT (attachment)
      ],
      callback: async (result) => {
        console.log('%%%% RESULT', result)
        //this.sendNotification('SHOW_ALERT', { title: 'GPT Response', message: result.response[0].text.value, timer: 10000 })
        return
      }
    }
    this.notificationReceived('GPT_REQUEST', {...payload, voiceOutput: true, keepFile: true, onEnd: true }, { name: 'test' })
  },

  start: function () {
    this.functionCalls = new Map()
    this.nodeHelperJobs = new Map()
    this.requestedNotifications = new Map()
    if (!this.config.continueLastThread && localStorage.getItem('GPT_THREAD')) {
      localStorage.removeItem('GPT_THREAD')
    }
    this.currentThreadId = localStorage.getItem('GPT_THREAD') || null
    if (this.config.continueLastThread) Log.log(`[GPT] Will continue on the last thread: ${this.currentThreadId}`)
  },

  getStyles: function () {
    return ['MMM-GPT.css']
  },

  getDom: function () {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = ''
    wrapper.classList.add('bodice', 'GPT')
    const status = document.createElement('div')
    status.classList.add('status')
    status.id = 'GPT_STATUS_' + this.identifier
    wrapper.appendChild(status)
    return wrapper
  },

  updateCurrentThreadId: function (threadId) {
    this.currentThreadId = threadId
    localStorage.setItem('GPT_THREAD', threadId)
    Log.log(`[GPT] Current thread ID: ${threadId}`)
  },

  onInitialized: function (payload) {
<<<<<<< HEAD:MMM-GPTAssistant.js
    Log.log(`[GPTA] OpenAI API Initialized`)
=======
    Log.log(`[GPT] OpenAI API Initialized`)
    const { threadId } = payload
    this.updateCurrentThreadId(threadId)

>>>>>>> e76792d (dev):MMM-GPT.js
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

  response: async function ({ notificationId, response, error, timestamp }) {
    if (this.requestedNotifications.has(notificationId)) {
      const { requested, sender } = this.requestedNotifications.get(notificationId)
      const { payload } = requested
      const { callback, voiceOutput } = payload
      const executeCallback = async (delivery) => {
        if (typeof callback === 'function') {
          const ret = { ...delivery, requested: delivery.payload }
          delete ret.payload
          return await callback(ret)
        }
      }
      if (
        payload?.toSubAssistant !== true
        && voiceOutput
        && this.config.useVoiceOutput
      ) {
        const input = response?.[ 0 ]?.text?.value || error?.toString() || ''
        this.notificationReceived('GPT_SPEAK', {
          input,
          callback: async (afterSpeak) => {
            const delivery = { error, response, timestamp, payload, voiceFile: afterSpeak?.response }
            await executeCallback(delivery)
          },
        }, { name: 'MMM-GPT' })
      } else {
        await executeCallback({ error, response, timestamp, payload })
      }
      this.requestedNotifications.delete(notificationId)
    }
<<<<<<< HEAD:MMM-GPTAssistant.js
    Log.log(`[GPTA] Request Failed: `, error)
  },

  onUpdateMainAssistantSuccess: function () {
    Log.log(`[GPTA] Main Assistant Updated. Now ready to assist!`)
=======
    Log.log(`[GPT] Finish: `, response, error)
  },

  onRequestFailed: function ({ notificationId, error, response, timestamp }) {
    this.response({ notificationId, error, response, timestamp })
    Log.log(`[GPT] Request Failed: `, error)
  },

  onUpdateMainAssistantSuccess: function (payload) {
    Log.log(`[GPT] Main Assistant Updated. Now ready to assist!`)
>>>>>>> e76792d (dev):MMM-GPT.js
    this.sendNotification('GPT_READY')
    /* test */
    //this.test()
  },

  onFunctionCall: async function (delivered) {
    const { callId, payload } = delivered
    Log.log('[GPT] FunctionCall received:', payload)
    const response = (result) => {
      this.sendSocketNotification('FUNCTION_CALL_RESPONSE', { callId, result: String(result) })
    }

    const functionCall = async (parameters, moduleId, callback) => {
      const timeout = (ms) => {
        return new Promise((resolve, _) => {
          setTimeout(() => {
            resolve(new Error('FunctionCall timeout'))
          }, ms)
        })
      }
      try {
        const m = MM.getModules().find(m => m.identifier === moduleId) ?? this
        const result = await callback({ helper: new FunctionCallHelper(m), parameters, module: m })
        Log.log(`[GPT] FunctionCall ${name} completed. - "${result}"`)
        return result
      } catch (error) {
        const msg = `FunctionCall ${name} failed.`
        Log.error(`[OPENAI] ${msg}`, error)
        return msg
      }
    }

    const { functionCallTimeout } = this.config
    const { name, parameters } = payload
    const { callback, moduleId } = this.functionCalls.get(name)
    if (typeof callback !== 'function') {
      response('No response')
    }
    const result = await functionCall(parameters, moduleId, callback)
    Log.log(`[GPTA] FunctionCall ${name} completed. - "${result}"`)
    response(result)
  },

  onResponse: async function (payload) {
    this.response(payload)
  },

  onSpeechResult: async function ({ notificationId, response, error }) {
    const audioPlay = (url, onEnd = false) => {
      const audio = new Audio(url)
      const { promise, resolve } = Promise.withResolvers()
      audio.oncanplaythrough = () => {
        Log.log(`[GPT] Audio playback started`)
        if (!onEnd) resolve(true)
        audio.play()
      }
      audio.onended = () => {
        Log.log(`[GPT] Audio playback ended`)
        if (onEnd) resolve(true)
      }
      audio.onerror = (e) => {
        Log.error(`[GPT] Audio playback error`, e)
        resolve(false)
      }
      return promise
    }
    if (this.requestedNotifications.has(notificationId)) {
      const { requested, sender } = this.requestedNotifications.get(notificationId)
      const { payload } = requested
      const { callback, keepFile = false, onEnd = true } = payload
      this.requestedNotifications.delete(notificationId)

      await audioPlay(response.url, onEnd)
      await callback({
        error,
        response,
        timestamp: new Date().getTime(),
        requested: payload,
      })
      if (!keepFile) {
        this.sendSocketNotification('REMOVE_FILE', { filePath: response.filePath })
      }
    } else {
      Log.log(`[GPT] onSpeechResult: No receiver found for ${notificationId}`)
    }
  },

  onStatusReport: function (status) {
    const statusDom = document.getElementById('GPT_STATUS_' + this.identifier)
    if (statusDom && statusDom.dataset.status !== status) {
      statusDom.dataset.status = status
    }
  },

  onNodeHelperJobResult: function ({ jobId, result }) {
    if (this.nodeHelperJobs.has(jobId)) {
      const { resolver } = this.nodeHelperJobs.get(jobId)
      resolver(result)
      return true
    }
    return
  },


  socketNotificationReceived: function (notification, payload) {
    const job = {
      'INITIALIZED': 'onInitialized',
      'REQUEST_FAILED': 'onRequestFailed',
      'UPDATE_MAIN_ASSISTANT_SUCCESS': 'onUpdateMainAssistantSuccess',
      'UPDATE_CURRENT_THREAD': 'updateCurrentThreadId',
      'RESPONSE': 'onResponse',
      'FUNCTION_CALL': 'onFunctionCall',
      'SPEECH_RESULT': 'onSpeechResult',
      'STATUS_REPORT': 'onStatusReport',
      'NODE_HELPER_JOB_RESULT': 'onNodeHelperJobResult',

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
      'GPT_SPEAK': 'onSpeak', // { input: 'Hello, there!', voice, model, speed, callback, asFile }
      'GPT_REQUEST_WITH_VOICE': 'onVoice', // { callback }
    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      const notificationId = new Date().getTime() + '_' + Math.random().toString(36).substring(7)
      if (notification.search('GPT_') === 0) {
        if (typeof payload?.callback !== 'function') payload.callback = () => { return }
        payload.notificationId = notificationId
        this.requestedNotifications.set(notificationId, { requested: { notification, payload }, sender: sender.name })
      }
      this[ job[ notification ] ](payload)
      return
    }
  },

  onRequestVoice: async function (payload) {
    const { filePath } = payload

  },

  onVoice: async function (payload) {
    const {
      voiceInputSilenceOption = this.config.voiceInputSilenceOption,
      voiceInputBackbone = this.config.voiceInputBackbone || '',
      voiceInputDevice = this.config.voiceInputDevice || '',
      voiceInputTimeout = this.config.voiceInputTimeout || 10000,
    } = payload
    this.sendSocketNotification('PROCESS_VOICE', {
      ...payload,
      voiceInputSilenceOption,
      voiceInputBackbone,
      voiceInputDevice,
      voiceInputTimeout,
    })
  },

  onSpeak: async function (payload) {
    this.sendSocketNotification('SPEAK', payload)
  },

  onRequest: async function (payload, sender) {
    this.sendSocketNotification('REQUEST', payload)
  },

  onAllModulesStarted: async function () {
    await this.prepareIconify()
    await this.initFunctionCalls()
    this.sendSocketNotification('INIT', { config: this.config, threadId: this.currentThreadId })
  },

  prepareIconify: function () {
    const ICONIFY_URL = 'https://code.iconify.design/1/1.0.7/iconify.min.js'
    const { resolve, promise } = Promise.withResolvers()
    if (!window.customElements.get('iconify-icon') && !document.getElementById('iconify')) {
      let iconify = document.createElement('script')
      iconify.id = 'iconify'
      iconify.src = ICONIFY_URL
      document.head.appendChild(iconify)
      iconify.onload = () => {
        Log.log(`[GPT] Iconify loaded`)
        resolve(true)
      }
    } else {
      resolve(false)
    }
    return promise
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
<<<<<<< HEAD:MMM-GPTAssistant.js
          Log.log(`[GPTA] Error loading function calls: ${name}`, error.toString())
=======
          Log.log(`[GPT] Error loading function calls: ${name}`, error.toString())
          Log.error(error)
>>>>>>> e76792d (dev):MMM-GPT.js
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

class FunctionCallHelper {
  constructor(module) {
    this.module = module
  }
  getModules () {
    return MM.getModules()
  }

  getModule (moduleName) {
    return MM.getModules().find(m => m.name === moduleName)
  }

  hideModule (moduleName) {
    const module = MM.getModules().find(m => m.name === moduleName)
    if (module) {
      module.hide()
    }
  }

  showModule (moduleName) {
    const module = MM.getModules().find(m => m.name === moduleName)
    if (module) {
      module.show()
    }
  }

  sendNotification (notification, payload) {
    this.module.sendNotification(notification, payload)
  }

  async nodeHelperJob(jobName, payload) {
    const module = this.getModule('MMM-GPT')
    const jobId = new Date().getTime() + '_' + Math.random().toString(36).substring(7)
    const { resolve, promise } = Promise.withResolvers()
    const resolver = (result) => {
      resolve(result)
      module.nodeHelperJobs.delete(jobId)
    }
    module.nodeHelperJobs.set(jobId, { jobName, payload, resolver })
    module.sendSocketNotification('NODE_HELPER_JOB', { jobId, jobName, payload })
    return promise
  }

  async askToSubAssistant({ content, callback = () => { return } }) {
    const { resolve, promise } = Promise.withResolvers()
    const module = this.getModule('MMM-GPT')
    module.notificationReceived('GPT_REQUEST',
      {
        toSubAssistant: true,
        content,
        callback: async function (result) {
          resolve(result)
          callback(result)
          return result
        },
        voiceOutput: false,
      },
      { name: 'FunctionCallHelper' }
    )

    return promise
  }

  test() {
    console.log('OOPS')
  }
}