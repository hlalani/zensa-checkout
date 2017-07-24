import R from 'ramda'
import {changeState} from './events'

/*
  STATE STRUCTURE = {
    'id': {
      key: value,
      key2: value2
    },
    ...
  }
*/

// getElemState :: String -> {*} -> {*}
export const getElemState = R.curry((rootState, id) => {
  if (R.isNil(rootState)) { return {} }
  if (R.equals({}, rootState)) { return {} }
  return R.isNil(R.prop(id, rootState)) ? {} : R.prop(id, rootState)
})

// HACK for react ab testing module (only needed on pages that use it - like HOME and LP)
// getRootStateFromLocalStorage :: {*} -> {*}
export const getRootStateFromLocalStorage = (localStorage) => {
  return !R.isNil(localStorage) ? JSON.parse(localStorage.getItem('rootState')) : {}
}

// resetState :: {*} -> String -> IMPURE
export const resetState = R.curry((rootState, stateId) => {
  const fieldState = getElemState(rootState, stateId)
  const wipedFieldState = R.mapObjIndexed((val, key) => undefined)(fieldState)
  changeState(stateId, wipedFieldState)
})

// getNextRootState :: {*} -> String -> {*}
export const getNextRootState = R.curry((rootState, stateId, newState) => {
  const mergedNewState = R.merge(getElemState(rootState, stateId), newState)
  return R.merge(rootState, {[stateId]: mergedNewState})
})
