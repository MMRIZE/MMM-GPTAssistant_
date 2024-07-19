const EventEmitter = require('events')

class EventHandler extends EventEmitter {
  constructor({ client, notificationId, threadId, functionCall, onFinish, statusReport, instant }) {
    super()
    this.client = client
    this.threadId = threadId
    this.instant= instant,
    this.result = {
      notificationId,
      threadId,
      response: {},
      timestamp: new Date().getTime(),
      error: null
    }
    this.functionCall = async (id, payload) => {
      return await functionCall(id, payload)
    }
    this.onFinish = () => {
      console.log('[GPT] Finish Run', this.result?.error || this.result?.response[0])
      return onFinish(this.result, this.threadId, this.instant)
    }
    this.statusReport = (status) => {
      console.log('[GPT] Process:', status)
      return statusReport(status)
    }
  }

  async onEvent(event) {
    console.log(event.event)
    try {
      const reports = [
        'thread.run.created', 'thread.message.created', 'thread.run.requires_action',
        'thread.run.completed', 'thread.message.completed', 'thread.run.failed'
      ]
      if (reports.includes(event.event)) this.statusReport(event.event)

      if (event.event === "thread.run.requires_action") {
        await this.handleRequiresAction(
          event.data,
          event.data.id,
          event.data.thread_id,
        )
      }
      if (event.event === "thread.run.completed") {
        this.onFinish()
      }
      if (event.event === "thread.message.completed") {
        this.result.response = event.data.content
      }

      if (event.event === 'thread.run.failed') {
        console.log(`[GPT] Run failed: `, event.data)
        this.result.error = event.data.error
        this.onFinish()
      }
    } catch (error) {
      console.log(`[GPT] Error: `, error.toString())
      console.error(error)
      this.result.error = error
      this.onFinish()
    }
  }

  async handleRequiresAction(data, runId, threadId) {
    try {
      const toolOutputs = []
      for (const toolCall of data.required_action.submit_tool_outputs.tool_calls) {
        console.log(`[GPT] Processing tool call`, toolCall)
        if (toolCall.type !== "function") {
          continue
        }
        const { id, function: functionCall } = toolCall

        const parameters = (functionCall?.arguments) ? JSON.parse(functionCall.arguments) : null
        try {
          const output = await this.functionCall(id, { name: functionCall.name, parameters })
          toolOutputs.push({
            tool_call_id: id,
            output: output || "empty",
          })
        } catch (error) {
          console.error("Error processing tool call:", error)
          continue
        }
      }
      await this.submitToolOutputs(toolOutputs, runId, threadId);
    } catch (error) {
      console.error("Error processing required action:", error);
    }
  }

  async submitToolOutputs(toolOutputs, runId, threadId) {
    try {
      const stream = this.client.beta.threads.runs.submitToolOutputsStream(
        threadId,
        runId,
        { tool_outputs: toolOutputs },
      );
      for await (const event of stream) {
        this.emit("event", event);
      }
    } catch (error) {
      console.error("Error submitting tool outputs:", error);
    }
  }
}

module.exports = EventHandler