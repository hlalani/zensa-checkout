import React from 'react'
import {render} from 'react-dom'
import Rx from 'rx-lite'
import R from 'ramda'

import {state$} from '../modules/state/observables'
import {changeState} from '../modules/state/events'
import {runCustomEventsPolyfill} from '../modules/polyfill/custom-events'

import '../assets/styles/main.css'
import 'react-select/dist/react-select.css'

import App from './App'

runCustomEventsPolyfill()

state$.subscribe(
  rootState => render(<App rootState={rootState} />, document.getElementById('app'))
)

changeState('global', {})

export default App
