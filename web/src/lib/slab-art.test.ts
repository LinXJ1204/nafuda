import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paletteOf, splitCard, splitGrade } from './slab-art.ts'

test('palette is deterministic per cert and differs between certs', () => {
  assert.deepEqual(paletteOf('12345678'), paletteOf('12345678'))
  assert.notDeepEqual(paletteOf('12345678'), paletteOf('12345679'))
  const { hue, hue2 } = paletteOf('1')
  assert.ok(hue >= 0 && hue < 360 && hue2 >= 0 && hue2 < 360)
})

test('grade splits into words and number', () => {
  assert.deepEqual(splitGrade('GEM MT 10'), { words: 'GEM MT', number: '10' })
  assert.deepEqual(splitGrade('NM-MT 8.5'), { words: 'NM-MT', number: '8.5' })
  assert.deepEqual(splitGrade('AUTHENTIC'), { words: 'AUTHENTIC', number: '' })
})

test('card splits into name and detail, dropping the demo suffix', () => {
  assert.deepEqual(splitCard('Nafuda Dragon - Holo #001 (demo card)'), { name: 'Nafuda Dragon', detail: 'Holo #001' })
  assert.deepEqual(splitCard('Plain name'), { name: 'Plain name', detail: '' })
})
