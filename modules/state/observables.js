import Rx from 'rx-lite'
import R from 'ramda'

/*
  STRATEGY:
  - Custom event ("state:change") is fired for each action
  - Triggers state$ observable which accumulates the state data
  - Re-render react-router on onNext()
  - Handle errors if any
  - NOTE: Each state is saved in the following form - {id: {}} where id = stateId
*/

export const state$ = Rx.Observable.fromEvent(window.document, 'zensaCheckoutState:change')
  .map(e => e.detail)
  .scan(R.mergeWith(R.merge), {}) // Instead of simple R.merge to accommodate for multiple event handlers within the same id
  .distinctUntilChanged()

// runs subscribe only if the given state has changed
// stateChanged$$ :: String -> Observable
export const stateChanged$$ = stateId => {
  return Rx.Observable.fromEvent(global.document, 'zensaCheckoutState:change')
    .map(e => e.detail)
    .filter(state => R.compose(R.head, R.keys)(state) === stateId)
    .distinctUntilChanged()
    .map(R.prop(stateId))
}
