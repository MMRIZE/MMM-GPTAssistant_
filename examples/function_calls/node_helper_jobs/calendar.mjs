import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nodeHelperJobs = {
  processCalendar: async function (text) {
    console.log("Processing Calendar")
    try {
      const filePath = path.resolve(__dirname, '../../storage', 'calendar.txt')
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err)
            return err
          }
          console.log('Calendar file is deleted.')
        })
      }
      fs.writeFileSync(filePath, text)
      console.log('Calendar file is created.')
      return filePath
    } catch (error) {
      console.error(error)
      return error
    }
  },

  cleanCalendar: async function ({ filePath }) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err)
        return err
      }
      console.log('Calendar file is deleted.')
    })
    return true
  }
}

export { nodeHelperJobs } // ECMAScript module export