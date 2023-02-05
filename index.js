import axios from 'axios'
import connect from './db.js'
import tmx from './tmx.js'
import { createGunzip } from 'zlib'

const corpus = process.argv[2] || 'Tatoeba'
const lang1 = process.argv[3] || 'en'
const lang2 = process.argv[4] || 'es'

console.table({ corpus, lang1, lang2 })

const opusUrl = 'https://opus.nlpl.eu/download.php?'
  + `f=${corpus}/v2022-03-03/tmx/${lang1}-${lang2}.tmx.gz`

const mongoPass = encodeURIComponent(process.env.MONGODB_PASSWORD)
const mongoUrl = `mongodb+srv://magnum-opus-user:${mongoPass}@magmum-opus.pbxgyo0.mongodb.net`
const mongoDb = 'magnum-opus'

let text1 = null
let text2 = null
let segment1 = null
let segment2 = null

try {
  let tasks = []

  function start() {
    console.time('import')
  }
  
  async function stop() {
    await Promise.all(tasks)
    await db.close()
    console.timeEnd('import')
  }
  
  start()

  const db = await connect(mongoUrl, mongoDb)

  await db.install()
  const {
    existing, source_id
  } = await db.addSource({ corpus, lang1, lang2 })

  if (existing) {
    console.log('Skipping import: already imported')
    await stop()
    process.exit()
  }

  const source = (await axios.get(opusUrl, {
    responseType: 'stream'
  })).data.pipe(createGunzip())

  tmx(source)
    .on('end', async () => {
      await stop()
    })
    .on('segment', ({ which, text }) => {
      // TODO: for now, skip punctuation (add `|[^ ]` to re-include)
      const segment = text.match(/[0-9A-ZÀ-ÖØ-Þa-zß-öø-ÿ']+/g)
      switch (which) {
        case 1:
          text1 = text
          segment1 = segment
          break
        case 2:
          text2 = text
          segment2 = segment
          break
      }
    })
    .on('endunit', async () => {
      if (
        segment1 == null || segment1.length === 0 ||
        segment2 == null || segment2.length === 0
      ) {
        console.warn(
          'Skipping translation: empty segment',
          { text1, text2 }
        )
        return
      }

      // TODO: for now, skip translations with 3-word segments or longer
      if (segment1.length > 2 || segment2.length > 2) {
        return
      }

      tasks.push(
        db.addTranslation({ source_id, segment1, segment2 })
      )
    })
} catch (error) {
  console.error(error)
  await stop()
}