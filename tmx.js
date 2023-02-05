import sax from 'sax'
import { EventEmitter } from 'events'

export default function (source) {
  const emitter = new EventEmitter()

  let capture = false
  let which = 1

  source.pipe(
    sax.createStream()
      .on('end', () => emitter.emit('end'))
      .on('text', text => {
        if (capture) {
          emitter.emit('segment', { which, text })
          capture = false
        }
      })
      .on('opentag', ({ name }) => {
        switch (name) {
          case 'SEG':
            capture = true
            break
          case 'TU':
            which = 1
            break;
        }
      })
      .on('closetag', async name => {
        switch (name) {
          case 'SEG':
            which++
            break
          case 'TU':
            emitter.emit('endunit')
            break
        }
      })
  )

  return emitter
}