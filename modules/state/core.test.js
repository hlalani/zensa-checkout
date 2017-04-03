import test from 'tape'
import {
  getElemState
} from './core'

test('getElemState()', assert => {
  const id = '/setup-1'
  const rootState = {
    "/setup-1": {
      isValid: null,
      isTouched: false,
      errorMsgs: [
        'This field is required',
        'Project name must be camelcased'
      ]
    }
  }
  const actual = getElemState(rootState, id)
  const expected = {
    isValid: null,
    isTouched: false,
    errorMsgs: [
      'This field is required',
      'Project name must be camelcased'
    ]
  }

  assert.deepEqual(actual, expected,
    `getElemState() should return the state obj of a given id`)

  /* -------------------- */

  const id2 = '/setup-x'
  const rootState2 = {
    "/setup-1": {
      isValid: null,
      isTouched: false,
      errorMsgs: [
        'This field is required',
        'Project name must be camelcased'
      ]
    }
  }
  const actual2 = getElemState(rootState2, id2)
  const expected2 = {}

  assert.deepEqual(actual2, expected2,
    `Given a non-existing id, getElemState() should return {}`)

  /* -------------------- */

  const id3 = '/setup-x'
  const rootState3 = undefined
  const actual3 = getElemState(rootState3, id3)
  const expected3 = {}

  assert.deepEqual(actual3, expected3,
    `Given an undefined rootState, getElemState() should return {}`)

  /* -------------------- */

  const id4 = '/setup-x'
  const rootState4 = {}
  const actual4 = getElemState(rootState4, id4)
  const expected4 = {}

  assert.deepEqual(actual4, expected4,
    `Given a rootState of {}, getElemState() should return an
    {}`)

  assert.end()
})
