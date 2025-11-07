import * as fs from 'fs'
import * as path from 'path'

export interface ParsedVocabulary {
  germanWord: string
  englishTranslation: string
  fullSentence: string
  blankSentence: string
  englishSentence: string
  level: string
  correctAnswer: string
}

export function extractCorrectAnswer(fullSentence: string, blankSentence: string, germanWord: string): string {
  let correctAnswer = ''
  if (fullSentence && blankSentence) {
    const blankIndex = blankSentence.indexOf('__')
    if (blankIndex !== -1) {
      const beforeBlank = blankSentence.substring(0, blankIndex)
      const afterBlank = blankSentence.substring(blankIndex + 2)

      const beforeIndex = fullSentence.indexOf(beforeBlank)
      if (beforeIndex !== -1) {
        const startPos = beforeIndex + beforeBlank.length
        const remaining = fullSentence.substring(startPos)

        const afterIndex = remaining.indexOf(afterBlank)
        if (afterIndex !== -1) {
          const answerPart = remaining.substring(0, afterIndex).trim()
          correctAnswer = answerPart
        } else {
          const match = remaining.match(/^([^\s,\.!?;:]+(?:\s+[^\s,\.!?;:]+)*)/)
          if (match) {
            correctAnswer = match[1].trim()
          } else {
            correctAnswer = germanWord.trim()
          }
        }
      } else {
        correctAnswer = germanWord.trim()
      }
    } else {
      correctAnswer = germanWord.trim()
    }
  } else {
    correctAnswer = germanWord.trim()
  }

  correctAnswer = correctAnswer.replace(/[.,!?;:]+$/, '')
  return correctAnswer
}

export function parseVocabularyFile(filePath: string): ParsedVocabulary[] {
  const absolutePath = path.resolve(filePath)
  const content = fs.readFileSync(absolutePath, 'utf-8')
  const lines = content.split(/\r?\n/)
  const results: ParsedVocabulary[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split('\t').map((part) => part.trim())
    if (parts.length < 6) continue

    const [germanWord, englishTranslation, fullSentence, blankSentence, englishSentence, level] = parts
    const correctAnswer = extractCorrectAnswer(fullSentence, blankSentence, germanWord)

    results.push({
      germanWord,
      englishTranslation,
      fullSentence,
      blankSentence,
      englishSentence,
      level,
      correctAnswer,
    })
  }

  return results
}

