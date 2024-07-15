import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const nodeHelperJobs = {
  processNewsFeed: async function (text) {
    console.log("Processing newsfeed")
    try {
      const filePath = path.resolve(__dirname, '../../storage', 'newsfeed.txt')
      console.log("filePath", filePath)
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(err)
            return err
          }
          console.log('Newsfeed file is deleted.')
        })
      }
      fs.writeFileSync(filePath, text)
      console.log('Newsfeed file is created.')
      return filePath
    } catch (error) {
      console.error(error)
      return error
    }
  },

  cleanNewsFeed: async function ({ filePath }) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error(err)
        return err
      }
      console.log('Newsfeed file is deleted.')
    })
    return true
  }
}

export { nodeHelperJobs } // ECMAScript module export