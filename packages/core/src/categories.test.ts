import assert from 'node:assert/strict'
import { test } from 'node:test'
import { zeroAddress, type Address } from 'viem'
import { NO_CATEGORY, cardFields, categoryAttributes, checkCategory, classify } from './categories.ts'
import { attributesFor, precheck, type IssueForm } from './issue-rules.ts'

test('a category form becomes card.* text records; empty fields are left out', () => {
  assert.deepEqual(categoryAttributes({ group: 'tcg', kind: 'pokemon', year: '2025', language: 'JPN' }), {
    'card.category': 'tcg',
    'card.game': 'pokemon',
    'card.year': '2025',
    'card.language': 'JPN',
  })
  assert.deepEqual(categoryAttributes({ group: 'sports', kind: 'baseball', year: '', language: '' }), { 'card.category': 'sports', 'card.sport': 'baseball' })
  assert.deepEqual(categoryAttributes(NO_CATEGORY), {})
})

test('classify and label: game or sport first, else the group; unknown values pass through', () => {
  assert.equal(classify({ 'card.category': 'tcg', 'card.game': 'yugioh' })?.label, 'Yu-Gi-Oh!')
  assert.equal(classify({ 'card.category': 'sports', 'card.sport': 'baseball' })?.label, 'Baseball')
  assert.equal(classify({ 'card.category': 'non-sport' })?.label, 'Non-sport')
  assert.equal(classify({ 'card.category': 'tcg', 'card.game': 'lorcana' })?.label, 'lorcana')
  assert.equal(classify({ 'subgrade.edges': '10' }), null)
  assert.deepEqual(cardFields({ 'subgrade.edges': '10', 'card.language': 'JPN', 'card.category': 'tcg', 'card.game': 'pokemon', 'card.promo': 'yes' }), [
    ['Category', 'Trading card games'],
    ['Game', 'Pokémon'],
    ['Language', 'Japanese'],
    ['card.promo', 'yes'],
  ])
})

test('category checks', () => {
  assert.equal(checkCategory(NO_CATEGORY, 2026), null)
  assert.match(checkCategory({ ...NO_CATEGORY, year: '2025' }, 2026) ?? '', /category first/)
  assert.match(checkCategory({ group: 'tcg', kind: '', year: '', language: '' }, 2026) ?? '', /game/)
  assert.match(checkCategory({ group: 'sports', kind: 'pokemon', year: '', language: '' }, 2026) ?? '', /Unknown sport/)
  assert.match(checkCategory({ group: 'tcg', kind: 'mtg', year: '2027', language: '' }, 2026) ?? '', /year/)
  assert.match(checkCategory({ group: 'tcg', kind: 'mtg', year: '', language: 'FRA' }, 2026) ?? '', /language/)
  assert.equal(checkCategory({ group: 'non-sport', kind: '', year: '1999', language: 'ENG' }, 2026), null)
})

const graderAddr: Address = '0x1111111111111111111111111111111111111111'
const alice: Address = '0x92785192Bb6a16be1Ac305ab419e0F36F0216370'
const bgs = { grader: graderAddr, scale: ['GEM MINT 9.5'], subgrades: ['centering', 'corners', 'edges', 'surface'], short: 'BGS-Sim', controllerVersion: 2 }
const form: IssueForm = {
  cert: '1004827401',
  card: 'Kitsune Lantern - Promo #042 (demo card)',
  grade: 'GEM MINT 9.5',
  holder: alice,
  chip: alice,
  subgrades: { centering: '9.5', corners: '9.5', edges: '10', surface: '9.5' },
  category: { group: 'tcg', kind: 'pokemon', year: '2025', language: 'JPN' },
}

test('issue: subgrades then category fit in the 8 extra records of controller v2', () => {
  const { keys, values } = attributesFor(form, bgs)
  assert.deepEqual(keys, ['subgrade.centering', 'subgrade.corners', 'subgrade.edges', 'subgrade.surface', 'card.category', 'card.game', 'card.year', 'card.language'])
  assert.equal(values[5], 'pokemon')
  assert.equal(precheck(form, bgs, graderAddr, zeroAddress, 2026), null)
})

test('issue: a v1 controller cannot record a category; bad category fields are caught before sending', () => {
  assert.match(precheck(form, { ...bgs, controllerVersion: 1 }, graderAddr, zeroAddress, 2026) ?? '', /v1/)
  assert.match(precheck({ ...form, category: { ...form.category!, kind: '' } }, bgs, graderAddr, zeroAddress, 2026) ?? '', /game/)
  const tooMany = { ...bgs, subgrades: ['a', 'b', 'c', 'd', 'e'] }
  const sub = Object.fromEntries(tooMany.subgrades.map((k) => [k, '9']))
  assert.match(precheck({ ...form, subgrades: sub }, tooMany, graderAddr, zeroAddress, 2026) ?? '', /At most 8/)
})
