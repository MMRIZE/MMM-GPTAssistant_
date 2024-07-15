import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nodeHelperJobs = {
  processWeather: async function (text) {
    console.log("Processing Weather")
    try {
      const filePath = path.resolve(__dirname, '../../storage', 'weather.txt')
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err)
            return err
          }
          console.log('Weather file is deleted.')
        })
      }
      fs.writeFileSync(filePath, text)
      console.log('Weather file is created.')
      return filePath
    } catch (error) {
      console.error(error)
      return error
    }
  },

  cleanWeather: async function ({ filePath }) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err)
        return err
      }
      console.log('Weather file is deleted.')
    })
    return true
  }
}

export { nodeHelperJobs } // ECMAScript module export