const path = require('path')
const fs = require('fs')
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
    Log.log(`[GPT] Initializing OpenAI API`)
    return new OpenAI({
      apiKey: API_KEY,
      organization: ORGANIZATION,
      project: PROJECT_ID,
    })
  } catch (error) {
    Log.error(`[GPT] OpenAI API cannot be initialized - `, error.toString())
    return null
  }
})()

module.exports = NodeHelper.create({
  start: function () {
    this.config = {}
  },

  fatalError: function (error, payload = null) {
    console.log(`[GPT] Fatal Error: `, error.toString())
    if (payload) console.log(`[GPT] > `, payload)
    this.sendSocketNotification('FATAL_ERROR', { error: error.toString() })
  },

  socketNotificationReceived: function (notification, payload) {
    const job = {
      'INIT': 'initialize',
      'UPDATE_MAIN_ASSISTANT': 'refreshFunctionCallsToAssistant',
      'REQUEST': 'onRequest',

      'PREPARE_ASSISTANT': 'prepareAssistant',

    }

    if (job[ notification ] && typeof this[ job[ notification ] ] === 'function') {
      this[ job[ notification ] ](payload)
      return
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

    if (role !== 'assistant') role = 'user'
    if (typeof content === 'string') content = [{ type: 'text', content }]

    console.log('INCOMING REQUEST', payload)

  },

  refreshFunctionCallsToAssistant: async function ({ assistantId, functionCalls = [] }) {
    Log.log(`[GPT] Refreshing Function Calls to Assistant: ${assistantId}`)
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
        Log.log(`[GPT] Added Function Call: ${name}`)
      }
      const updated = await OPENAI.beta.assistants.update(assistantId, { tools: newTools })
      Log.log(`[GPT] Function Calls updated to Assistant: ${assistantId}`)
      this.sendSocketNotification('UPDATE_MAIN_ASSISTANT_SUCCESS')
    } catch (err) {
      Log.error(`[GPT] Error during Main Assistant update: `, err.toString())
      this.sendSocketNotification('UPDATE_MAIN_ASSISTANT_FAILED')
    }
  },

  initialize: async function ({ config }) {
    Log.log(`[GPT] Initializing GPT`)

    if (Object.keys(this.config).length > 0) {
      Log.error(`[GPT] GPTore already initialized. This module should be instantiated only once`)
      return
    }
    this.config = config
    const { secureVectorStores = [] } = this.config

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
            Log.log(`[GPT] VectorStore to keep: ${vs.id}`)
          } else {
            Log.log(`[GPT] VectorStore to delete: ${vs.id}`)
            toDelete.add(vs.id)
          }
        }
        has_more = response?.body?.has_more ?? false
        if (has_more && response?.body?.last_id) cond.after = response.body.last_id
      } while (has_more)

      for (const vsId of [ ...toDelete ]) {
        await OPENAI.beta.vectorStores.del(vsId)
        Log.log(`[GPT] Deleted VectorStore ${vsId}`)
      }
      Log.log(`[GPT] VectorStore cleanup completed`)
    } catch (error) {
      Log.error(`[GPT] Error during VectorStore cleanup: `, error.toString())
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
          Log.log(`[GPT] File to delete: ${f.id}`)
        } else {
          Log.log(`[GPT] File to keep: ${f.id}`)
        }
      }
    } catch (error) {
      Log.error(`[GPT] Error during File cleanup in VectorStore ${vsId}: `, error.toString())
    }

    Log.log(`[GPT] File cleanup completed`)
    this.sendSocketNotification('INITIALIZED')
  },

  prepareAssistant: async function ({ notificationId, assistantId, vectorStoreId = [], fileSearch = [], functionCall = [] }) {
    Log.log(`[GPT] Prepare Assistant: ${assistantId}}`)
    try {




      // AssistantId에 해당하는 Assistant가 있으면 불러오고 아니면 fail.
      // fileSearch에 있는 파일들이 존재하는지, 없으면 무시.
      // fileSearch의 파일들을 files에 업로드. fileId 기억.

      // 업로드된 fileId가 있음.
      //// vectorStoreId가 주어지지 않음
      ////// Assistant도 vectorStore가 없음
      //////// 새 vectorStore를 생성하고, vectorStoreFiles추가하고, Assistant에 업데이트.
      ////// Assistant에 vectorStore가 있음
      //////// 기존 vectorStore에 vectorStoreFiles 추가하고, Assistant에 업데이트.
      //// vectorStoreId가 주어짐
      ////// Assistant에 vectorStore가 없음
      //////// vectorStoreId에 해당하는 vectorStore가 존재하는가??

      // vectorStoreId가 주어졌고, 현재 vectorStore와 일치하면 pass.
      // 현재 vectorStore가 없는데, vectorStoreId가 주어졌으면 해당 vectorStore를 Assistant에 업데이트.
      // 현재 vectorStore도 없고, vectorStoreId도 없지만 fileSearch가 있으면 새 vectorStore를 생성하고 Assistant에 업데이트.

    } catch (error) {
      Log.log(`[GPT] Prepare Assistant Error: `, assistantId)
      Log.log(`[GPT] > Reason: `, error.toString())
      this.sendSocketNotification('REQUEST_FAILED', {
        notificationId,
        error: error.toString(),
        timestamp: new Date().getTime(),
      })
    }
  }

})