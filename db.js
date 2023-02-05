import { MongoClient } from 'mongodb'

class Db {
  #client
  #db

  #sources() {
    return this.#db.collection('sources')
  }

  #translations() {
    return this.#db.collection('translations')
  }
  
  constructor(client, db) {
    this.#client = client
    this.#db = client.db(db)
  }

  close() {
    return this.#client.close()
  }

  install() {
    return this.#sources().createIndex(
      { corpus: 1, lang1: 1, lang2: 1 },
      { unique: true }
    )
  }

  async addSource(data) {
    const {
      lastErrorObject: { updatedExisting, upserted },
      value
    } = await this.#sources().findOneAndUpdate(
      data, { $set: data }, { upsert: true }
    )
    return {
      existing: updatedExisting,
      source_id: updatedExisting ? value._id : upserted
    }
  }

  addTranslation(data) {
    return this.#translations().insertOne(data)
  }
}

export default async function(url, db) {
  const client = new MongoClient(url)
  await client.connect()
  return new Db(client, db)
}