// simai 谱面解析和转换工具

// 难度名称映射
const DIFFICULTY_NAMES = {
  1: 'EASY',
  2: 'BASIC',
  3: 'ADVANCED',
  4: 'EXPERT',
  5: 'MASTER',
  6: 'Re:MASTER',
  7: 'ORIGINAL'
}

/**
 * 预处理 simai 谱面文本
 * 规范化格式：
 * 1. 在一行中出现多个小节标记时，在每个 { 前换行
 * 2. 处理以逗号开头的行（合并到上一行）
 * 3. 确保元数据和谱面内容之间有空行
 */
export function preprocessSimaiText(text) {
  const lines = text.split('\n')
  const result = []
  let inMetadata = true
  let lastWasMetadata = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // 检测是否还在元数据区域
    if (inMetadata) {
      // 元数据行以 & 开头
      if (trimmed.startsWith('&')) {
        result.push(line)
        lastWasMetadata = true
        continue
      } else if (trimmed === '') {
        // 空行
        result.push(line)
        lastWasMetadata = false
        continue
      } else {
        // 遇到非元数据行，说明进入了谱面内容区域
        inMetadata = false
        // 如果上一行是元数据行且不是空行，插入一个空行
        if (lastWasMetadata) {
          result.push('')
        }
      }
    }
    
    // 谱面内容区域
    
    // 处理以逗号开头的行：合并到上一行
    if (trimmed.startsWith(',') && result.length > 0) {
      const lastLine = result[result.length - 1]
      result[result.length - 1] = lastLine + trimmed
      continue
    }
    
    // 处理一行中有多个 { 的情况
    // 在每个 { 前换行（除了行首的 {）
    if (trimmed.includes('{')) {
      // 使用正则替换：在非行首的 { 前插入换行符
      const normalized = trimmed.replace(/(.)(\{)/g, '$1\n$2')
      const splitLines = normalized.split('\n')
      result.push(...splitLines)
    } else {
      result.push(line)
    }
  }
  
  return result.join('\n')
}

/**
 * 检测是否为 simai 格式
 */
export function isSimaiFormat(text) {
  const hasMeta = text.includes('&title=') || 
                  text.includes('&artist=') || 
                  text.includes('&inote_')
  const hasNotePattern = /\{\d+\}/.test(text)
  return hasMeta && hasNotePattern
}

/**
 * 解析 simai 元数据
 */
export function parseSimaiMeta(text) {
  const meta = {
    title: '',
    artist: '',
    first: 0,
    des: ''
  }
  
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed.startsWith('&title=')) {
      meta.title = trimmed.substring(7).trim()
    } else if (trimmed.startsWith('&artist=')) {
      meta.artist = trimmed.substring(8).trim()
    } else if (trimmed.startsWith('&first=')) {
      meta.first = parseFloat(trimmed.substring(7)) * 1000 // 秒转毫秒
    } else if (trimmed.startsWith('&des=')) {
      meta.des = trimmed.substring(5).trim()
    }
  }
  
  return meta
}

/**
 * 获取谱面中的所有难度
 */
export function getSimaiDifficulties(text) {
  const difficulties = []
  const regex = /&inote_(\d+)=/g
  let match
  
  while ((match = regex.exec(text)) !== null) {
    const level = parseInt(match[1])
    if (!difficulties.find(d => d.level === level)) {
      difficulties.push({
        level,
        name: DIFFICULTY_NAMES[level] || `Level ${level}`
      })
    }
  }
  
  return difficulties
}

/**
 * 提取指定难度的谱面内容
 */
export function extractDifficultyContent(text, targetLevel) {
  const lines = text.split('\n')
  const content = []
  let inTargetDifficulty = false
  let foundAnyDifficulty = false
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    
    // 检测难度标记（可能包含 BPM）
    const diffMatch = line.match(/&inote_(\d+)=(.*)$/)
    if (diffMatch) {
      foundAnyDifficulty = true
      const level = parseInt(diffMatch[1])
      inTargetDifficulty = (level === targetLevel)
      
      // 如果同一行有 BPM 标记，提取出来
      const bpmContent = diffMatch[2].trim()
      if (bpmContent && inTargetDifficulty) {
        content.push(bpmContent)
      }
      continue
    }
    
    // 如果在目标难度内，收集内容
    if (inTargetDifficulty || (!foundAnyDifficulty && targetLevel === 1)) {
      // 跳过元数据行（不包含 &inote_）
      if (line.startsWith('&') && !line.startsWith('&inote_')) {
        continue
      }
      content.push(line)
    }
  }
  
  return content.join('\n')
}

/**
 * 转换单个音符
 * @param {string} note - 音符字符串
 * @param {object} options - 转换选项 { convertTap, convertHold, convertTouch }
 * @param {number} noteIndex - 音符索引（用于交替 6/7）
 * @returns {string} - 转换后的音符（6, 7, 或空）
 */
export function convertNote(note, options, noteIndex) {
  if (!note || note === '') return ''
  
  // 处理多押，只取第一个音符
  const firstNote = note.split('/')[0].trim()
  if (!firstNote) return ''
  
  const { convertTap, convertHold, convertTouch } = options
  
  // tap 音符: 1-8, 后面可能有 b, x 等标记
  // 例如: 1, 1b, 2x, 8
  const tapMatch = firstNote.match(/^[1-8][bx]?$/)
  if (tapMatch && convertTap) {
    return noteIndex % 2 === 0 ? '6' : '7'
  }
  
  // hold 音符: 1-8 后面接 h 再接 [x:x]
  // 例如: 5h[4:4], 1h[8:1]
  const holdMatch = firstNote.match(/^[1-8]h\[[\d:]+\]$/)
  if (holdMatch && convertHold) {
    return noteIndex % 2 === 0 ? '6' : '7'
  }
  
  // touch 音符: 大写字母接数字
  // 例如: A6, B3, E8
  const touchMatch = firstNote.match(/^[A-E][1-8]$/)
  if (touchMatch && convertTouch) {
    return noteIndex % 2 === 0 ? '6' : '7'
  }
  
  // touchhold 音符: Ch[x:x] 或 E8h[x:x] 格式，当成 touch 处理
  // 例如: Ch[4:6], E8h[6:7]
  const touchHoldMatch = firstNote.match(/^[A-E]([1-8]h)?\[[\d:]+\]$/)
  if (touchHoldMatch && convertTouch) {
    return noteIndex % 2 === 0 ? '6' : '7'
  }
  
  // slide 音符: 数字接小写字母接数字，后面可能有时长标记
  // 例如: 1b5[4:4], 2x3, 8b1[8:1]
  // 当 tap 处理
  const slideMatch = firstNote.match(/^[1-8][a-z][1-8](\[[\d:]+\])?$/)
  if (slideMatch && convertTap) {
    return noteIndex % 2 === 0 ? '6' : '7'
  }
  
  // 未匹配或未勾选的音符类型，返回空
  return ''
}

/**
 * 转换 simai 谱面内容为 67 格式
 */
export function convertSimaiContent(content, options) {
  const lines = content.split('\n')
  const result = []
  let noteCount = 0
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    
    // 处理 BPM 标记 (150) -> 150bpm
    const bpmMatch = trimmed.match(/^\((\d+(?:\.\d+)?)\)$/)
    if (bpmMatch) {
      result.push(`${bpmMatch[1]}bpm`)
      continue
    }
    
    // 处理音符行
    // 格式: {beatsPerBar}note1,note2,note3,...
    const noteLineMatch = trimmed.match(/^\{(\d+)\}(.+)$/)
    if (noteLineMatch) {
      const beatsPerBar = noteLineMatch[1]
      const notesStr = noteLineMatch[2]
      const notes = notesStr.split(',')
      
      const convertedNotes = notes.map(note => {
        const converted = convertNote(note, options, noteCount)
        if (converted) noteCount++
        return converted
      })
      
      result.push(`${beatsPerBar} ${convertedNotes.join(',')}`)
    }
  }
  
  return result.join('\n')
}

/**
 * 生成完整的 67 格式谱面
 */
export function generate67Chart(meta, content, level, musicUrl, coverUrl) {
  const lines = []
  
  // 元数据（使用空格分隔，符合本游戏格式）
  lines.push(`id ${Date.now()}`)
  lines.push(`title ${meta.title || 'Unknown'}`)
  lines.push(`artist ${meta.artist || 'Unknown'}`)
  lines.push(`level ${level}`)
  lines.push(`music ${musicUrl}`)
  if (coverUrl) {
    lines.push(`cover ${coverUrl}`)
  }
  lines.push(`des ${meta.des || 'Unknown'}`)
  lines.push(`delay ${meta.first || 0}`)
  
  // 空行分隔
  lines.push('')
  
  // 谱面内容
  lines.push(content)
  
  return lines.join('\n')
}
