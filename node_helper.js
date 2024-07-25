const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
require('dotenv').config({ path: path.resolve(__dirname, '.env') })
const NodeHelper = require('node_helper')
const Log = require('logger')
const OpenAI = require("openai")
const EventHandler = require('./eventhandler.js')

const API_KEY = process.env.OPENAI_API_KEY
const PROJECT_ID = process.env.OPENAI_PROJECT_ID
const ORGANIZATION = process.env.OPENAI_ORGANIZATION

const OPENAI = (() => {
  try {
    Log.log(`[GPTA] Initializing OpenAI API`)
    return new OpenAI({
      apiKey: API_KEY,
      organization: ORGANIZATION,
      project: PROJECT_ID,
    })
  } catch (error) {
    Log.error(`[GPTA] OpenAI API cannot be initialized - `, error.toString())
    return null
  }
})()

module.exports = NodeHelper.create({
  start: function () {
    this.config = {}
    this.currentThreadId = null
    this.functionCalls = new Map()
    this.nodeHelperJobs = {}
  },

  fatalError: function (error, payload = null) {
    Log.log(`[GPTA] Fatal Error: `, error.toString())
    if (payload) Log.log(`[GPTA] > `, payload)
    this.sendSocketNotification('FATAL_ERROR', { error: error.toString() })
  },

  socketNotificationReceived: function (notification, payload) {
    const job = {
      'INIT': 'initialize',
      'UPDATE_MAIN_ASSISTANT': 'refreshFunctionCallsToAssistant',
      'REQUEST': 'onRequest',
      'FUNCTION_CALL_RESPONSE': 'onFunctionCallResponse',
      'SPEAK': 'onSpeak',
      'REMOVE_FILE': 'removeFile',
      'NODE_HELPER_JOB': 'nodeHelperJob',
      'PROCESS_VOICE': 'processVoice',

      'PREPARE_ASSISTANT': 'prepareAssistant',

    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      this[ job[ notification ] ](payload)
      return
    }
  },

  processVoice: async function (payload) {
    let timer = null
    const { notificationId, voiceInputSilenceOption, voiceInputBackbone, voiceInputDevice, voiceInputTimeout } = payload
    const soxCommand = 'rec'
    const filePath = path.resolve(__dirname, 'storage', 'voice_input.wav')
    const args = [ filePath, 'rate', '16k', 'channels', '1', 'silence', voiceInputSilenceOption.split(' ') ]
    const process = spawn(soxCommand, args)
    process.on('close', async (code) => {
      clearTimeout(timer)
      timer = null
      Log.log(`[GPTA] Voice Input completed: ${code}`)
      const { text = null, error = null } = await this.transcribeVoice({ notificationId, filePath })

      this.sendSocketNotification('PROCESS_VOICE_RESULT', { notificationId, response: { text }, error })
    })
    process.stderr.on('data', (data) => {
      Log.log(`[GPTA] Voice Input stderr: ${data}`)
    })

    timer = setTimeout(() => {
      clearTimeout(timer)
      timer = null
      process.kill('SIGINT')
    }, voiceInputTimeout)
  },

  transcribeVoice: async function ({ notificationId, filePath, voiceTranscriptionModel = 'whisper-1' }) {
    try {
      const transcription = await OPENAI.audio.transcription.create({
        file: fs.createReadStream(filePath),
        model: voiceTranscriptionModel,
      })
      return { text: transcription?.text ?? '' }
    } catch (error) {
      Log.log(`[GPTA] Voice Transcription failed: `, error.toString())
      return { error: error.toString() }
    }
  },

  nodeHelperJob: async function ({ jobId, jobName, payload }) {
    let ret = null
    if (this.nodeHelperJobs[ jobName ] && typeof this.nodeHelperJobs[ jobName ] === 'function') {
      try {
        ret = await this.nodeHelperJobs[ jobName ](payload)
        console.log(">", ret)
      } catch (error) {
        Log.log(`[GPTA] Node Helper Job failed: `, error.toString())
        ret = error
      } finally {
        delete this.nodeHelperJobs[ jobName ]
      }
    } else {
      Log.log(`[GPTA] Node Helper Job not found: `, jobName)
    }
    Log.log(`[GPTA] Node Helper Job completed: `, jobName)
    this.sendSocketNotification('NODE_HELPER_JOB_RESULT', { jobId, result: ret })
    return ret
  },

  removeFile: async function ({ filePath }) {
    Log.log(`[GPTA] Removing file: ${filePath}`)
    const fp = path.resolve(__dirname, filePath)
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp)
      Log.log(`[GPTA] File removed: ${fp}`)
    } else {
      Log.log(`[GPTA] File not found: ${fp}`)
    }
  },

  onFunctionCallResponse: async function ({ callId, result }) {
    Log.log(`[GPTA] Function Call Response: `, callId, result)
    if (this.functionCalls.has(callId)) {
      this.functionCalls.get(callId).resolve(result)
      Log.log(`[GPTA] Function Call Resolved: `, callId)
    } else {
      Log.log(`[GPTA] Function Call not found: `, callId)
    }
    return
  },

  response: function ({ notificationId, response=null, request=null, error = null }) {
    if (error) Log.log(`[GPTA] Request Failed: `, error.toString())
      console.log("!", response)
    if (response?.text?.value) response.text.value = response.text.value.replace(/【\d+†source】/g, '')
    this.sendSocketNotification('RESPONSE', {
      notificationId,
      response,
      request,
      timestamp: new Date().getTime(),
      error
    })
  },

  uploadFile: async function (fp, purpose = 'assistants') {
    Log.log(`[GPTA] Uploading file: ${fp}`)
    const filePath = path.resolve(__dirname, fp)
    if (!fs.existsSync(filePath)) {
      Log.log(`[GPTA] File not found: ${filePath}`)
      return false
    }
    try {
      const f = await OPENAI.files.create({
        file: fs.createReadStream(filePath),
        purpose,
      })
      Log.log(`[GPTA] File uploaded: ${f.id} for ${purpose}`)
      return f
    } catch (error) {
      Log.log(`[GPTA] File cannot be uploaded`)
      Log.log(`[GPTA] - Reason: ${error.toString()}`)
      return false
    }
  },

  onSpeak: async function (requested) {
    let {
      notificationId,
      input,
      model = this.config.voiceOutputModel,
      voice = this.config.voiceOutputVoice,
      speed = this.config.voiceOutputSpeed,
    } = requested

    const timestamp = new Date().getTime()
    try {
      const fileName = new Date().getTime() + Math.random().toString(36).substring(7) + '.mp3'
      const filePath = path.resolve(__dirname, 'storage', fileName)
      const url = `/modules/MMM-GPT/storage/${fileName}`
      const mp3 = await OPENAI.audio.speech.create({ model, input, voice, speed, response_format: 'mp3' })
      const buffer = Buffer.from(await mp3.arrayBuffer())
      await fs.promises.writeFile(filePath, buffer)
      Log.log(`[GPTA] Speech created: ${filePath}`)
      this.sendSocketNotification('SPEECH_RESULT', { notificationId, response: { filePath, url }, timestamp, error: null, requested })
    } catch (error) {
      Log.log(`[GPTA] Speech failed: `, error.toString())
      this.sendSocketNotification('SPEECH_RESULT', { notificationId, error: error.toString(), response: null, timestamp, requested })
    }
  },

  onRequest: async function (payload) {
    let {
      notificationId,
      toSubAssistant = false,
      threadId = null,
      role = 'user',
      content = null,
    } = payload

    let formattedContent = []
    let attachments = null
    if (role !== 'assistant') role = 'user'
    if (typeof content === 'string') {
      formattedContent = [ { type: 'text', content } ]
    } else if (Array.isArray(content)) {
      try {
        for await (const c of content) {
          switch (c.type) {
            case 'text':
              formattedContent.push({ type: 'text', text: c.text })
              break
            case 'image_url':
              formattedContent.push({ type: 'image_url', image_url: { url: c.url } })
              break
            case 'image_file':
              const file = await this.uploadFile(c.file, 'vision')
              if (file.id) {
                formattedContent.push({
                  type: 'image_file',
                  image_file: { file_id: file.id }
                })
              } else {
                Log.log(`[GPTA] Image file upload failed: `, c.file)
              }
              break
            case 'file_search':
              const filesearch = await this.uploadFile(c.file, 'assistants')
              if (filesearch.id) {
                if (!attachments) attachments = []
                attachments.push({
                  file_id: filesearch.id,
                  tools: [ { type: 'file_search' } ]
                })
              } else {
                Log.log(`[GPTA] File upload failed: `, c.file)
              }
              break
            default:
              Log.log(`[GPTA] Invalid content type: `, c)
              break
          }
        }
      } catch (error) {
        this.response({
          notificationId,
          request: payload,
          error: error.toString(),
        })
        return
      }
    }
    if (!Array.isArray(formattedContent) || formattedContent.length < 1) {
      Log.log(`[GPTA] Invalid content: `, content)
    }

    const messageTo = toSubAssistant ? 'messageToSubAssistant' : 'messageToMainAssistant'

    try {
      const response = await this[ messageTo ]({ notificationId, threadId, role, content: formattedContent, attachments })
      this.response(response)
      return
    } catch (error) {
      this.response({ notificationId, error })
      return
    }
  },

  messageToSubAssistant: async function ({ notificationId, threadId, role, content, attachments = null }) {
    let thread
    threadId = threadId ?? null
    try {
      thread = await OPENAI.beta.threads.retrieve(threadId)
    } catch (error) {
      if (threadId) Log.log(`[GPTA] Thread not found: `, threadId)
      thread = await OPENAI.beta.threads.create()
      threadId = thread.id
      Log.log(`[GPTA] (SUB) New Thread created: `, threadId)
    }
    const response = await this.messageTo({ assistantId: this.config.subAssistantId, notificationId, threadId, role, content, attachments })
    await OPENAI.beta.threads.del(threadId)

    return response

  },

  messageToMainAssistant: async function ({ notificationId, threadId, role, content, attachments = null }) {
    let thread
    threadId = threadId ?? this.currentThreadId
    try {
      thread = await OPENAI.beta.threads.retrieve(threadId)
    } catch (error) {
      if (threadId) Log.log(`[GPTA] Thread not found: `, threadId)
      thread = await OPENAI.beta.threads.create()
      threadId = thread.id
      Log.log(`[GPTA] New Thread created: `, threadId)
      this.currentThreadId = threadId
      this.sendSocketNotification('UPDATE_CURRENT_THREAD', threadId)
    }
    const response = await this.messageTo({ assistantId: this.config.mainAssistantId, notificationId, threadId, role, content, attachments })
    return response
  },

  messageTo: async function ({ assistantId, notificationId, threadId, role, content, attachments = null }) {
    const { resolve, reject, promise } = Promise.withResolvers()

    try {
      const message = await OPENAI.beta.threads.messages.create(threadId, {
        role,
        content,
        attachments,
      })

      const eventHandler = new EventHandler({
        client: OPENAI,
        notificationId,
        threadId,
        functionCall: async (id, payload) => { return await this.functionCall(id, payload) },
        onFinish: async (result) => { resolve(result) },
        statusReport: (status) => { return this.sendSocketNotification('STATUS_REPORT', status) },
      })

      eventHandler.on('event', eventHandler.onEvent.bind(eventHandler))

      try {
        const stream = await OPENAI.beta.threads.runs.stream(
          threadId,
          { assistant_id: assistantId },
          eventHandler
        )

        for await (const event of stream) {
          eventHandler.emit('event', event)
        }
      } catch (error) {
        Log.log(`[GPTA] Thread ${threadId} stream failed: `, error.toString())
        throw error
      }
    } catch (error) {
      Log.log(`[GPTA] Message to Assistant failed: `, error.toString())
      Log.error(error)
      throw error
    }

    return promise
  },

  functionCall: async function (callId, payload) {
    let timeOut = null
    const { promise, resolve, reject } = Promise.withResolvers()
    const resolver = (value) => {
      clearTimeout(timeOut)
      resolve(value)
      this.functionCalls.delete(callId)
    }
    const rejector = (value) => {
      clearTimeout(timeOut)
      reject(value)
      this.functionCalls.delete(callId)
    }
    timeOut = setTimeout(() => {
      Log.log(`[GPTA] Function call timeout for ${callId}`, payload)
      resolver('No reply - Function calling timeout')
    }, this.config.functionCallTimeout)
    this.functionCalls.set(callId, {
      response: promise,
      resolve: resolver,
      reject: rejector,
      createdAt: Date.now(),
      timeOut,
    })
    this.sendSocketNotification('FUNCTION_CALL', { callId, payload })
    Log.log(`[GPTA] Function call: ${callId} - ${payload.name}`)
    return promise
  },



  refreshFunctionCallsToAssistant: async function ({ assistantId, functionCalls = [] }) {
    Log.log(`[GPTA] Updating Function Calls to Assistant: ${assistantId}`)
    try {
      const assistant = await OPENAI.beta.assistants.retrieve(assistantId)
      const tools = assistant?.tools ?? []
      const newTools = tools.reduce((ret, t) => {
        if (t?.type !== 'function') ret.push(t)
        return ret
      }, [])
      for (const { name, description, parameters } of functionCalls) {
        newTools.push({
          type: 'function',
          function: { name, description, parameters }
        })
        Log.log(`[GPTA] Added Function Call: ${name}`)
      }
      const updated = await OPENAI.beta.assistants.update(assistantId, { tools: newTools })
      Log.log(`[GPTA] Function Calls updated to Assistant: ${assistantId}`)
      this.sendSocketNotification('UPDATE_MAIN_ASSISTANT_SUCCESS')
    } catch (err) {
      Log.error(`[GPTA] Error during Main Assistant update: `, err.toString())
      this.sendSocketNotification('UPDATE_MAIN_ASSISTANT_FAILED')
    }
  },

  initialize: async function ({ config, threadId = null }) {
    Log.log(`[GPTA] Initializing GPTAssistant.`)

    if (Object.keys(this.config).length > 0) {
      Log.error(`[GPTA] GPTAssistant already initialized. This module should be instantiated only once.`)
      return
    }
    this.config = config
    const { secureVectorStores = [] } = this.config

    // Check Assistant Instances
    try {
      const assistants = [this.config.mainAssistantId, this.config.subAssistantId]
      for (const id of assistants) {
        const assistant = await OPENAI.beta.assistants.retrieve(id)
        if (assistant?.id) {
          Log.log(`[GPTA] Assistant found: ${assistant.name} (${assistant.id})`)
          const vs_ids = assistant?.tool_resources?.file_search?.vector_store_ids ?? []
          for (const vsId of vs_ids) {
            Log.log(`[GPTA] Assistant Vector Store found. It will be secured.: ${vsId}`)
            secureVectorStores.push(vsId)
          }
        }
      }
    } catch (error) {
      Log.error(`[GPTA] Error during Assistant check: `, error.toString())
    }


    // Clean up VectorStores
    try {
      const condition = {
        limit: 3,
        order: 'desc',
      }
      has_more = true
      let cond = {}
      const toDelete = new Set()

      do {
        cond = { ...condition, ...cond }
        const response = await OPENAI.beta.vectorStores.list(cond)
        const vsList = response?.data ?? []
        if (vsList.length < 0) {
          has_more = false
          continue
        }
        for (const vs of vsList) {
          if (secureVectorStores.includes(vs.id)) {
            Log.log(`[GPTA] VectorStore to keep: ${vs.id}`)
          } else {
            Log.log(`[GPTA] VectorStore to delete: ${vs.id}`)
            toDelete.add(vs.id)
          }
        }
        has_more = response?.body?.has_more ?? false
        if (has_more && response?.body?.last_id) cond.after = response.body.last_id
      } while (has_more)

      for (const vsId of [ ...toDelete ]) {
        await OPENAI.beta.vectorStores.del(vsId)
        Log.log(`[GPTA] Deleted VectorStore ${vsId}`)
      }
      Log.log(`[GPTA] VectorStore cleanup completed`)
    } catch (error) {
      Log.error(`[GPTA] Error during VectorStore cleanup: `, error.toString())
    }

    // Clean up Files, keep the vectorStoreFiles
    const toKeep = new Set()

    try {
      for (const vsId of secureVectorStores) {
        const response = await OPENAI.beta.vectorStores.files.list(vsId)
        for (const f of (response?.data ?? [])) {
          if (f.id) toKeep.add(f.id)
        }
      }
      const allFiles = await OPENAI.files.list()
      for await (const f of (allFiles?.data ?? [])) {
        if (f.id && !toKeep.has(f.id)) {
          await OPENAI.files.del(f.id)
          Log.log(`[GPTA] File to delete: ${f.id}`)
        } else {
          Log.log(`[GPTA] File to keep: ${f.id}`)
        }
      }
    } catch (error) {
      Log.error(`[GPTA] Error during File cleanup in VectorStore ${vsId}: `, error.toString())
    }
    Log.log(`[GPTA] File cleanup completed`)

    // Get Last Thread
    if (threadId) {
      try {
        const thread = await OPENAI.beta.threads.retrieve(threadId)
        if (thread?.id) {
          this.currentThreadId = thread.id
          Log.log(`[GPTA] The last Thread: ${thread.id}`)
        } else {
          Log.log(`[GPTA] The last thread not found: ${threadId}`)
        }
      } catch (error) {
        Log.log(`[GPTA] Error during the last thread check: `, error.toString())
        Log.log(`[GPTA] There is no previous thread. A new thread will be created.`)
      }
    } else {
      Log.log(`[GPTA] The last thread will not be used.`)
    }

    await this.registerNodeHelperJobs()

    this.sendSocketNotification('INITIALIZED', { threadId: this.currentThreadId })
  },

  registerNodeHelperJobs: async function () {
    const { functionCallFiles = [] } = this.config
    for (const file of functionCallFiles) {
      try {
        const filename = `_${file}.mjs`
        const filePath = path.resolve(__dirname, 'function_calls', 'node_helper_jobs', filename )
        if (fs.existsSync(filePath)) {
          const { nodeHelperJobs } = await import(filePath)
          this.nodeHelperJobs = { ...this.nodeHelperJobs, ...nodeHelperJobs }
        }
      } catch (error) {
        Log.log(`[GPTA] Node Helper Job registration failed: `, error.toString())
      }
    }
  }
})