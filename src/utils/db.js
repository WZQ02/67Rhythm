// IndexedDB 工具模块 - 用于存储谱面音频文件

const DB_NAME = '67rhythm_audio'
const DB_VERSION = 1
const STORE_NAME = 'audio_files'

let dbInstance = null

/**
 * 打开 IndexedDB 数据库
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(dbInstance)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

/**
 * 保存音频文件到 IndexedDB
 * @param {string} audioId - 音频ID（通常是谱面ID或music项的值）
 * @param {Blob} audioBlob - 音频文件的 Blob 对象
 * @param {string} fileName - 原始文件名
 * @returns {Promise<string>} - 返回存储的音频ID
 */
export async function saveAudio(audioId, audioBlob, fileName) {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const audioData = {
      id: audioId,
      blob: audioBlob,
      fileName: fileName,
      timestamp: Date.now()
    }
    
    const request = store.put(audioData)
    
    request.onsuccess = () => {
      resolve(audioId)
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * 从 IndexedDB 获取音频 Blob
 * @param {string} audioId - 音频ID
 * @returns {Promise<Blob|null>}
 */
export async function getAudio(audioId) {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.get(audioId)
    
    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.blob : null)
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * 从 IndexedDB 删除音频
 * @param {string} audioId - 音频ID
 * @returns {Promise<void>}
 */
export async function deleteAudio(audioId) {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.delete(audioId)
    
    request.onsuccess = () => {
      resolve()
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * 检查 IndexedDB 中是否存在指定音频
 * @param {string} audioId - 音频ID
 * @returns {Promise<boolean>}
 */
export async function hasAudio(audioId) {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.get(audioId)
    
    request.onsuccess = () => {
      resolve(!!request.result)
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * 获取所有已存储的音频ID列表
 * @returns {Promise<string[]>}
 */
export async function getAllAudioIds() {
  const db = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    const request = store.getAllKeys()
    
    request.onsuccess = () => {
      resolve(request.result || [])
    }
    
    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * 将 Blob 转换为 ArrayBuffer（用于 Web Audio API）
 * @param {Blob} blob - 音频 Blob
 * @returns {Promise<ArrayBuffer>}
 */
export function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}
