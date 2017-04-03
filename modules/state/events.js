import R from 'ramda'

// changeState :: String -> {*} -> IMPURE
export const changeState = (id, newState) => {
  const eventData = {[id]: newState}
  const changeStateEvent = new window.CustomEvent('state:change', {detail: eventData})
  window.document.dispatchEvent(changeStateEvent)
}
