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
 * 第一步：合并行
 * 处理以逗号或数字开头的行，合并到上一行
 * 同时确保元数据和谱面内容之间有空行
 */
function mergeLines(lines) {
  const result = []
  let inMetadata = true
  let lastWasMetadata = false
  
  for (const line of lines) {
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
    
    // 谱面内容区域：除了以 ( 或 { 开头的行，其他都合并到上一行
    if (!trimmed.startsWith('(') && !trimmed.startsWith('{') && result.length > 0) {
      const lastLine = result[result.length - 1]
      result[result.length - 1] = lastLine + trimmed  // 使用 trimmed 而不是 line，避免保留换行符和\r
    } else {
      // 使用清理后的行，移除可能存在的行内换行符和\r
      const cleanLine = line.replace(/\r?\n/g, '').replace(/\r/g, '')
      result.push(cleanLine)
    }
  }
  
  return result
}

/**
 * 第二步：插入换行符
 * 处理 BPM 标记和小节标记，确保它们单独放在一行
 */
function insertNewlines(lines) {
  const result = []
  
  for (const line of lines) {
    // 先移除行内已有的换行符和\r，确保每行都是真正的单行
    const cleanLine = line.replace(/\r?\n/g, '').replace(/\r/g, '')
    const trimmed = cleanLine.trim()
    if (!trimmed) {
      result.push(line)
      continue
    }
    
    // 处理 BPM 标记：确保单独放在一行
    // 格式如：3,4,3,4,(150)6,7,6,7, -> 拆分成多行
    if (trimmed.includes('(') && trimmed.includes(')')) {
      const parts = trimmed.split(/(\([\d.]+\))/)
      for (const part of parts) {
        const partTrimmed = part.trim()
        if (partTrimmed === '') continue
        
        // 拆分后的部分可能还包含 {，需要继续处理
        if (partTrimmed.includes('{')) {
          const normalized = partTrimmed.replace(/(.)(\{)/g, '$1\n$2')
          const splitLines = normalized.split('\n')
          for (const splitLine of splitLines) {
            if (splitLine.trim()) {
              result.push(splitLine.trim())
            }
          }
        } else {
          result.push(partTrimmed)
        }
      }
      continue
    }
    
    // 处理一行中有多个 { 的情况
    // 在每个 { 前换行（除了行首的 {）
    if (trimmed.includes('{')) {
      const normalized = trimmed.replace(/(.)(\{)/g, '$1\n$2')
      const splitLines = normalized.split('\n')
      for (const splitLine of splitLines) {
        if (splitLine.trim()) {
          result.push(splitLine.trim())
        }
      }
    } else {
      result.push(cleanLine)
    }
  }
  
  return result
}

/**
 * 第二步：处理 BPM 标记后没有小节标记的情况
 * 当 BPM 标记后直接跟音符而非小节标记时，插入该 BPM 前面最近的小节标记
 * 例如: {8}6,7,6,7(120)4,5,4,5 -> {8}6,7,6,7(120){8}4,5,4,5
 */
function insertSectionAfterBpm(lines) {
  const result = []
  let globalLastSectionMark = null
  
  for (let line of lines) {
    const trimmed = line.trim()
    
    // 跳过空行
    if (!trimmed) {
      result.push(line)
      continue
    }
    
    // 提取当前行中的所有小节标记，更新全局的最后一个小节标记
    const sectionMarks = trimmed.match(/\{(\d+)\}/g)
    if (sectionMarks) {
      globalLastSectionMark = sectionMarks[sectionMarks.length - 1]
    }
    
    // 如果整行没有小节标记但有 BPM 标记，直接使用全局的最后一个小节标记
    if (!sectionMarks && trimmed.includes('(') && trimmed.includes(')') && globalLastSectionMark) {
      const bpmMatch = trimmed.match(/^\((\d+(?:\.\d+)?)\)(.+)$/)
      if (bpmMatch) {
        line = `(${bpmMatch[1]})${globalLastSectionMark}${bpmMatch[2]}`
        result.push(line)
        continue
      }
    }
    
    // 逐字符处理，确保每个 BPM 标记后插入它前面最近的小节标记
    let processedLine = ''
    let currentSectionMark = globalLastSectionMark
    let i = 0
    
    while (i < line.length) {
      const char = line[i]
      
      // 检测小节标记 {数字}
      if (char === '{') {
        const endIndex = line.indexOf('}', i)
        if (endIndex !== -1) {
          currentSectionMark = line.substring(i, endIndex + 1)
          processedLine += currentSectionMark
          i = endIndex + 1
          continue
        }
      }
      
      // 检测 BPM 标记 (数字)，如果后面不是 { 则插入当前小节标记
      if (char === '(') {
        const endIndex = line.indexOf(')', i)
        if (endIndex !== -1) {
          const bpmValue = line.substring(i, endIndex + 1)
          processedLine += bpmValue
          // 检查 BPM 后面是否不是 {
          if (endIndex + 1 < line.length && line[endIndex + 1] !== '{') {
            if (currentSectionMark) {
              processedLine += currentSectionMark
            }
          }
          i = endIndex + 1
          continue
        }
      }
      
      // 普通字符直接添加
      processedLine += char
      i++
    }
    
    result.push(processedLine)
  }
  
  return result
}

/**
 * 预处理 simai 谱面文本
 * 规范化格式：
 * 1. 在一行中出现多个小节标记时，在每个 { 前换行
 * 2. 处理以逗号或数字开头的行（合并到上一行）
 * 3. 确保元数据和谱面内容之间有空行
 * 4. BPM 标记单独放在一行
 */
export function preprocessSimaiText(text) {
  const lines = text.split('\n')
  
  // 第一步：合并行
  const mergedLines = mergeLines(lines)
  //console.log("合并内容："+mergedLines)
  // 第二步：处理 BPM 后没有小节标记的情况
  const withSectionMarks = insertSectionAfterBpm(mergedLines)
  //console.log("添加标记："+withSectionMarks)
  // 第三步：插入换行符
  const splitLines = insertNewlines(withSectionMarks)
  // 第四步：确保每个没有小节标记的行继承上一行的小节标记
  const finalLines = inheritSectionMarks(splitLines)
  let result = finalLines.join('\n')
  console.log("插入换行符："+result)
  return result
}

/**
 * 确保每个没有小节标记的行继承上一行的小节标记
 */
function inheritSectionMarks(lines) {
  const result = []
  let lastSectionMark = null
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // 跳过空行和元数据行
    if (!trimmed || trimmed.startsWith('&')) {
      result.push(line)
      continue
    }
    
    // 如果是 BPM 标记行，不改变，但要保留之前的小节标记
    if (trimmed.startsWith('(') && trimmed.includes(')')) {
      result.push(line)
      continue
    }
    
    // 检查是否有小节标记
    const sectionMatch = trimmed.match(/^\{(\d+)\}/)
    if (sectionMatch) {
      lastSectionMark = sectionMatch[0]
      result.push(line)
    } else {
      // 如果没有小节标记，继承上一行的小节标记
      if (lastSectionMark) {
        result.push(lastSectionMark + trimmed)
      } else {
        // 如果没有上一行的小节标记，保持原样
        result.push(line)
      }
    }
  }
  
  return result
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
