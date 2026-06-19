import { createI18n } from 'vue-i18n'
import en from './en.json'
import zh from './zh.json'

// 获取浏览器语言
const getBrowserLocale = () => {
  const navigatorLocale = navigator.language || navigator.userLanguage || 'en'
  // 提取语言代码（如 'zh-CN' -> 'zh'）
  const locale = navigatorLocale.split('-')[0]
  // 检查是否支持该语言
  return ['en', 'zh'].includes(locale) ? locale : 'en'
}

const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getBrowserLocale(), // 自动检测浏览器语言
  fallbackLocale: 'en', // 默认回退语言
  messages: {
    en,
    zh
  }
})

export default i18n
