// @flow
import {clo,logError} from '@helpers/dev'

export type CodeBlock = { type: string, code: string, paragraphs: Array<TParagraph> }
export function getCodeBlocks(note: CoreNoteFields): $ReadOnlyArray<$ReadOnly<CodeBlock>> {
  const paragraphs = note.paragraphs ?? []

  let inCodeBlock = false
  const codeBlocks: Array<CodeBlock> = []
  let language = ''
  let queryString = []
  let codeParagraphs = []
  for (const paragraph of paragraphs) {
    if (paragraph.type === 'code') {
      if (inCodeBlock) {
        if (paragraph.content.startsWith('```')) {
          // this is the end of the code block - save it and reset for next code block
          inCodeBlock = false
          codeBlocks.push({ type: language, code: queryString.join('\n'), paragraphs: codeParagraphs })
          queryString = []
          codeParagraphs = []
          language = ''
        } else {
          queryString.push(paragraph.content)
          codeParagraphs.push(paragraph)
        }
      } else if (paragraph.content.startsWith('```')) {
        inCodeBlock = true
        language = paragraph.content.slice(3)
      }
    } else {
      if (inCodeBlock) {
        inCodeBlock = false
        codeBlocks.push({ type: language, code: queryString.join('\n'), paragraphs: codeParagraphs })
        queryString = []
        codeParagraphs = []
        language = ''
      }
    }
  }

  return codeBlocks
}

/**
 * Get all Code Blocks of a given type (or multiple types like ["javascript","js"])
 * Whatever is listed behind the ```nameHere in the code block
 * @param {CoreNoteFields} note 
 * @param {Array<string>|string} types -- either a single string type to look for or an array of them
 * @returns {$ReadOnlyArray<$ReadOnly<{ type: string, code: string }>>} an array of {type:string, code:string}
 */
export function getCodeBlocksOfType(note: CoreNoteFields, types: Array<string>|string): $ReadOnlyArray<$ReadOnly<CodeBlock>> {
  const allBlocks = getCodeBlocks(note)
  if (allBlocks.length) {
    const typesArr = Array.isArray(types) ? types : [types]
    // return allBlocks.filter(b=>typesArr.(b.type.trim()))
    // return allBlocks filtered to only those with a type which starts with one of the types in typesArr
    return allBlocks.filter(b => typesArr.some(t => b.type.trim().startsWith(t)))
  }
  return []
}